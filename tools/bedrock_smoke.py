#!/usr/bin/env python3
"""Run the native probe in a disposable extracted BDS directory (no clients).

The BDS binary is supplied by the developer from Minecraft's official download;
it is never distributed with this project. This tests native server APIs and
saved-world restoration, not client rendering, menus, or keyboard/touch input.
"""
from pathlib import Path
import argparse
import fcntl
import hashlib
import json
import os
import selectors
import shutil
import subprocess
import threading
import time
from bedrock_qa_world import MARKER_TEXT, enable_required_experiments, validate_qa_runtime

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--server-dir', type=Path, required=True)
parser.add_argument('--mode', choices=['initial', 'reload', 'upgrade'], default='initial')
parser.add_argument('--timeout', type=int, default=75)
args = parser.parse_args()
runtime = args.server_dir.resolve()
try:
    world, marker = validate_qa_runtime(runtime, args.mode)
except ValueError as error:
    raise SystemExit(str(error)) from error
runtime_lock = (runtime / '.ordertocook-qa-run.lock').open('a')
try:
    fcntl.flock(runtime_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    raise SystemExit('Another QA runner is already using this runtime.')
if args.mode == 'initial' and world.exists():
    shutil.rmtree(world)
marker.write_text(MARKER_TEXT)
world.mkdir(parents=True, exist_ok=True)
(runtime / 'server.properties').write_text('''server-name=OrderToCook isolated QA
level-name=otc-qa
gamemode=creative
force-gamemode=true
difficulty=peaceful
allow-cheats=true
max-players=1
online-mode=true
allow-list=true
server-port=24981
server-portv6=24982
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
env = dict(os.environ)
env['LD_LIBRARY_PATH'] = str(runtime)
if args.mode == 'initial':
    # BDS creates the canonical level.dat first, with no addon attached. Only
    # after a clean shutdown do we edit the two required experiment flags.
    bootstrap = subprocess.Popen([str(runtime / 'bedrock_server')], cwd=runtime, stdin=subprocess.PIPE,
                                 stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env,
                                 text=True, encoding='utf-8', errors='replace', bufsize=1)
    bootstrap_lines = []
    bootstrap_ready = threading.Event()

    def read_bootstrap():
        for line in bootstrap.stdout:
            bootstrap_lines.append(line.rstrip('\r\n'))
            if 'Server started.' in line:
                bootstrap_ready.set()

    reader = threading.Thread(target=read_bootstrap, daemon=True)
    reader.start()
    deadline = time.monotonic() + args.timeout
    try:
        while bootstrap.poll() is None and not bootstrap_ready.wait(0.25) and time.monotonic() < deadline:
            pass
        if bootstrap.poll() is None:
            bootstrap.stdin.write('stop\n')
            bootstrap.stdin.flush()
            bootstrap.wait(timeout=10)
    except subprocess.TimeoutExpired:
        bootstrap.terminate()
        bootstrap.wait(timeout=5)
    finally:
        if bootstrap.poll() is None:
            bootstrap.kill()
            bootstrap.wait(timeout=5)
        reader.join(timeout=3)
        (runtime / 'native-bootstrap.log').write_text('\n'.join(bootstrap_lines) + '\n', encoding='utf-8')
    if not bootstrap_ready.is_set() or bootstrap.returncode != 0 or not (world / 'level.dat').is_file():
        print('\n'.join(bootstrap_lines[-20:]))
        raise SystemExit('QA world bootstrap did not stop cleanly; addon probe was not started.')
try:
    enable_required_experiments(runtime)
except ValueError as error:
    raise SystemExit('QA experiments were not changed: ' + str(error)) from error
print('Stopped QA world prepared with Beta APIs (gametest) and Points of Interest (poi).', flush=True)
for short, kind in [('BP', 'behavior_packs'), ('RP', 'resource_packs')]:
    destination = runtime / kind / 'otc'
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(ROOT / 'runtime' / short, destination)
    manifest = json.loads((destination / 'manifest.json').read_text())
    if short == 'BP':
        probes = ['bedrock-smoke.js', 'bedrock-customer-checks.js']
        if args.mode == 'initial':
            probes.append('bedrock-poi-checks.js')
        for probe in probes:
            shutil.copyfile(ROOT / 'tests' / probe, destination / 'scripts' / probe)
        entries = ["import './main.js';", "import './bedrock-smoke.js';"]
        if args.mode == 'initial':
            entries.append("import './bedrock-poi-checks.js';")
        (destination / 'scripts/qa-entry.js').write_text('\\n'.join(entries) + '\\n')
        next(module for module in manifest['modules'] if module['type'] == 'script')['entry'] = 'scripts/qa-entry.js'
        (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    (world / ('world_' + kind + '.json')).write_text(json.dumps([{'pack_id': manifest['header']['uuid'], 'version': manifest['header']['version']}]))
source_hash = hashlib.sha256()
for path in sorted((ROOT / 'runtime').rglob('*')):
    if path.is_file():
        source_hash.update(path.relative_to(ROOT).as_posix().encode() + b'\0' + path.read_bytes())
process = subprocess.Popen([str(runtime / 'bedrock_server')], cwd=runtime, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env, bufsize=0)
selector = selectors.DefaultSelector()
selector.register(process.stdout, selectors.EVENT_READ)
started = time.monotonic()
ready_at = None
sent = False
stopping = False
lines = []
pending = b''
report = None
poi_report = None
version = ''
addon_errors = []
def command(text):
    process.stdin.write((text + '\n').encode())
    process.stdin.flush()
try:
    while process.poll() is None and time.monotonic() - started < args.timeout:
        for key, _ in selector.select(timeout=0.25):
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
                if 'Server started.' in line and ready_at is None:
                    ready_at = time.monotonic()
                    command('gamerule doMobSpawning false')
                    command('tickingarea add circle 0 4 0 2 otc_smoke')
                    print('BDS started; preparing loaded QA area.', flush=True)
                if ' ERROR]' in line and any(tag in line for tag in ['[Json]', '[Recipes]', '[Scripting]', '[Blocks]', '[Item]', '[Actor]']):
                    addon_errors.append(line)
                    print(line, flush=True)
                if 'OTC_NATIVE_FATAL ' in line or 'OTC_NATIVE_FAIL ' in line:
                    print(line, flush=True)
                    if 'OTC_NATIVE_FATAL' in line and not stopping:
                        command('stop'); stopping = True
                if 'OTC_POI_REPORT ' in line:
                    raw_json = line.split('OTC_POI_REPORT ', 1)[1]
                    poi_report = json.loads(raw_json[:raw_json.rfind('}') + 1])
                    print(f"Native POI probe: {sum(c['passed'] for c in poi_report['checks'])}/{len(poi_report['checks'])} passed", flush=True)
                if 'OTC_NATIVE_REPORT ' in line:
                    raw_json = line.split('OTC_NATIVE_REPORT ', 1)[1]
                    report = json.loads(raw_json[:raw_json.rfind('}') + 1])
                    print(f"Native probe: {sum(c['passed'] for c in report['checks'])}/{len(report['checks'])} passed", flush=True)
                    command('stop'); stopping = True
        if ready_at and not sent and time.monotonic() - ready_at > 4:
            command('scriptevent ordertocook:qa ' + args.mode)
            sent = True
    if process.poll() is None:
        if not stopping:
            command('stop')
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.terminate(); process.wait(timeout=5)
finally:
    if process.poll() is None:
        process.kill()
    selector.close()
(runtime / f'native-{args.mode}.log').write_text('\n'.join(lines) + '\n', encoding='utf-8')
if report is None:
    print('\n'.join(lines[-35:]))
    raise SystemExit('Native probe did not produce its completion report; see disposable server log.')
pack_version = json.loads((ROOT / 'package.json').read_text())['version']
report.update({'addonVersion': pack_version, 'serverVersion': version, 'runtimeTreeSha256': source_hash.hexdigest(), 'addonErrors': addon_errors,
               'requiredWorldExperiments': ['gametest', 'poi'],
               'scope': 'Native server blocks, entities, inventory and script adapters. No real Player, client rendering, forms, touch/keyboard, or multiplayer latency is exercised.'})
report['passed'] = report['passed'] and not addon_errors
if args.mode == 'initial':
    # A missing POI report is a test failure, not an omitted or old test run.
    report['poiChecks'] = poi_report['checks'] if poi_report else []
    report['poiPassed'] = bool(poi_report and poi_report['passed'] and len(poi_report['checks']) == 10)
    report['passed'] = report['passed'] and report['poiPassed']
output = ROOT / 'docs/validation' / pack_version
output.mkdir(exist_ok=True, parents=True)
(output / f'native-{args.mode}.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
if not report['passed']:
    raise SystemExit('Native probe has failures.')
