#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Native query-path A/B benchmark in an isolated Linux BDS. Never use LIVE.

The old query function is extracted verbatim from --baseline-ref and shares the
current canonical station Map with the POI arm. This isolates discovery cost;
it is not a full-pack or real-player benchmark. Both arms include the POI index
in process memory. Native diagnostic captures are retained to assess engine
tick time; paced tick intervals must never be labelled active MSPT.
"""
from pathlib import Path
import argparse
import base64
from datetime import datetime, timezone
import fcntl
import gzip
import hashlib
import json
import os
import platform
import re
import selectors
import shutil
import statistics
import subprocess
import time
from bedrock_qa_world import MARKER_TEXT, enable_required_experiments, validate_qa_runtime

ROOT = Path(__file__).resolve().parents[1]


def fingerprint(root):
    digest = hashlib.sha256()
    for path in sorted(root.rglob('*')):
        if path.is_file():
            digest.update(path.relative_to(root.parent).as_posix().encode() + b'\0' + path.read_bytes())
    return digest.hexdigest()


def native_diagnostics(path, phase):
    """Decode Mojang .mcstats and retain only this phase's measured ticks.

    Format/units: Mojang/minecraft-debugger stats-provider.ts and diagnostics
    schema. Last array value belongs to record.tick; preceding values are prior
    ticks. The three server_tick_timings categories are reported in microseconds.
    """
    text = path.read_text()
    header, end = json.JSONDecoder().raw_decode(text)
    if 'encoding' not in header:
        lines, encoding = text.splitlines(), 'utf8'
    else:
        lines, encoding = text[end:].splitlines(), header['encoding']
    ticks, memory = {}, []
    for line in lines:
        if not line.strip():
            continue
        record = json.loads(gzip.decompress(base64.b64decode(line)) if encoding == 'base64-gzip' else line)
        tick = record.get('tick')
        if not isinstance(tick, int):
            continue
        for stat in record.get('stats', []):
            if stat['name'] == 'server_tick_timings':
                for child in stat.get('children', []):
                    values = child.get('values', [])
                    for index, value in enumerate(values):
                        ticks.setdefault(tick - len(values) + index + 1, {})[child['name']] = value / 1000
            elif stat['name'] in ('app_memory', 'runtime_memory'):
                memory.append({'tick': tick, 'name': stat['name'],
                               **{child['name']: child['values'][-1] for child in stat.get('children', []) if child.get('values')}})
    required = ('level_tick', 'script_tick', 'script_job_tick')
    selected, domain = [], None
    for name, start, end in [('system.currentTick', phase['startTick'], phase['endTick']),
                             ('world.getAbsoluteTime', phase['absoluteStartTick'], phase['absoluteEndTick'])]:
        available = [{'tick': tick, **value} for tick, value in sorted(ticks.items())
                     if start <= tick < end and all(key in value for key in required)]
        if len(available) >= 0.8 * phase['elapsedTicks']:
            selected, domain = available, name
            break
    result = {'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
              'sampleCount': len(selected), 'tickDomain': domain,
              'definition': 'Sum of native level_tick + script_tick + script_job_tick, converted from microseconds; no paced sleep.',
              'availableTickRange': [min(ticks), max(ticks)] if ticks else []}
    if selected:
        durations = [sum(row[key] for key in required) for row in selected]
        result.update({'meanActiveMspt': statistics.mean(durations),
                       'p95ActiveMspt': sorted(durations)[min(len(durations) - 1, int(len(durations) * 0.95))],
                       'meanCategoryMs': {key: statistics.mean(row[key] for row in selected) for key in required},
                       'tickSamples': selected,
                       'memorySamples': [row for row in memory if selected[0]['tick'] <= row['tick'] <= selected[-1]['tick']]})
    return result


def process_sample(pid, runtime=None):
    path = Path('/proc') / str(pid) / 'stat'
    if runtime is not None and (not path.exists() or (path.parent / 'cwd').resolve() != runtime):
        # Some hosted executors expose the host procfs while Popen returns a PID
        # in a nested namespace. Match the isolated executable/cwd, never another BDS.
        for candidate in Path('/proc').iterdir():
            if not candidate.name.isdecimal():
                continue
            try:
                if (candidate / 'cwd').resolve() == runtime and (candidate / 'comm').read_text().strip() == 'bedrock_server':
                    path = candidate / 'stat'
                    break
            except (FileNotFoundError, PermissionError, ProcessLookupError):
                continue
    stat = path.read_text().rsplit(')', 1)[1].split()
    return {'cpuSeconds': (int(stat[11]) + int(stat[12])) / os.sysconf('SC_CLK_TCK'),
            'rssBytes': int(stat[21]) * os.sysconf('SC_PAGE_SIZE'), 'monotonic': time.monotonic(), 'procfsPid': int(path.parent.name)}


def server(runtime, env, timeout, trigger=None):
    process = subprocess.Popen([str(runtime / 'bedrock_server')], cwd=runtime, env=env,
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, bufsize=0)
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    deadline = time.monotonic() + timeout
    lines, pending, phases = [], b'', []
    report = None
    ready_at = None
    sent = False
    start_sample = None
    peak_rss = 0
    version = ''

    def command(value):
        process.stdin.write((value + '\n').encode())
        process.stdin.flush()

    try:
        while process.poll() is None and time.monotonic() < deadline:
            if start_sample:
                peak_rss = max(peak_rss, process_sample(start_sample['procfsPid'])['rssBytes'])
            for key, _ in selector.select(timeout=0.05):
                pending += os.read(key.fd, 65536)
                while b'\n' in pending:
                    raw, pending = pending.split(b'\n', 1)
                    line = raw.decode(errors='replace').rstrip('\r')
                    lines.append(line)
                    if 'Version: ' in line:
                        version = line.split('Version: ', 1)[1]
                    if 'Server started.' in line:
                        ready_at = time.monotonic()
                        if trigger is None:
                            command('stop')
                    for event in ('CAPTURE', 'BEGIN', 'END', 'REPORT'):
                        marker = 'OTC_PERF_' + event + ' '
                        if marker not in line:
                            continue
                        payload = line.split(marker, 1)[1]
                        value = json.loads(payload[:payload.rfind('}') + 1])
                        if event == 'CAPTURE':
                            command('script diagnostics startcapture')
                        elif event == 'BEGIN':
                            start_sample = process_sample(process.pid, runtime)
                            peak_rss = start_sample['rssBytes']
                            print('Phase ' + json.dumps(value), flush=True)
                        elif event == 'END':
                            end = process_sample(start_sample['procfsPid'])
                            seconds = end['monotonic'] - start_sample['monotonic']
                            value['process'] = {'cpuSeconds': end['cpuSeconds'] - start_sample['cpuSeconds'],
                                                'procfsPid': start_sample['procfsPid'],
                                                'cpuPercentOneCore': 100 * (end['cpuSeconds'] - start_sample['cpuSeconds']) / seconds,
                                                'rssStartBytes': start_sample['rssBytes'], 'rssEndBytes': end['rssBytes'],
                                                'peakSampledRssBytes': max(peak_rss, end['rssBytes']), 'sampleWindowSeconds': seconds}
                            phases.append(value)
                            (runtime / 'performance-phases.json').write_text(json.dumps(phases, indent=2) + '\n')
                            start_sample = None
                            command('script diagnostics stopcapture')
                        else:
                            report = value
                            command('stop')
                    if ' ERROR]' in line or 'OTC_PERF_DIAGNOSTICS_UNAVAILABLE' in line:
                        print(line, flush=True)
            if trigger and ready_at and not sent and time.monotonic() - ready_at >= 3:
                command(trigger)
                sent = True
        if process.poll() is None:
            command('stop')
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.terminate()
                process.wait(timeout=5)
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
        selector.close()
        (runtime / 'performance-active.log').write_text('\n'.join(lines) + '\n')
    if trigger and report is None:
        report = {'passed': False, 'error': 'Run ended before the workload emitted its completion report.',
                  'partialEvidence': True, 'phases': phases}
    if report:
        report['phases'] = phases
    return report, lines, version, process.returncode


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server-dir', type=Path, required=True)
    parser.add_argument('--baseline-ref', default='ce8a45e6c7d7bc3e8d04ce92ae2529e2c9601e49')
    parser.add_argument('--stations', default='80,800,3200')
    parser.add_argument('--origins', default='1,8,32')
    parser.add_argument('--ticks', type=int, default=60)
    parser.add_argument('--warmup-ticks', type=int, default=10)
    parser.add_argument('--timeout', type=int, default=900)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    settings = {'stationCounts': [int(x) for x in args.stations.split(',')],
                'originCounts': [int(x) for x in args.origins.split(',')],
                'measureTicks': args.ticks, 'warmupTicks': args.warmup_ticks}
    if not (settings['stationCounts'] == sorted(set(settings['stationCounts'])) and
            1 <= min(settings['stationCounts']) <= max(settings['stationCounts']) <= 4800 and
            1 <= min(settings['originCounts']) <= max(settings['originCounts']) <= 32 and args.ticks >= 1):
        parser.error('Use increasing station counts (1..4800), origins (1..32), and positive ticks.')
    runtime = args.server_dir.resolve()
    world, marker = validate_qa_runtime(runtime, 'initial')
    if world.exists():
        raise SystemExit('Performance runner requires an empty isolated QA runtime; choose a fresh extracted BDS directory.')
    lock = (runtime / '.ordertocook-qa-run.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    marker.write_text(MARKER_TEXT)
    (runtime / 'server.properties').write_text('''server-name=OrderToCook disposable performance QA
level-name=otc-qa
gamemode=creative
difficulty=peaceful
allow-cheats=true
max-players=1
online-mode=true
allow-list=true
server-port=24985
server-portv6=24986
enable-lan-visibility=false
view-distance=5
tick-distance=4
content-log-file-enabled=true
content-log-console-output-enabled=true
level-type=FLAT
max-threads=2
transport=nethernet
''')
    (runtime / 'allowlist.json').write_text('[]\n')
    env = dict(os.environ, LD_LIBRARY_PATH=str(runtime))
    _, bootstrap, _, code = server(runtime, env, 90)
    (runtime / 'performance-bootstrap.log').write_text('\n'.join(bootstrap) + '\n')
    if code != 0 or not (world / 'level.dat').exists():
        raise SystemExit('Clean bootstrap failed; see performance-bootstrap.log')
    enable_required_experiments(runtime)
    baseline_sha = subprocess.check_output(['git', 'rev-parse', args.baseline_ref], cwd=ROOT, text=True).strip()
    baseline_source = subprocess.check_output(['git', 'show', baseline_sha + ':runtime/BP/scripts/store.js'], cwd=ROOT, text=True)
    match = re.search(r'export function nearbyStations\([^\n]+\n.*?\n\}', baseline_source, re.S)
    if not match or 'return stations().filter(' not in match.group():
        raise SystemExit('Baseline does not contain the expected pre-POI station scan.')
    baseline_helper = match.group().replace('function nearbyStations(', 'function baselineNearbyStations(', 1)
    baseline_module = "import { stations, loadedBlock, distanceSquared } from './store.js';\n" + baseline_helper + '\n'
    for short, kind in [('BP', 'behavior_packs'), ('RP', 'resource_packs')]:
        destination = runtime / kind / 'otc'
        shutil.copytree(ROOT / 'runtime' / short, destination)
        manifest = json.loads((destination / 'manifest.json').read_text())
        if short == 'BP':
            scripts = destination / 'scripts'
            shutil.copyfile(ROOT / 'tests/bedrock-performance.js', scripts / 'bedrock-performance.js')
            (scripts / 'performance-baseline.js').write_text(baseline_module)
            (scripts / 'performance-settings.js').write_text('export const settings = ' + json.dumps(settings) + ';\n')
            (scripts / 'qa-performance-entry.js').write_text("import './main.js';\nimport './bedrock-performance.js';\n")
            next(x for x in manifest['modules'] if x['type'] == 'script')['entry'] = 'scripts/qa-performance-entry.js'
            (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2))
        (world / ('world_' + kind + '.json')).write_text(json.dumps([{'pack_id': manifest['header']['uuid'], 'version': manifest['header']['version']}]))
    expected = fingerprint(ROOT / 'runtime')
    source_identity = {'runtimeTreeSha256': expected,
                       'addonVersion': json.loads((ROOT / 'package.json').read_text())['version'],
                       'gitHeadAtMeasurement': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
                       'gitWorktreeDirtyAtMeasurement': bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True)),
                       'startedAtUtc': datetime.now(timezone.utc).isoformat(),
                       'probeSha256': hashlib.sha256((ROOT / 'tests/bedrock-performance.js').read_bytes()).hexdigest()}
    report, lines, version, code = server(runtime, env, args.timeout, 'scriptevent ordertocook:performance start')
    (runtime / 'performance.log').write_text('\n'.join(lines) + '\n')
    if report is None:
        print('\n'.join(lines[-30:]))
        raise SystemExit('No completed performance report; see performance.log')
    captures = sorted((runtime / 'diagnostics').glob('*.mcstats'))
    if len(captures) >= len(report['phases']):
        for phase, path in zip(report['phases'], captures):
            phase['nativeDiagnostics'] = native_diagnostics(path, phase)
    checksums = {}
    for phase in report['phases']:
        key = (phase['stations'], phase['origins'], phase['workload'])
        checksums.setdefault(key, set()).add(phase['checksum'])
    report['phaseChecksumEquality'] = all(len(values) == 1 for values in checksums.values())
    report.update({**source_identity, 'serverVersion': version, 'baselineRef': baseline_sha,
                   'baselineHelperSha256': hashlib.sha256(baseline_module.encode()).hexdigest(),
                   'settings': settings, 'host': {'platform': platform.platform(), 'logicalCpuCount': os.cpu_count(),
                   'cpuAffinityCount': len(os.sched_getaffinity(0)),
                   'cgroupCpuMax': Path('/sys/fs/cgroup/cpu.max').read_text().strip() if Path('/sys/fs/cgroup/cpu.max').exists() else None,
                   'cgroupMemoryMax': Path('/sys/fs/cgroup/memory.max').read_text().strip() if Path('/sys/fs/cgroup/memory.max').exists() else None,
                   'cpuModel': next((line.split(':', 1)[1].strip() for line in Path('/proc/cpuinfo').read_text().splitlines() if line.startswith('model name')), '')},
                   'diagnosticFiles': [str(p.relative_to(runtime)) for p in captures],
                   'addonErrors': [line for line in lines if ' ERROR]' in line], 'serverExitCode': code})
    report['sourceUnchangedDuringMeasurement'] = fingerprint(ROOT / 'runtime') == expected
    report['passed'] = (report['passed'] and not report['addonErrors'] and code == 0 and
                        report['sourceUnchangedDuringMeasurement'] and report['phaseChecksumEquality'])
    output = args.output or ROOT / 'docs/validation' / report['addonVersion'] / 'native-performance.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(str(output), flush=True)
    if not report['passed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
