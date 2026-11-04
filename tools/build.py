#!/usr/bin/env python3
"""Produce deterministic .mcpack / .mcaddon files with source and license notices."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text())['version']
baseline = json.loads((ROOT / 'baseline.json').read_text())
release_key = '.'.join(map(str, baseline['version']))
history = json.loads((ROOT / 'release-history.json').read_text())
if release_key != VERSION.split('-')[0] or history.get(release_key) != baseline['source_trees']:
    raise SystemExit('Build identity must match baseline.json and append-only release-history.json')
OUT = ROOT / 'dist'
OUT.mkdir(exist_ok=True)
# A branch QA package must name its real source commit, not direct reviewers to
# a Release tag that has not been created. Dirty local builds retain the runtime
# content fingerprint below instead of falsely attributing edited bytes to HEAD.
try:
    source_revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    source_dirty = bool(subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=normal'], cwd=ROOT, text=True).strip())
except (OSError, subprocess.CalledProcessError):
    source_revision, source_dirty = None, True
source_identity = (f'Exact source commit: https://github.com/burnt-tea-dev/order-to-cook-unofficial/tree/{source_revision}\n'
                   if source_revision and not source_dirty else
                   'Local working-tree candidate; use build-info.json runtimeTreeSha256 and the accompanying source/PR.\n')
def zip_bytes(entries):
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(entries.items()):
            info = zipfile.ZipInfo(name, (2026, 10, 9, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    return buffer.getvalue()
packs = {}
for short in ['BP', 'RP']:
    pack = ROOT / 'runtime' / short
    entries = {path.relative_to(pack).as_posix(): path.read_bytes() for path in pack.rglob('*') if path.is_file()}
    rows = {name: hashlib.sha256(data).hexdigest() for name, data in entries.items()}
    tree = {'sha256': hashlib.sha256(json.dumps(rows, sort_keys=True, separators=(',', ':')).encode()).hexdigest(), 'files': len(rows)}
    if tree != baseline['source_trees'][short]:
        raise SystemExit(f'{short} payload changed; freeze a fresh paired release identity before exporting')
    for filename in ['LICENSE', 'THIRD_PARTY_NOTICES.md']:
        entries[filename] = (ROOT / filename).read_bytes()
    for legal_doc in ['docs/ASSET_LICENSE_REGISTER.md', 'docs/RELEASE_COMPLIANCE.md']:
        entries['LEGAL/' + Path(legal_doc).name] = (ROOT / legal_doc).read_bytes()
    entries['SOURCE.txt'] = (f'Complete corresponding source and build tools:\nhttps://github.com/burnt-tea-dev/order-to-cook-unofficial\n{source_identity}Version identity: v{VERSION} (this build does not create or assert a published Release tag).\n\nOriginal project: Order To Cook / 下单了\nOriginal author: breezeth (breezeth-CN)\nUpstream: https://github.com/breezeth-CN/OrdertoCook\nUpstream source commit: e59e3dbcabe19b783d9adb933db5fcb8bc1e4642\nLicense: GNU GPL version 3 (GPL-3.0-only adaptation)\nOriginal release page: https://www.curseforge.com/minecraft/mc-mods/order-to-cook\n\nThis package is an unofficial modified Bedrock adaptation, not the original Java mod. It is not affiliated with or endorsed by Mojang Studios / Microsoft or the original author.\n').encode()
    data = zip_bytes(entries)
    name = f'OrderToCook-{short}-{VERSION}.mcpack'
    (OUT / name).write_bytes(data)
    packs[name] = data
addon_name = f'OrderToCook-Bedrock-{VERSION}.mcaddon'
(OUT / addon_name).write_bytes(zip_bytes(packs))
checksums = []
for name in sorted([*packs, addon_name]):
    path = OUT / name
    checksums.append(hashlib.sha256(path.read_bytes()).hexdigest() + '  ' + path.name)
(OUT / 'SHA256SUMS.txt').write_text('\n'.join(checksums) + '\n')
source_hash = hashlib.sha256()
for path in sorted((ROOT / 'runtime').rglob('*')):
    if path.is_file():
        source_hash.update(path.relative_to(ROOT).as_posix().encode() + b'\0' + path.read_bytes())
result = {'version': VERSION, 'sourceRepository': 'https://github.com/burnt-tea-dev/order-to-cook-unofficial', 'sourceTag': f'v{VERSION}', 'sourceRevision': source_revision if not source_dirty else None, 'sourceDirty': source_dirty, 'addon': addon_name, 'runtimeTreeSha256': source_hash.hexdigest(), 'files': checksums}
(OUT / 'build-info.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
