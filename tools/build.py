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
OUT = ROOT / 'dist'
OUT.mkdir(exist_ok=True)
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
    for filename in ['LICENSE', 'THIRD_PARTY_NOTICES.md']:
        entries[filename] = (ROOT / filename).read_bytes()
    entries['SOURCE.txt'] = ('Complete corresponding source and build tools:\nhttps://github.com/casama233/order-to-cook-unofficial\n\nUpstream: https://github.com/breezeth-CN/OrdertoCook\nCommit: e59e3dbcabe19b783d9adb933db5fcb8bc1e4642\n\nThis package contains a modified Bedrock adaptation, not the original Java mod.\n').encode()
    data = zip_bytes(entries)
    name = f'OrderToCook-{short}-{VERSION}.mcpack'
    (OUT / name).write_bytes(data)
    packs[name] = data
addon_name = f'OrderToCook-Bedrock-{VERSION}.mcaddon'
(OUT / addon_name).write_bytes(zip_bytes(packs))
checksums = []
for path in sorted(OUT.iterdir()):
    if path.suffix in ['.mcpack', '.mcaddon']:
        checksums.append(hashlib.sha256(path.read_bytes()).hexdigest() + '  ' + path.name)
(OUT / 'SHA256SUMS.txt').write_text('\n'.join(checksums) + '\n')
source_hash = hashlib.sha256()
for path in sorted((ROOT / 'runtime').rglob('*')):
    if path.is_file():
        source_hash.update(path.relative_to(ROOT).as_posix().encode() + b'\0' + path.read_bytes())
result = {'version': VERSION, 'addon': addon_name, 'runtimeTreeSha256': source_hash.hexdigest(), 'files': checksums}
(OUT / 'build-info.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
