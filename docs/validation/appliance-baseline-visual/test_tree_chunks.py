#!/usr/bin/env python3
"""Offline baseline identity, shared-loader isolation and tamper regressions."""
import sys
sys.dont_write_bytecode = True
import copy
import hashlib
import json
import shutil
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
import tree_inputs as inputs
sys.path.insert(0, str(inputs.SHARED))
import review_inputs as shared

PIN = '625dd3fe0e4cc944240d32678d65c91dc4f5a220'
EQUIVALENT = '11280a09d232a3dd7e7d1e6f5ae42e5a9e5c53d7'
TREES = {PIN: 'fb0bd9b7ccb507fdc28e63699593ea365ba8a141',
         EQUIVALENT: '2df3ee8dbad6bc42c28300af5a86ee2b6309bab2'}


class BaselineTreeChunkTests(unittest.TestCase):
    @contextmanager
    def fixture(self):
        with tempfile.TemporaryDirectory(prefix='appliance-tree-chunks-') as temporary:
            root = Path(temporary) / 'provenance'
            shutil.copytree(inputs.HERE / 'provenance', root)
            yield root

    def test_original_bytes_semantics_and_tree_identities(self):
        data = inputs.tree_record_bytes()
        self.assertEqual(len(data), 456347)
        self.assertEqual(hashlib.sha256(data).hexdigest(), inputs.ORIGINAL_TREE_RECORD['sha256'])
        self.assertEqual(shared.object_sha('blob', data), inputs.ORIGINAL_TREE_RECORD['git_blob_sha1'])
        records = json.loads(data, object_pairs_hook=inputs.unique_object)
        semantic = json.dumps(records, sort_keys=True, separators=(',', ':')).encode()
        self.assertEqual(hashlib.sha256(semantic).hexdigest(), 'd5f6809d43dff943c70ea53c99598503e85eca90b9bce8097acdb8ed96aae04e')
        self.assertEqual(set(records), set(TREES))
        for commit, expected in TREES.items():
            self.assertEqual(len(records[commit]['entries']), 1229)
            self.assertEqual(shared.tree_sha(records[commit]['entries']), expected)
            self.assertEqual(records[commit]['tree'], expected)
            runtime = [dict(row, path=row['path'][8:]) for row in records[commit]['entries'] if row['path'].startswith('runtime/')]
            self.assertEqual(shared.tree_sha(runtime), '22ddad2b2e83a0f7a6e58ae63b73f2c759f332bd')
        with self.fixture() as root:
            self.assertEqual(inputs.tree_record_bytes(root), data)
        self.assertEqual(inputs.CHUNK_BYTES, 61440)
        self.assertEqual(len(list((inputs.HERE / 'provenance/git-tree-chunks').iterdir())), 8)

    def test_shared_loader_identity_is_unchanged_and_records_cannot_be_swapped(self):
        before = shared.ORIGINAL_TREE_RECORD.copy()
        before_bytes = shared.tree_record_bytes()
        inputs.tree_record_bytes()
        self.assertEqual(shared.ORIGINAL_TREE_RECORD, before)
        self.assertEqual(shared.tree_record_bytes(), before_bytes)
        self.assertEqual(len(before_bytes), 857501)
        self.assertEqual(set(shared.verified_trees()), set(shared.TREES))
        with self.assertRaises(ValueError):
            inputs.tree_record_bytes(inputs.SHARED / 'provenance')
        with self.assertRaises(ValueError):
            shared.tree_record_bytes(inputs.HERE / 'provenance')

    def test_index_mutations_are_rejected(self):
        mutations = {
            'missing-row': lambda x: x['chunks'].pop(),
            'extra-row': lambda x: x['chunks'].append(copy.deepcopy(x['chunks'][0])),
            'reverse': lambda x: x['chunks'].reverse(),
            'duplicate-path': lambda x: x['chunks'][1].update(path=x['chunks'][0]['path']),
            'traversal': lambda x: x['chunks'][0].update(path='../part-0000.jsonpart'),
            'absolute': lambda x: x['chunks'][0].update(path='/part-0000.jsonpart'),
            'alias': lambda x: x['chunks'][0].update(path='git-tree-chunks/./part-0000.jsonpart'),
            'format': lambda x: x.update(format='unknown'),
            'extra-field': lambda x: x.update(unlisted=True),
            'extra-chunk-field': lambda x: x['chunks'][0].update(unlisted=True),
            'length': lambda x: x['chunks'][0].update(bytes=1),
            'boolean-length': lambda x: x['chunks'][0].update(bytes=True),
            'hash': lambda x: x['chunks'][0].update(sha256='0' * 64),
            'source': lambda x: x['source'].update(sha256='0' * 64),
        }
        for name, mutate in mutations.items():
            with self.subTest(mutation=name), self.fixture() as root:
                p = root / 'git-trees.json'; index = json.loads(p.read_bytes())
                mutate(index); p.write_text(json.dumps(index) + '\n')
                with self.assertRaises(ValueError): inputs.tree_record_bytes(root)

    def test_missing_extra_corrupt_truncated_and_oversized_chunks_are_rejected(self):
        for mutation in ['missing', 'extra', 'hidden', 'directory', 'corrupt', 'truncated', 'oversized']:
            with self.subTest(mutation=mutation), self.fixture() as root:
                folder = root / 'git-tree-chunks'; first = folder / 'part-0000.jsonpart'
                if mutation == 'missing': first.unlink()
                elif mutation == 'extra': (folder / 'part-9999.jsonpart').write_bytes(b'')
                elif mutation == 'hidden': (folder / '.extra').write_bytes(b'')
                elif mutation == 'directory': first.unlink(); first.mkdir()
                else:
                    data = first.read_bytes()
                    data = bytes([data[0] ^ 1]) + data[1:] if mutation == 'corrupt' else data[:-1] if mutation == 'truncated' else data + b' '
                    first.write_bytes(data)
                with self.assertRaises(ValueError): inputs.tree_record_bytes(root)

    def test_updated_chunk_hash_cannot_replace_original_identity(self):
        with self.fixture() as root:
            first = root / 'git-tree-chunks/part-0000.jsonpart'; data = first.read_bytes()
            first.write_bytes(bytes([data[0] ^ 1]) + data[1:])
            p = root / 'git-trees.json'; index = json.loads(p.read_bytes())
            index['chunks'][0]['sha256'] = hashlib.sha256(first.read_bytes()).hexdigest()
            p.write_text(json.dumps(index) + '\n')
            with self.assertRaisesRegex(ValueError, 'Reassembled tree record hash changed'):
                inputs.tree_record_bytes(root)

    def test_linked_index_chunk_or_chunk_directory_is_rejected(self):
        for relative in ['git-trees.json', 'git-tree-chunks/part-0000.jsonpart', 'git-tree-chunks']:
            with self.subTest(path=relative), self.fixture() as root:
                target = root / relative; backup = root.parent / 'saved'; target.rename(backup)
                target.symlink_to(backup, target_is_directory=backup.is_dir())
                with self.assertRaises(ValueError): inputs.tree_record_bytes(root)

    def test_duplicate_keys_and_oversized_index_are_rejected(self):
        for mutation in ['duplicate', 'oversized']:
            with self.subTest(mutation=mutation), self.fixture() as root:
                target = root / 'git-trees.json'; data = target.read_text()
                data = data.replace('{', '{"format":"duplicate",', 1) if mutation == 'duplicate' else data + ' ' * inputs.CHUNK_BYTES
                target.write_text(data)
                with self.assertRaises(ValueError): inputs.tree_record_bytes(root)


if __name__ == '__main__': unittest.main(verbosity=2)
