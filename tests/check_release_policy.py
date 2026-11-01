#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Exercise the real checker after a build, without publishing or changing tags."""
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
register_path = ROOT / "docs/ASSET_LICENSE_REGISTER.json"
original_register = register_path.read_bytes()
status = json.loads(original_register)["rightsChainStatus"]
if status not in ("PENDING_RIGHTS_HOLDER_CONFIRMATION", "CONFIRMED"):
    raise SystemExit("Resolve the recorded rights conflict before this release-policy test.")

def run(tag):
    result = subprocess.run(
        [sys.executable, "tools/check_compliance.py", "--release"], cwd=ROOT,
        env={**os.environ, "GITHUB_REF_NAME": tag}, text=True,
        capture_output=True, check=False,
    )
    try:
        report = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise AssertionError(result.stdout + result.stderr) from exc
    return result, report

correct, report = run(f"v{version}")
assert correct.returncode == 0, report
assert report["releaseMode"] is True and report["errors"] == [], report
assert report["rightsChainStatus"] == status, report
if status == "PENDING_RIGHTS_HOLDER_CONFIRMATION":
    assert any("not a development or release blocker" in warning for warning in report["warnings"]), report
wrong, report = run("not-the-package-tag")
assert wrong.returncode != 0, "A wrong tag must still fail."
assert any("Release tag does not match" in error for error in report["errors"]), report
assert register_path.read_bytes() == original_register, "Validation must not manufacture a permission record."
print("PASS: pending clarification is advisory; matching tag passes; wrong tag fails; rights evidence unchanged.")
