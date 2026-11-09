"""Portable, exact Git-tree and selected-blob verification for review inputs."""
import hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent
PIN='e544f563062bf92e58afaa057a9ee52fd7ccbdc8'
NEW='dcee546b7b918e3deb0163ec607f280cef2880d4'
FREEZE='e0f7f54e9c85475abf3975e31f96bf8d25f4c1e4'
TREES={PIN:'bb9f843cdb79a9ea9488acf8db67748cb2e69c21',NEW:'b30ddd91768fd19bee556b3f337bf9ee08855fe5',FREEZE:'a523979692bdf30b84ccdcb5bd2d4d79e29aaf29'}
CHUNK_BYTES=60*1024
ORIGINAL_TREE_RECORD={'bytes':857501,
    'sha256':'ca574655d31881372dd738e45a35b8c6a81359063094709bd2de626d2d20afde',
    'git_blob_sha1':'1d78b3013ccb7c17a3ac73b673ef2a02d8347090'}


def object_sha(kind,data):
    return hashlib.sha1(kind.encode()+b' '+str(len(data)).encode()+b'\0'+data).hexdigest()


def tree_sha(entries):
    root={}
    for row in entries:
        parts=row['path'].split('/');node=root
        assert all(part not in ('','.','..')for part in parts)
        for part in parts[:-1]:node=node.setdefault(part,{})
        assert parts[-1]not in node;node[parts[-1]]=(row['mode'],row['sha'])
    def digest(node):
        encoded=[]
        for name,item in sorted(node.items(),key=lambda p:(p[0]+'/'if isinstance(p[1],dict)else p[0]).encode()):
            mode,sha=('40000',digest(item))if isinstance(item,dict)else item
            encoded.append(mode.encode()+b' '+name.encode()+b'\0'+bytes.fromhex(sha))
        return object_sha('tree',b''.join(encoded))
    return digest(root)


def require(condition,message):
    if not condition:raise ValueError(message)


def unique_object(pairs):
    result={}
    for key,value in pairs:
        require(key not in result,'Duplicate JSON object key')
        result[key]=value
    return result


def tree_record_bytes(provenance=None):
    """Reassemble the exact former file, rejecting unlisted or unsafe chunks."""
    provenance=HERE/'provenance' if provenance is None else Path(provenance)
    index_path=provenance/'git-trees.json';folder=provenance/'git-tree-chunks'
    require(index_path.is_file()and not index_path.is_symlink(),'Missing or linked tree index')
    require(index_path.stat().st_size<=CHUNK_BYTES,'Oversized tree index')
    index=json.loads(index_path.read_bytes(),object_pairs_hook=unique_object)
    require(isinstance(index,dict)and set(index)=={'format','source','chunks'},'Unexpected tree index fields')
    require(index['format']=='ordertocook.git-tree-byte-chunks.v1','Unknown tree chunk format')
    require(index['source']==ORIGINAL_TREE_RECORD,'Original tree-record identity changed')
    count=(ORIGINAL_TREE_RECORD['bytes']+CHUNK_BYTES-1)//CHUNK_BYTES
    require(isinstance(index['chunks'],list)and len(index['chunks'])==count,'Wrong tree chunk count')
    names=[f'part-{number:04d}.jsonpart' for number in range(count)]
    require(folder.is_dir()and not folder.is_symlink(),'Missing or linked tree chunk directory')
    require({path.name for path in folder.iterdir()}==set(names),'Missing or extra tree chunk')
    chunks=[]
    for number,(row,name)in enumerate(zip(index['chunks'],names)):
        require(isinstance(row,dict)and set(row)=={'path','bytes','sha256'},'Unexpected chunk fields')
        # Exact ordinal names forbid traversal, absolute paths, aliases and reorder.
        require(row['path']=='git-tree-chunks/'+name,'Unsafe or out-of-order chunk path')
        size=min(CHUNK_BYTES,ORIGINAL_TREE_RECORD['bytes']-number*CHUNK_BYTES)
        require(type(row['bytes'])is int and row['bytes']==size,'Wrong indexed chunk size')
        path=folder/name
        require(path.is_file()and not path.is_symlink(),'Missing or linked tree chunk')
        require(path.stat().st_size==size,'Wrong tree chunk byte length')
        chunk=path.read_bytes()
        require(hashlib.sha256(chunk).hexdigest()==row['sha256'],'Tree chunk hash mismatch')
        chunks.append(chunk)
    data=b''.join(chunks)
    require(len(data)==ORIGINAL_TREE_RECORD['bytes'],'Reassembled tree record length changed')
    require(hashlib.sha256(data).hexdigest()==ORIGINAL_TREE_RECORD['sha256'],'Reassembled tree record hash changed')
    require(object_sha('blob',data)==ORIGINAL_TREE_RECORD['git_blob_sha1'],'Original tree-record Git blob changed')
    return data


def verified_trees():
    data=json.loads(tree_record_bytes(),object_pairs_hook=unique_object);result={}
    require(set(data)==set(TREES),'Missing or extra source tree')
    for commit,expected in TREES.items():
        assert data[commit]['tree']==expected
        assert tree_sha(data[commit]['entries'])==expected
        result[commit]={r['path']:r for r in data[commit]['entries']}
    return result


def verify_snapshot(root):
    trees=verified_trees();rows=json.loads((HERE/'provenance/snapshot-files.json').read_text())
    for path,digest in rows.items():
        data=(root/path).read_bytes()
        assert hashlib.sha256(data).hexdigest()==digest
        assert object_sha('blob',data)==trees[PIN][path]['sha']
    return trees
