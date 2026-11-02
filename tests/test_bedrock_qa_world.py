# SPDX-License-Identifier: GPL-3.0-only
"""World preparation must preserve saves and refuse non-QA/running worlds."""
import importlib.util
from pathlib import Path
import struct
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('bedrock_qa_world', ROOT / 'tools/bedrock_qa_world.py')
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)


def named(tag, name, payload):
    encoded = name.encode()
    return bytes([tag]) + struct.pack('<H', len(encoded)) + encoded + payload


def fixture(flags):
    # Unrelated primitives, arrays, nested compounds and lists must survive
    # byte for byte, including data after the experiments compound.
    nested = named(9, 'list', b'\x03' + struct.pack('<i', 2) + struct.pack('<ii', -4, 9)) + b'\0'
    root = (b'\x0a\x00\x00' + named(8, 'LevelName', b'\x07\x00QA test')
            + named(10, 'before', nested) + named(10, 'experiments', flags + b'\0')
            + named(7, 'after', struct.pack('<i', 3) + b'\x00\xff\x07')
            + named(11, 'ints', struct.pack('<iii', 2, -7, 123))
            + named(12, 'longs', struct.pack('<iq', 1, 2**40)) + b'\0')
    return struct.pack('<II', 10, len(root)) + root


class QaWorldTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.runtime = Path(self.directory.name)
        (self.runtime / 'bedrock_server').write_text('fixture; not executable')
        self.world = self.runtime / 'worlds/otc-qa'
        self.world.mkdir(parents=True)
        self.path = self.world / 'level.dat'
        self.original = fixture(named(1, 'gametest', b'\0') + named(1, 'future_experiment', b'\x01'))
        self.path.write_bytes(self.original)

    def mark(self):
        (self.runtime / qa.MARKER_NAME).write_text(qa.MARKER_TEXT)

    def test_experiment_update_preserves_all_other_nbt_and_is_idempotent(self):
        expected_flags = (named(1, 'gametest', b'\x01') + named(1, 'future_experiment', b'\x01')
                          + b''.join(named(1, flag, b'\x01') for flag in qa.REQUIRED_EXPERIMENTS[1:]))
        updated = qa.required_experiment_data(self.original)
        self.assertEqual(updated, fixture(expected_flags))
        self.assertEqual(qa.required_experiment_data(updated), updated)

    def test_marked_stopped_world_is_backed_up_once(self):
        self.mark()
        qa.enable_required_experiments(self.runtime)
        updated = self.path.read_bytes()
        self.assertNotEqual(updated, self.original)
        backup = self.world / 'level.dat.before-required-experiments'
        self.assertEqual(backup.read_bytes(), self.original)
        qa.enable_required_experiments(self.runtime)
        self.assertEqual(backup.read_bytes(), self.original)
        self.assertEqual(self.path.read_bytes(), updated)

    def test_all_modes_refuse_an_unmarked_existing_world(self):
        for mode in ('initial', 'reload', 'upgrade'):
            with self.subTest(mode=mode), self.assertRaisesRegex(ValueError, 'unmarked'):
                qa.validate_qa_runtime(self.runtime, mode)
        self.assertEqual(self.path.read_bytes(), self.original)

    def test_non_qa_world_and_symlinks_are_refused(self):
        self.mark()
        other = self.runtime / 'worlds/player-world'
        other.mkdir()
        with self.assertRaisesRegex(ValueError, 'non-QA'):
            qa.validate_qa_runtime(self.runtime, 'initial')
        other.rmdir()
        self.path.unlink()
        self.world.rmdir()
        other.mkdir()
        self.world.symlink_to(other, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            qa.validate_qa_runtime(self.runtime, 'reload')

    def test_malformed_save_is_not_changed_or_backed_up(self):
        self.mark()
        malformed = self.original[:-1]
        self.path.write_bytes(malformed)
        with self.assertRaisesRegex(ValueError, 'length'):
            qa.enable_required_experiments(self.runtime)
        self.assertEqual(self.path.read_bytes(), malformed)
        self.assertFalse((self.world / 'level.dat.before-required-experiments').exists())

    def test_missing_experiments_is_not_invented(self):
        root = b'\x0a\x00\x00\x00'
        with self.assertRaisesRegex(ValueError, 'no experiments'):
            qa.required_experiment_data(struct.pack('<II', 10, len(root)) + root)

    def test_running_runtime_is_refused_before_save_changes(self):
        self.mark()
        # argv[0] and cwd model the native Linux process ownership guard.
        process = subprocess.Popen(['bedrock_server', '10'], executable='/bin/sleep', cwd=self.runtime)
        try:
            with self.assertRaisesRegex(ValueError, 'running BDS'):
                qa.enable_required_experiments(self.runtime)
            self.assertEqual(self.path.read_bytes(), self.original)
        finally:
            process.terminate()
            process.wait(timeout=5)


if __name__ == '__main__':
    unittest.main()
