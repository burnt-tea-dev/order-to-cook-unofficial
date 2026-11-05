#!/usr/bin/env python3
"""Exercise the real scope helper against real Git commits, not copied rules."""
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ci_scope', ROOT / 'tools/ci_scope.py')
scope = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scope)


class ScopeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='otc-ci-scope-')
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.git('init', '-q')
        self.git('config', 'user.name', 'CI scope test')
        self.git('config', 'user.email', 'ci-scope@example.invalid')
        self.git('config', 'commit.gpgsign', 'false')
        for path in ['README.md', 'CHANGELOG.md', 'runtime/BP/scripts/main.js',
                     'docs/PARITY.md', 'docs/validation/native.json']:
            self.write(path, 'original\n')
        self.base = self.commit()

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.repo, stderr=subprocess.DEVNULL).decode().strip()

    def write(self, name, text='changed\n'):
        path = self.repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def commit(self):
        self.git('add', '-A')
        self.git('commit', '-qm', 'scope fixture')
        return self.git('rev-parse', 'HEAD')

    def required(self, head, base=None, event='pull_request', ref='refs/pull/1/merge'):
        base = self.base if base is None else base
        payload = {'pull_request': {'base': {'sha': base}}} if event == 'pull_request' else {'before': base}
        return scope.full_runtime_required(self.repo, event, ref, head, payload)

    def test_real_prose_and_observation_diff_skips_runtime_on_pr_and_main_push(self):
        for path in ['README.md', 'CHANGELOG.md', 'docs/PARITY.md', 'docs/validation/native.json']:
            self.write(path)
        head = self.commit()
        self.assertFalse(self.required(head))
        self.assertFalse(self.required(head, event='push', ref='refs/heads/main'))

    def test_runtime_resources_tools_workflow_release_and_unknown_paths_stay_full(self):
        for path in ['runtime/BP/scripts/main.js', 'runtime/RP/textures/new.png', 'assets/guidebook/zh_TW.lang',
                     'tools/new.py', '.github/workflows/build.yml', 'package.json', 'baseline.json',
                     'release-history.json', 'release.json', 'docs/RELEASE_COMPLIANCE.md',
                     'docs/ASSET_LICENSE_REGISTER.json', 'THIRD_PARTY_NOTICES.md', 'docs/unreviewed.md',
                     'docs/validation/screenshot.png', 'unknown.md']:
            with self.subTest(path=path):
                base = self.git('rev-parse', 'HEAD')
                self.write(path)
                self.assertTrue(self.required(self.commit(), base))

    def test_renaming_source_into_a_report_exposes_the_old_source_path(self):
        self.git('mv', 'runtime/BP/scripts/main.js', 'docs/validation/moved.md')
        self.assertTrue(self.required(self.commit()))

    def test_renaming_pure_prose_and_deleting_prose_remain_docs_only(self):
        self.git('mv', 'README.md', 'docs/validation/readme.md')
        (self.repo / 'docs/PARITY.md').unlink()
        self.assertFalse(self.required(self.commit()))

    def test_missing_base_history_empty_diff_and_invalid_refs_fail_closed(self):
        self.write('README.md')
        head = self.commit()
        for base in ['0' * 40, 'f' * 40, 'not-a-revision', head]:
            with self.subTest(base=base):
                self.assertTrue(self.required(head, base))
        self.assertTrue(scope.full_runtime_required(self.repo, 'pull_request', 'refs/pull/1/merge', head, {}))

    def test_tags_dispatch_unknown_events_and_non_main_push_always_run_full(self):
        self.write('README.md')
        head = self.commit()
        for event, ref in [('push', 'refs/tags/v0.1.21'), ('workflow_dispatch', 'refs/heads/main'),
                           ('unknown', 'refs/heads/main'), ('push', 'refs/heads/other')]:
            with self.subTest(event=event, ref=ref):
                self.assertTrue(self.required(head, event=event, ref=ref))

    def test_non_regular_doc_modes_are_not_treated_as_pure_prose(self):
        (self.repo / 'README.md').unlink()
        (self.repo / 'README.md').symlink_to('runtime/BP/scripts/main.js')
        self.assertTrue(self.required(self.commit()))

    def test_cli_missing_or_malformed_event_keeps_full_checks(self):
        event_path = self.repo / 'event.json'
        for contents in ['not json', '[]', '{"pull_request": false}']:
            event_path.write_text(contents)
            env = {**os.environ, 'GITHUB_EVENT_PATH': str(event_path),
                   'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_REF': 'refs/pull/1/merge', 'GITHUB_SHA': self.base}
            output = subprocess.check_output(['python3', str(ROOT / 'tools/ci_scope.py')], env=env, text=True)
            self.assertEqual(output, 'full=true\n')


if __name__ == '__main__':
    unittest.main()
