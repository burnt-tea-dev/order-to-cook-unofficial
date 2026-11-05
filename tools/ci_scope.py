#!/usr/bin/env python3
"""Skip runtime checks only for known prose/observations; ambiguity stays full."""
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess

# These are not consumed by build.py or the runtime/asset generators. Legal
# notices/registers, release metadata and all unlisted paths stay full. Keep
# this boundary in sync if a tool starts consuming one of these documents.
PROSE = {
    'README.md', 'README.en.md', 'README.zh-CN.md', 'CHANGELOG.md',
    'docs/PARITY.md', 'docs/UPSTREAM_RULES.md', 'docs/RUNTIME_ADAPTATIONS.md',
    'docs/VALIDATION.md', 'docs/PLAYTEST.md', 'docs/VISUAL_AUDIO_PARITY.md',
}


def full_runtime_required(repo, event_name, ref, head, event):
    if not isinstance(ref, str) or ref.startswith('refs/tags/'):
        return True
    if event_name == 'pull_request':
        base = event.get('pull_request', {}).get('base', {}).get('sha')
    elif event_name == 'push' and ref == 'refs/heads/main':
        base = event.get('before')
    else:
        return True  # Tags, dispatch and unknown events always verify runtime.
    if not all(isinstance(sha, str) and re.fullmatch(r'[0-9a-f]{40,64}', sha) and
               set(sha) != {'0'} for sha in (base, head)):
        return True
    try:
        # No rename detection: moving source into docs exposes both deletion
        # and addition, so the old source path cannot disappear from the scope.
        diff = subprocess.check_output(
            ['git', 'diff', '--raw', '-z', '--no-renames', base, head, '--'],
            cwd=repo, stderr=subprocess.DEVNULL)
    except (OSError, subprocess.CalledProcessError):
        return True  # Missing history/base must never turn checks off.
    entries = diff.split(b'\0')
    if not diff or entries[-1] != b'' or len(entries) % 2 != 1:
        return True
    for metadata, raw_path in zip(entries[0:-1:2], entries[1:-1:2]):
        if not re.fullmatch(rb':(?:000000|100644) (?:000000|100644) [0-9a-f]+ [0-9a-f]+ [ADM]', metadata):
            return True
        path = os.fsdecode(raw_path)
        observation = path.startswith('docs/validation/') and PurePosixPath(path).suffix in {'.md', '.json'}
        if path not in PROSE and not observation:
            return True
    return False


def main():
    try:
        event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
        if not isinstance(event, dict):
            raise ValueError('Event is not an object')
        full = full_runtime_required(Path(__file__).resolve().parents[1],
            os.environ.get('GITHUB_EVENT_NAME'), os.environ.get('GITHUB_REF'),
            os.environ.get('GITHUB_SHA'), event)
    except (KeyError, OSError, ValueError, TypeError, AttributeError):
        full = True
    print('full=' + str(full).lower())


if __name__ == '__main__':
    main()
