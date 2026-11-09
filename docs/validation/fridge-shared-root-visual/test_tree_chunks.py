#!/usr/bin/env python3
"""Offline regressions for the exact-byte Git-tree record envelope."""
import sys
sys.dont_write_bytecode=True
import copy,hashlib,json,shutil,tempfile,unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch
import review_inputs as inputs


class TreeChunkTests(unittest.TestCase):
    @contextmanager
    def fixture(self):
        with tempfile.TemporaryDirectory(prefix='otc-tree-chunks-')as temporary:
            root=Path(temporary)/'provenance'
            shutil.copytree(inputs.HERE/'provenance',root)
            yield root

    def index(self,root):
        return json.loads((root/'git-trees.json').read_bytes())

    def write_index(self,root,index):
        (root/'git-trees.json').write_text(json.dumps(index)+'\n')

    def test_original_bytes_semantics_and_all_three_tree_hashes_remain_exact(self):
        data=inputs.tree_record_bytes();records=json.loads(data)
        self.assertEqual(len(data),857501)
        self.assertEqual(hashlib.sha256(data).hexdigest(),inputs.ORIGINAL_TREE_RECORD['sha256'])
        self.assertEqual(inputs.object_sha('blob',data),inputs.ORIGINAL_TREE_RECORD['git_blob_sha1'])
        semantic=json.dumps(records,sort_keys=True,separators=(',',':')).encode()
        self.assertEqual(hashlib.sha256(semantic).hexdigest(),'c86779776f77dc6c37bceda50859d14be28cf2bafad0d01160779a739b8612e2')
        self.assertEqual({key:len(row['entries'])for key,row in records.items()},
                         {inputs.PIN:1364,inputs.NEW:1364,inputs.FREEZE:1365})
        verified=inputs.verified_trees()
        for commit,expected in inputs.TREES.items():
            self.assertEqual(inputs.tree_sha(records[commit]['entries']),expected)
            self.assertEqual(verified[commit],{row['path']:row for row in records[commit]['entries']})
        with self.fixture()as root:
            with patch.object(inputs,'HERE',root.parent):
                self.assertEqual(inputs.verified_trees(),verified)

    def test_missing_extra_and_directory_chunks_are_rejected(self):
        for mutation in ['missing','extra','directory','hidden']:
            with self.subTest(mutation=mutation),self.fixture()as root:
                folder=root/'git-tree-chunks';first=folder/'part-0000.jsonpart'
                if mutation=='missing':first.unlink()
                elif mutation=='extra':(folder/'part-9999.jsonpart').write_bytes(b'')
                elif mutation=='hidden':(folder/'.extra').write_bytes(b'')
                else:first.unlink();first.mkdir()
                with self.assertRaises(ValueError):inputs.tree_record_bytes(root)

    def test_bad_index_count_order_paths_fields_and_identity_are_rejected(self):
        mutations={
            'missing-row':lambda x:x['chunks'].pop(),
            'extra-row':lambda x:x['chunks'].append(copy.deepcopy(x['chunks'][0])),
            'reverse':lambda x:x['chunks'].reverse(),
            'duplicate-path':lambda x:x['chunks'][1].update(path=x['chunks'][0]['path']),
            'traversal':lambda x:x['chunks'][0].update(path='../part-0000.jsonpart'),
            'absolute':lambda x:x['chunks'][0].update(path='/part-0000.jsonpart'),
            'alias':lambda x:x['chunks'][0].update(path='git-tree-chunks/./part-0000.jsonpart'),
            'format':lambda x:x.update(format='unknown'),
            'extra-index-field':lambda x:x.update(unlisted=True),
            'extra-chunk-field':lambda x:x['chunks'][0].update(unlisted=True),
            'length':lambda x:x['chunks'][0].update(bytes=1),
            'hash':lambda x:x['chunks'][0].update(sha256='0'*64),
            'source':lambda x:x['source'].update(sha256='0'*64),
        }
        for name,mutate in mutations.items():
            with self.subTest(mutation=name),self.fixture()as root:
                index=self.index(root);mutate(index);self.write_index(root,index)
                with self.assertRaises(ValueError):inputs.tree_record_bytes(root)

    def test_corrupt_truncated_and_oversized_chunks_are_rejected(self):
        for mutation in ['corrupt','truncated','oversized']:
            with self.subTest(mutation=mutation),self.fixture()as root:
                first=root/'git-tree-chunks/part-0000.jsonpart';data=first.read_bytes()
                if mutation=='corrupt':data=bytes([data[0]^1])+data[1:]
                elif mutation=='truncated':data=data[:-1]
                else:data+=b' '
                first.write_bytes(data)
                with self.assertRaises(ValueError):inputs.tree_record_bytes(root)

    def test_matching_changed_chunk_hash_cannot_change_original_record(self):
        with self.fixture()as root:
            first=root/'git-tree-chunks/part-0000.jsonpart';data=first.read_bytes()
            first.write_bytes(bytes([data[0]^1])+data[1:])
            index=self.index(root);index['chunks'][0]['sha256']=hashlib.sha256(first.read_bytes()).hexdigest()
            self.write_index(root,index)
            with self.assertRaisesRegex(ValueError,'Reassembled tree record hash changed'):
                inputs.tree_record_bytes(root)

    def test_linked_index_chunk_or_chunk_directory_is_rejected(self):
        for relative in ['git-trees.json','git-tree-chunks/part-0000.jsonpart','git-tree-chunks']:
            with self.subTest(path=relative),self.fixture()as root:
                target=root/relative;backup=root.parent/'saved';target.rename(backup)
                target.symlink_to(backup,target_is_directory=backup.is_dir())
                with self.assertRaises(ValueError):inputs.tree_record_bytes(root)

    def test_duplicate_index_keys_and_oversized_index_are_rejected(self):
        for mutation in ['duplicate','oversized']:
            with self.subTest(mutation=mutation),self.fixture()as root:
                target=root/'git-trees.json';data=target.read_text()
                if mutation=='duplicate':data=data.replace('{','{"format":"duplicate",',1)
                else:data+=' '*inputs.CHUNK_BYTES
                target.write_text(data)
                with self.assertRaises(ValueError):inputs.tree_record_bytes(root)


if __name__=='__main__':unittest.main(verbosity=2)
