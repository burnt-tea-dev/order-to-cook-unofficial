#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Exercise POI unload and disabled experiments in a stopped disposable QA world.

Run bedrock_smoke.py initial first. Never use a player/server deployment here.
The report is source-bound native evidence, not client or multiplayer acceptance.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import selectors
import shutil
import struct
import subprocess
import time

from bedrock_qa_world import validate_qa_runtime, required_experiment_data

ROOT = Path(__file__).resolve().parents[1]


def flags(runtime, beta, poi):
    world, _ = validate_qa_runtime(runtime, 'reload')
    path = world / 'level.dat'
    data = required_experiment_data(path.read_bytes())
    for name, enabled in [('gametest', beta), ('poi', poi)]:
        encoded = name.encode()
        entry = b'\x01' + struct.pack('<H', len(encoded)) + encoded + b'\x01'
        if data.count(entry) != 1:
            raise ValueError('Expected one QA experiment flag: ' + name)
        data = data.replace(entry, entry[:-1] + bytes([int(enabled)]), 1)
    path.write_bytes(data)


def run(runtime, mode, timeout):
    env = dict(os.environ, LD_LIBRARY_PATH=str(runtime))
    process = subprocess.Popen([str(runtime / 'bedrock_server')], cwd=runtime,
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env, bufsize=0)
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    lines, pending, report = [], b'', None
    version, ready, sent, stopping = '', None, False, False
    started = time.monotonic()

    def command(value):
        process.stdin.write((value + '\n').encode())
        process.stdin.flush()

    try:
        while process.poll() is None and time.monotonic() - started < timeout:
            for key, _ in selector.select(timeout=0.2):
                chunk = os.read(key.fd, 65536)
                if not chunk:
                    continue
                pending += chunk
                while b'\n' in pending:
                    raw, pending = pending.split(b'\n', 1)
                    line = raw.decode('utf-8', errors='replace').rstrip('\r')
                    lines.append(line)
                    if 'Version: ' in line:
                        version = line.split('Version: ', 1)[1]
                    if 'Server started.' in line:
                        ready = time.monotonic()
                    if 'OTC_POI_LIFECYCLE ' in line:
                        value = line.split('OTC_POI_LIFECYCLE ', 1)[1]
                        report = json.loads(value[:value.rfind('}') + 1])
                        command('stop')
                        stopping = True
            if ready and not sent and time.monotonic() - ready > 4:
                command('scriptevent ordertocook:poi_lifecycle ' + mode)
                sent = True
            if mode == 'beta-off' and ready and time.monotonic() - ready > 8 and not stopping:
                command('stop')
                stopping = True
        if process.poll() is None:
            if not stopping:
                command('stop')
            process.wait(timeout=10)
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
        selector.close()
    (runtime / f'poi-lifecycle-{mode}.log').write_text('\n'.join(lines) + '\n')
    entered = any('OTC_POI_LIFECYCLE_ENTRY' in line for line in lines)
    errors = [line for line in lines if ' ERROR]' in line and any(tag in line for tag in
        ['[Json]', '[Recipes]', '[Scripting]', '[Blocks]', '[Item]', '[Actor]'])]
    if mode == 'beta-off':
        rejection = [line for line in errors if ('[Scripting]' in line and
            any(word in line.lower() for word in ['beta', 'module', 'experiment', 'dependency']))]
        blocked = ready is not None and sent and not entered and report is None and bool(rejection)
        report = {'mode': mode, 'passed': blocked and
            not any('POI candidate loaded' in line for line in lines),
            'checks': [
                {'name': 'engine rejects beta module before QA entry can execute', 'passed': blocked},
                {'name': 'production does not report successful initialization', 'passed': not any('POI candidate loaded' in line for line in lines)}],
            'engineMessages': rejection,
            'note': 'Data retention is checked after experiments are re-enabled, not inferred from this load failure.'}
    if report is None:
        raise RuntimeError(f'{mode} did not complete; see {runtime}/poi-lifecycle-{mode}.log')
    # POI-off deliberately exercises production's explicit initialization error.
    # Other addon errors in enabled runs must not be hidden by passing assertions.
    unexpected = [] if mode == 'beta-off' else [line for line in errors if not (
        mode == 'poi-off' and 'Initialization stopped; saved data was preserved.' in line
        and 'Points of Interest' in line)]
    report.update(addonErrors=errors, unexpectedAddonErrors=unexpected, qaEntryExecuted=entered)
    report.update(serverVersion=version, processExitCode=process.returncode)
    report['passed'] = report['passed'] and process.returncode == 0 and not unexpected
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server-dir', required=True, type=Path)
    parser.add_argument('--timeout', type=int, default=100)
    args = parser.parse_args()
    runtime = args.server_dir.resolve()
    world, _ = validate_qa_runtime(runtime, 'reload')
    # Retain the complete stopped QA world before experiment toggles.
    backup = runtime / 'poi-lifecycle-before'
    if backup.exists():
        raise SystemExit('Use a new QA run directory; a lifecycle backup already exists.')
    shutil.copytree(world, backup)
    for short, kind in [('BP', 'behavior_packs'), ('RP', 'resource_packs')]:
        destination = runtime / kind / 'otc'
        shutil.rmtree(destination)
        shutil.copytree(ROOT / 'runtime' / short, destination)
        manifest = json.loads((destination / 'manifest.json').read_text())
        if short == 'BP':
            shutil.copyfile(ROOT / 'tests/bedrock-poi-lifecycle.js', destination / 'scripts/bedrock-poi-lifecycle.js')
            (destination / 'scripts/qa-entry.js').write_text("import './main.js';\nimport './bedrock-poi-lifecycle.js';\n")
            next(m for m in manifest['modules'] if m['type'] == 'script')['entry'] = 'scripts/qa-entry.js'
            (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2))
        (world / f'world_{kind}.json').write_text(json.dumps([
            {'pack_id': manifest['header']['uuid'], 'version': manifest['header']['version']}]))
    digest = hashlib.sha256()
    for path in sorted((ROOT / 'runtime').rglob('*')):
        if path.is_file():
            digest.update(path.relative_to(ROOT).as_posix().encode() + b'\0' + path.read_bytes())
    reports = []
    try:
        for mode, beta, poi in [('prepare', True, True), ('unload', True, True),
                                ('poi-off', True, False), ('beta-off', False, True),
                                ('restore', True, True)]:
            flags(runtime, beta, poi)
            result = run(runtime, mode, args.timeout)
            reports.append(result)
            print(f"{mode}: {sum(c['passed'] for c in result['checks'])}/{len(result['checks'])} checks; passed={result['passed']}", flush=True)
    finally:
        flags(runtime, True, True)
        version = json.loads((ROOT / 'package.json').read_text())['version']
        output = ROOT / 'docs/validation' / version / 'native-poi-lifecycle.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps({'addonVersion': version, 'runtimeTreeSha256': digest.hexdigest(),
            'passed': len(reports) == 5 and all(r['passed'] for r in reports), 'scenarios': reports,
            'scope': 'Native BDS, synthetic closed-restaurant fixtures and inventories. No real players, UI, multiplayer or LIVE.'}, indent=2) + '\n')
    if not all(report['passed'] for report in reports):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
