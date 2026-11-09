#!/usr/bin/env python3
"""Offline bounded-gzip, original-byte and safe-output regressions."""
import sys
sys.dont_write_bytecode = True
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from contextlib import contextmanager
from unittest.mock import patch
import restore_review as restore


class RestoreReviewTests(unittest.TestCase):
    @contextmanager
    def fixture(self):
        with tempfile.TemporaryDirectory(prefix='appliance-packed-test-') as temporary:
            root = Path(temporary) / 'bundle'; root.mkdir()
            shutil.copytree(restore.HERE / 'packed-inputs', root / 'packed-inputs')
            yield root

    def index(self, root):
        return json.loads((root / 'packed-inputs/index.json').read_bytes())

    def write_index(self, root, index):
        raw = (json.dumps(index, indent=2) + '\n').encode()
        (root / 'packed-inputs/index.json').write_bytes(raw)
        return restore.digest(raw)

    def test_exact_originals_and_deterministic_gzip(self):
        records = restore.packed_records()
        self.assertEqual(len(records), 35)
        self.assertEqual(sum(len(data) for _, data in records), 10453599)
        self.assertEqual(sum(row['stored_bytes'] for row, _ in records), 794840)
        self.assertEqual(max(row['stored_bytes'] for row, _ in records), 41657)
        for row, data in records:
            stored = (restore.HERE / 'packed-inputs' / row['stored_path']).read_bytes()
            self.assertEqual(gzip.decompress(stored), data)
            self.assertEqual(stored[9], 255)  # normalized OS byte, not a machine identifier
            self.assertEqual(stored[4:8], b'\0' * 4)
            self.assertFalse(stored[3] & 8)  # no filename / machine path
            self.assertEqual(restore.digest(data), row['sha256'])
            self.assertEqual(restore.blob_sha(data), row['git_blob_sha1'])

    def test_new_output_restores_all_original_paths_without_source_changes(self):
        with self.fixture() as root:
            shared = root.parent / 'shared'; shared.mkdir(); (shared / 'sentinel').write_bytes(b'shared')
            (root / 'small.txt').write_bytes(b'original small file')
            before = {str(p.relative_to(root)): p.read_bytes() for p in root.rglob('*') if p.is_file()}
            output = root.parent / 'new-output'
            restored = restore.restore_bundle(output, root, shared)
            self.assertEqual(len(restore.validate_restored(restored)), 35)
            self.assertEqual((restored / 'small.txt').read_bytes(), b'original small file')
            self.assertEqual((output / 'fridge-shared-root-visual/sentinel').read_bytes(), b'shared')
            self.assertEqual({str(p.relative_to(root)): p.read_bytes() for p in root.rglob('*') if p.is_file()}, before)
            # A previously restored directory can be copied again, never overwritten.
            again = restore.restore_bundle(root.parent / 'again', restored, shared)
            self.assertEqual(len(restore.validate_restored(again)), 35)

    def test_existing_or_linked_output_and_source_conflicts_are_rejected(self):
        for mutation in ['existing-directory', 'existing-file', 'linked-parent', 'dangling-output', 'source-original', 'inside-source']:
            with self.subTest(mutation=mutation), self.fixture() as root:
                shared = root.parent / 'shared'; shared.mkdir()
                output = root.parent / 'output'
                if mutation == 'existing-directory': output.mkdir(); (output / 'sentinel').write_bytes(b'keep')
                elif mutation == 'existing-file': output.write_bytes(b'keep')
                elif mutation == 'linked-parent':
                    link = root.parent / 'link'; link.symlink_to(shared, target_is_directory=True); output = link / 'output'
                elif mutation == 'dangling-output': output.symlink_to(root.parent / 'absent')
                elif mutation == 'source-original':
                    row = self.index(root)['files'][0]; p = root / row['path']; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(b'wrong')
                else: output = root / 'nested-output'
                with self.assertRaises(ValueError): restore.restore_bundle(output, root, shared)
                if mutation == 'existing-directory': self.assertEqual((output / 'sentinel').read_bytes(), b'keep')
                if mutation == 'existing-file': self.assertEqual(output.read_bytes(), b'keep')
                if mutation in ['source-original', 'inside-source']: self.assertFalse(output.exists())

    def test_output_dotdot_aliases_preserve_both_sources(self):
        def snapshot(root):
            return {str(p.relative_to(root)): p.read_bytes() if p.is_file() else None
                    for p in root.rglob('*')}
        for target in ['bundle', 'shared', 'source-itself', 'source-parent', 'linked-ancestor', 'safe-external']:
            with self.subTest(target=target), self.fixture() as root:
                shared = root.parent / 'shared'; shared.mkdir(); (shared / 'sentinel').write_bytes(b'keep')
                sibling = root.parent / 'sibling'; sibling.mkdir()
                alias = sibling / '..' / target / 'bad-output'
                if target == 'source-itself': alias = sibling / '..' / root.name
                elif target == 'source-parent': alias = sibling / '..'
                elif target == 'linked-ancestor':
                    link = root.parent / 'link'; link.symlink_to(sibling, target_is_directory=True)
                    alias = link / '..' / 'linked-output'
                elif target == 'safe-external': alias = sibling / '..' / 'safe-output'
                before = [snapshot(root), snapshot(shared)]
                if target == 'safe-external':
                    restored = restore.restore_bundle(alias, root, shared)
                    self.assertEqual(restored, root.parent / 'safe-output/appliance-baseline-visual')
                    self.assertEqual(len(restore.validate_restored(restored)), 35)
                else:
                    # A regression must fail safely rather than recursively copy
                    # a source into a newly created descendant of itself.
                    with patch.object(restore.shutil, 'copytree', side_effect=AssertionError('Unsafe copy attempted')) as copied:
                        with self.assertRaises(ValueError): restore.restore_bundle(alias, root, shared)
                        copied.assert_not_called()
                    if target in ['bundle', 'shared', 'linked-ancestor']:
                        self.assertFalse(alias.resolve().exists())
                self.assertEqual([snapshot(root), snapshot(shared)], before)

    def test_missing_extra_linked_and_oversized_stored_objects_are_rejected(self):
        for mutation in ['missing', 'extra', 'hidden', 'directory', 'index-link', 'file-link', 'folder-link', 'packed-extra', 'oversized']:
            with self.subTest(mutation=mutation), self.fixture() as root:
                packed = root / 'packed-inputs'; folder = packed / 'data'; first = folder / '0000.gz'
                if mutation == 'missing': first.unlink()
                elif mutation == 'extra': (folder / '9999.gz').write_bytes(b'')
                elif mutation == 'hidden': (folder / '.extra').write_bytes(b'')
                elif mutation == 'directory': first.unlink(); first.mkdir()
                elif mutation == 'packed-extra': (packed / 'extra').write_bytes(b'')
                elif mutation == 'oversized': first.write_bytes(b'X' * (restore.MAX_STORED_BYTES + 1))
                else:
                    target = packed / 'index.json' if mutation == 'index-link' else folder if mutation == 'folder-link' else first
                    backup = root.parent / 'saved'; target.rename(backup); target.symlink_to(backup, target_is_directory=backup.is_dir())
                with self.assertRaises(ValueError): restore.packed_records(root)

    def test_index_identity_and_duplicate_json_keys_are_rejected(self):
        for mutation in ['changed', 'duplicate', 'oversized']:
            with self.subTest(mutation=mutation), self.fixture() as root:
                p = root / 'packed-inputs/index.json'; raw = p.read_text()
                if mutation == 'changed': raw += ' '
                elif mutation == 'duplicate': raw = raw.replace('{', '{"format":"duplicate",', 1)
                else: raw += ' ' * restore.MAX_STORED_BYTES
                p.write_text(raw)
                with self.assertRaises(ValueError): restore.packed_records(root)

    def test_index_structure_and_paths_even_if_index_pin_is_replaced(self):
        mutations = {
            'missing': lambda x: x['files'].pop(),
            'extra': lambda x: x['files'].append(x['files'][0]),
            'format': lambda x: x.update(format='unknown'),
            'extra-field': lambda x: x.update(extra=True),
            'entry-field': lambda x: x['files'][0].update(extra=True),
            'traversal': lambda x: x['files'][0].update(path='../outside'),
            'absolute': lambda x: x['files'][0].update(path='/outside'),
            'alias': lambda x: x['files'][0].update(path='scenes/./file'),
            'backslash': lambda x: x['files'][0].update(path='scenes\\file'),
            'stored-traversal': lambda x: x['files'][0].update(stored_path='../0000.gz'),
            'stored-order': lambda x: x['files'].reverse(),
            'duplicate-original': lambda x: x['files'][1].update(path=x['files'][0]['path']),
            'boolean-size': lambda x: x['files'][0].update(bytes=True),
            'huge-original': lambda x: x['files'][0].update(bytes=restore.MAX_ORIGINAL_BYTES + 1),
            'huge-stored': lambda x: x['files'][0].update(stored_bytes=restore.MAX_STORED_BYTES + 1),
        }
        for name, mutate in mutations.items():
            with self.subTest(mutation=name), self.fixture() as root:
                index = self.index(root); mutate(index); pin = self.write_index(root, index)
                with patch.object(restore, 'INDEX_SHA256', pin), self.assertRaises(ValueError): restore.packed_records(root)

    def test_corruption_truncation_expansion_trailing_and_changed_original_are_rejected(self):
        for mutation in ['corrupt', 'truncated', 'expanded', 'trailing', 'second-member', 'changed-original']:
            with self.subTest(mutation=mutation), self.fixture() as root:
                index = self.index(root); row = index['files'][0]; p = root / 'packed-inputs' / row['stored_path']; data = p.read_bytes()
                if mutation == 'corrupt': data = bytes([data[0] ^ 1]) + data[1:]
                elif mutation == 'truncated': data = data[:-1]
                elif mutation == 'trailing': data += b'trailing'
                elif mutation == 'second-member': data += gzip.compress(b'extra', mtime=0)
                else:
                    original = gzip.decompress(data)
                    original = original + b'x' if mutation == 'expanded' else bytes([original[0] ^ 1]) + original[1:]
                    data = gzip.compress(original, compresslevel=9, mtime=0)
                p.write_bytes(data)
                row.update(stored_bytes=len(data), stored_sha256=restore.digest(data))
                pin = self.write_index(root, index)
                with patch.object(restore, 'INDEX_SHA256', pin), self.assertRaises((ValueError, restore.zlib.error)): restore.packed_records(root)

    def test_source_and_restored_intermediate_symlinks_are_rejected(self):
        with self.fixture() as root:
            shared = root.parent / 'shared'; shared.mkdir()
            (root / 'linked').symlink_to(shared, target_is_directory=True)
            with self.assertRaises(ValueError): restore.restore_bundle(root.parent / 'new', root, shared)
            with self.assertRaises(ValueError): restore.validate_restored(root)


if __name__ == '__main__': unittest.main(verbosity=2)
