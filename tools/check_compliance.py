#!/usr/bin/env python3
"""Validate attribution, per-file asset provenance, packaged legal notices and release rights."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM_COMMIT = "e59e3dbcabe19b783d9adb933db5fcb8bc1e4642"
PENDING = "PENDING_RIGHTS_HOLDER_CONFIRMATION"
parser = argparse.ArgumentParser()
parser.add_argument("--release", action="store_true", help="Fail while upstream asset rights remain unconfirmed")
args = parser.parse_args()
errors, warnings = [], []

def require(condition, message):
    if not condition:
        errors.append(message)

def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"{path.relative_to(ROOT)}: {exc}")
        return {}

register = read_json(ROOT / "docs/ASSET_LICENSE_REGISTER.json")
lock = read_json(ROOT / "upstream/source.lock.json")
ledger = read_json(ROOT / "runtime/asset_conversion_manifest.json")
require(lock.get("commit") == UPSTREAM_COMMIT, "Upstream lock commit changed; review rights register.")
require(ledger.get("revision") == UPSTREAM_COMMIT, "Asset ledger does not match pinned upstream revision.")
require(register.get("upstream", {}).get("commit") == UPSTREAM_COMMIT, "Rights register does not match upstream revision.")
require(register.get("rightsChainStatus") in (PENDING, "CONFIRMED"), "Unknown rights-chain status.")
require((ROOT / "LICENSE").is_file(), "Root GPL LICENSE is missing.")
require("GNU GENERAL PUBLIC LICENSE" in (ROOT / "LICENSE").read_text(encoding="utf-8"), "Root LICENSE is not GPL text.")
notices_path = ROOT / "THIRD_PARTY_NOTICES.md"
notices = notices_path.read_text(encoding="utf-8") if notices_path.exists() else ""
for phrase in ["breezeth", "breezeth-CN", "burnt-tea-dev/order-to-cook-unofficial", "GPL", "unofficial", "Rights-scope verification status"]:
    require(phrase.lower() in notices.lower(), f"THIRD_PARTY_NOTICES.md missing: {phrase}")
for relative in ["docs/ASSET_LICENSE_REGISTER.md", "docs/RELEASE_COMPLIANCE.md", "docs/ASSET_LICENSE_REGISTER.json"]:
    require((ROOT / relative).is_file(), f"Missing compliance document: {relative}")

assets = ledger.get("assets", [])
require(bool(assets), "Asset conversion ledger is empty.")
seen_outputs = set()
type_counts = {}
for item in assets:
    source, output, digest, operation = (item.get("source"), item.get("output"), item.get("sha256"), item.get("operation"))
    require(all(isinstance(value, str) and value for value in [source, output, digest, operation]), f"Incomplete asset ledger entry: {item}")
    require(bool(re.fullmatch(r"[0-9a-f]{64}", digest or "")), f"Invalid source SHA-256: {source}")
    require(output not in seen_outputs, f"Duplicate output path: {output}")
    seen_outputs.add(output)
    require((ROOT / "runtime" / output).is_file(), f"Missing generated asset: runtime/{output}")
    ext = Path(source).suffix.lower()
    type_counts[ext] = type_counts.get(ext, 0) + 1
for ext in [".png", ".ogg", ".json", ".lang"]:
    if type_counts.get(ext, 0):
        warnings.append(f"{type_counts[ext]} upstream {ext} source references are tracked.")
require(type_counts.get(".png", 0) >= 1 and type_counts.get(".ogg", 0) >= 1, "Expected PNG and OGG source assets in ledger.")

guide = (ROOT / "runtime/BP/scripts/main.js").read_text(encoding="utf-8")
for phrase in ["關於與授權", "breezeth", "GPL v3", "非官方", "burnt-tea-dev/order-to-cook-unofficial"]:
    require(phrase in guide, f"In-game legal/about page missing: {phrase}")

build_info = read_json(ROOT / "dist/build-info.json") if (ROOT / "dist/build-info.json").exists() else {}
version = build_info.get("version")
if version:
    required_files = [
        ROOT / "dist" / f"OrderToCook-BP-{version}.mcpack",
        ROOT / "dist" / f"OrderToCook-RP-{version}.mcpack",
        ROOT / "dist" / f"OrderToCook-Bedrock-{version}.mcaddon",
    ]
    for package in required_files:
        require(package.is_file(), f"Missing built package: {package.name}")
    for package in required_files[:2]:
        if package.is_file():
            try:
                with zipfile.ZipFile(package) as archive:
                    names = set(archive.namelist())
                    for name in ["LICENSE", "THIRD_PARTY_NOTICES.md", "SOURCE.txt", "LEGAL/ASSET_LICENSE_REGISTER.md", "LEGAL/RELEASE_COMPLIANCE.md"]:
                        require(name in names, f"{package.name} does not contain {name}")
                    source_text = archive.read("SOURCE.txt").decode("utf-8")
                    for phrase in ["breezeth", "burnt-tea-dev/order-to-cook-unofficial", "GPL", "unofficial"]:
                        require(phrase.lower() in source_text.lower(), f"{package.name} SOURCE.txt missing {phrase}")
            except Exception as exc:
                errors.append(f"{package.name}: {exc}")
    addon = ROOT / "dist" / f"OrderToCook-Bedrock-{version}.mcaddon"
    if addon.is_file():
        try:
            with zipfile.ZipFile(addon) as archive:
                for name in [f"OrderToCook-BP-{version}.mcpack", f"OrderToCook-RP-{version}.mcpack"]:
                    require(name in archive.namelist(), f"MCAddon missing nested pack {name}")
                    if name in archive.namelist():
                        import io
                        with zipfile.ZipFile(io.BytesIO(archive.read(name))) as nested:
                            for legal in ["LICENSE", "THIRD_PARTY_NOTICES.md", "SOURCE.txt", "LEGAL/ASSET_LICENSE_REGISTER.md", "LEGAL/RELEASE_COMPLIANCE.md"]:
                                require(legal in nested.namelist(), f"Nested {name} missing {legal}")
        except Exception as exc:
            errors.append(f"{addon.name}: {exc}")
else:
    warnings.append("No dist build-info.json; package archive checks run after npm run build.")

status = register.get("rightsChainStatus")
if status == PENDING:
    message = "Original asset rights remain pending confirmation from the upstream rights holder."
    if args.release:
        errors.append(message + " Public release is blocked.")
    else:
        warnings.append(message)
elif status != "CONFIRMED":
    errors.append("Rights register must use CONFIRMED or the explicit pending status.")

summary = {
    "upstreamCommit": UPSTREAM_COMMIT,
    "trackedSourceReferences": len(assets),
    "sourceTypeCounts": type_counts,
    "rightsChainStatus": status,
    "releaseMode": args.release,
    "warnings": warnings,
    "errors": errors,
}
print(json.dumps(summary, ensure_ascii=False, indent=2))
sys.exit(1 if errors else 0)
