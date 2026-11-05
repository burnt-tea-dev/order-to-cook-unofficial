#!/usr/bin/env python3
"""Run the native probe in a disposable extracted BDS directory (no clients).

The BDS binary is supplied by the developer from Minecraft's official download;
it is never distributed with this project. This tests native server APIs and
saved-world restoration, not client rendering, menus, or keyboard/touch input.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import selectors
import socket
import shutil
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--server-dir', type=Path, required=True)
parser.add_argument('--mode', choices=['initial', 'reload', 'upgrade'], default='initial')
parser.add_argument('--suite', choices=['full', 'stove', 'fridge'], default='full')
parser.add_argument('--output-dir', type=Path, help='Report directory; stove defaults to docs/validation/stove-integration, without replacing historical reports.')
parser.add_argument('--timeout', type=int, default=75)
parser.add_argument('--offline', action='store_true', help='Loopback-only isolated network namespace required')
parser.add_argument('--world-metadata', type=Path, help='Initial QA level.dat only; no world DB is copied')
args = parser.parse_args()
if args.offline:
    if os.readlink('/proc/self/ns/net') == os.readlink('/proc/1/ns/net') or {name for _, name in socket.if_nameindex()} != {'lo'}:
        raise SystemExit('Offline QA requires a loopback-only network namespace')
if args.suite == 'stove' and args.mode == 'upgrade':
    raise SystemExit('The stove probe supports initial and reload; it has no historical upgrade fixture.')
runtime = args.server_dir.resolve()
if not (runtime / 'bedrock_server').is_file():
    raise SystemExit('Provide a fresh extracted Linux Bedrock Dedicated Server directory.')
existing = list((runtime / 'worlds').iterdir()) if (runtime / 'worlds').exists() else []
if any(path.name != 'otc-qa' for path in existing):
    raise SystemExit('Refusing to use a directory containing a non-QA world.')
world = runtime / 'worlds' / 'otc-qa'
marker = runtime / '.ordertocook-qa-runtime'
if args.mode != 'initial' and not (world / 'level.dat').is_file():
    raise SystemExit('Reload/upgrade requires an existing QA world from a successful initial run.')
if args.mode == 'initial' and world.exists():
    if not marker.exists():
        raise SystemExit('Refusing to reset an unmarked existing QA world; use a fresh extracted server directory.')
    shutil.rmtree(world)
marker.write_text('Disposable Order To Cook QA runtime.\n')
world.mkdir(parents=True, exist_ok=True)
if args.mode == 'initial' and args.world_metadata is not None:
    shutil.copy2(args.world_metadata, world / 'level.dat')
for short, kind in [('BP', 'behavior_packs'), ('RP', 'resource_packs')]:
    destination = runtime / kind / 'otc'
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(ROOT / 'runtime' / short, destination)
    manifest = json.loads((destination / 'manifest.json').read_text())
    if short == 'BP':
        probes = (['bedrock-fridge-compaction-checks.js'] if args.suite == 'fridge' else
                  ['bedrock-stove-smoke.js'] if args.suite == 'stove' else ['bedrock-smoke.js', 'bedrock-customer-checks.js'])
        for probe in probes:
            shutil.copyfile(ROOT / 'tests' / probe, destination / 'scripts' / probe)
        (destination / 'scripts/qa-entry.js').write_text(f"import './main.js';\nimport './{probes[0]}';\n")
        if args.suite == 'stove':
            # Synthetic supplier items exist only in this disposable test copy.
            # They are never added to runtime/, build.py output, or another Addon.
            for name in ['raw', 'cooked']:
                fixture = {'format_version': '1.21.100', 'minecraft:item': {
                    'description': {'identifier': f'otc_stove_probe:{name}'},
                    'components': {'minecraft:display_name': {'value': f'OTC QA synthetic {name}'},
                                   'minecraft:icon': {'textures': {'default': 'ordertocook_clean_plate'}},
                                   'minecraft:max_stack_size': 64}}}
                (destination / 'items' / f'qa_stove_{name}.json').write_text(json.dumps(fixture, indent=2))
        next(module for module in manifest['modules'] if module['type'] == 'script')['entry'] = 'scripts/qa-entry.js'
        (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    (world / ('world_' + kind + '.json')).write_text(json.dumps([{'pack_id': manifest['header']['uuid'], 'version': manifest['header']['version']}]))
authentication = 'false' if args.offline else 'true'
(runtime / 'server.properties').write_text(f'''server-name=OrderToCook isolated QA
level-name=otc-qa
gamemode=creative
force-gamemode=true
difficulty=peaceful
allow-cheats=true
max-players=1
online-mode={authentication}
allow-list={authentication}
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
source_hash = hashlib.sha256()
for path in sorted((ROOT / 'runtime').rglob('*')):
    if path.is_file():
        source_hash.update(path.relative_to(ROOT).as_posix().encode() + b'\0' + path.read_bytes())
env = dict(os.environ)
env['LD_LIBRARY_PATH'] = str(runtime)
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
report_name = f'native-{args.suite}-{args.mode}' if args.suite != 'full' else f'native-{args.mode}'
(runtime / (report_name + '.log')).write_text('\n'.join(lines) + '\n', encoding='utf-8')
if report is None:
    print('\n'.join(lines[-35:]))
    raise SystemExit('Native probe did not produce its completion report; see disposable server log.')
pack_version = json.loads((ROOT / 'package.json').read_text())['version']
report.update({'addonVersion': pack_version, 'serverVersion': version, 'runtimeTreeSha256': source_hash.hexdigest(), 'addonErrors': addon_errors,
               'scope': 'Native server blocks, entities, inventory and script adapters. No real Player, client rendering, forms, touch/keyboard, or multiplayer latency is exercised.'})
if args.suite == 'stove':
    report.update({'suite': 'stove', 'qaSourceSha256': {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
                   for name in ['tools/bedrock_smoke.py', 'tests/bedrock-stove-smoke.js']},
                   'scope': 'Real BDS ItemStacks, inventories, block states, main scheduling and supplier script-event ingress. Most edge cases use a controlled service clock over native objects. Initial/reload are separate server processes with real disk persistence. Two synthetic QA item IDs only; this does not certify an installed Grilling pack, real Player forms, client rendering/sound, or physical chunk unload.'})
report['passed'] = report['passed'] and not addon_errors
output = args.output_dir.resolve() if args.output_dir else ROOT / 'docs/validation' / (args.suite + '-integration' if args.suite != 'full' else pack_version)
output.mkdir(exist_ok=True, parents=True)
(output / (report_name + '.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
if not report['passed']:
    raise SystemExit('Native probe has failures.')
