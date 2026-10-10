#!/usr/bin/env python3
"""Stage only verified build outputs, preserving older versioned packages."""
from pathlib import Path
import hashlib
import json
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = ROOT / "artifacts"
VERSION = json.loads((ROOT / "package.json").read_text())["version"]
if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?", VERSION):
    raise ValueError("Unsafe package version")
info = json.loads((DIST / "build-info.json").read_text())
if info["version"] != VERSION:
    raise ValueError("Build version does not match source")
expected = {
    f"OrderToCook-BP-{VERSION}.mcpack",
    f"OrderToCook-RP-{VERSION}.mcpack",
    f"OrderToCook-Bedrock-{VERSION}.mcaddon",
}
checksums = (DIST / "SHA256SUMS.txt").read_text().splitlines()
verified = set()
for line in checksums:
    digest, name = line.split("  ", 1)
    if name not in expected or name in verified:
        raise ValueError("Unexpected or duplicate build artifact")
    if hashlib.sha256((DIST / name).read_bytes()).hexdigest() != digest:
        raise ValueError(f"Checksum mismatch: {name}")
    verified.add(name)
if verified != expected or info["files"] != checksums:
    raise ValueError("Incomplete build artifacts")
OUT.mkdir(exist_ok=True)
old_info_path = OUT / "build-info.json"
if old_info_path.exists():
    old_info = json.loads(old_info_path.read_text())
    old_version = old_info["version"]
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?", old_version):
        raise ValueError("Unsafe archived package version")
    if old_version != VERSION:
        for name, archived in [
            ("build-info.json", f"build-info-{old_version}.json"),
            ("SHA256SUMS.txt", f"SHA256SUMS-{old_version}.txt"),
        ]:
            source, destination = OUT / name, OUT / archived
            if destination.exists() and destination.read_bytes() != source.read_bytes():
                raise ValueError(f"Existing archive differs: {archived}")
            shutil.copyfile(source, destination)
for name in sorted(expected | {"SHA256SUMS.txt", "build-info.json"}):
    shutil.copyfile(DIST / name, OUT / name)
print(f"Staged {VERSION}; older versioned downloads were retained.")
