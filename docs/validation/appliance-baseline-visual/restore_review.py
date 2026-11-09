#!/usr/bin/env python3
"""Restore byte-identical large review files into a new, separate directory."""
import sys
sys.dont_write_bytecode = True
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import zlib

HERE = Path(__file__).resolve().parent
SHARED = HERE.parent / 'fridge-shared-root-visual'
INDEX_SHA256 = '6258ac3b1148e375ae3836e85497539022c1915da76bdab532a47515490b0cd4'
MAX_STORED_BYTES = 61440
MAX_ORIGINAL_BYTES = 1024 * 1024
MAX_TOTAL_BYTES = 10 * 1024 * 1024
FILE_COUNT = 35


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def blob_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate index object key')
        result[key] = value
    return result


def relative_path(value):
    require(isinstance(value, str) and value and not value.startswith('/'), 'Unsafe original path')
    require(not any(c in value for c in '\\:\x00\r\n'), 'Unsafe original path')
    require(all(part not in ('', '.', '..') for part in value.split('/')), 'Unsafe original path')
    return value


def regular_file(path, maximum):
    require(path.is_file() and not path.is_symlink(), 'Missing or linked packed file')
    require(path.stat().st_size <= maximum, 'Oversized packed file')
    return path.read_bytes()


def packed_records(bundle=HERE):
    """Authenticate all stored and original bytes before any output is created."""
    bundle = Path(bundle)
    require(bundle.is_dir() and not bundle.is_symlink(), 'Missing or linked bundle')
    packed = bundle / 'packed-inputs'; folder = packed / 'data'
    require(packed.is_dir() and not packed.is_symlink(), 'Missing or linked packed directory')
    require(folder.is_dir() and not folder.is_symlink(), 'Missing or linked data directory')
    require({p.name for p in packed.iterdir()} == {'index.json', 'data'}, 'Missing or extra packed entry')
    raw = regular_file(packed / 'index.json', MAX_STORED_BYTES)
    index = json.loads(raw, object_pairs_hook=unique_object)
    require(digest(raw) == INDEX_SHA256, 'Packed index identity changed')
    require(isinstance(index, dict) and set(index) == {'format', 'files'}, 'Unexpected index fields')
    require(index['format'] == 'ordertocook.gzip-review-inputs.v1', 'Unknown packed format')
    rows = index['files']
    require(isinstance(rows, list) and len(rows) == FILE_COUNT, 'Wrong packed file count')
    names = [f'{i:04d}.gz' for i in range(FILE_COUNT)]
    require({p.name for p in folder.iterdir()} == set(names), 'Missing or extra gzip file')
    result = []; paths = []; total = 0
    for row, name in zip(rows, names):
        require(isinstance(row, dict) and set(row) == {'path', 'bytes', 'sha256', 'git_blob_sha1', 'stored_path', 'stored_bytes', 'stored_sha256'}, 'Unexpected file fields')
        path = relative_path(row['path']); paths.append(path)
        require(row['stored_path'] == 'data/' + name, 'Unsafe or out-of-order stored path')
        require(type(row['bytes']) is int and 0 < row['bytes'] <= MAX_ORIGINAL_BYTES, 'Unsafe original size')
        require(type(row['stored_bytes']) is int and 0 < row['stored_bytes'] <= MAX_STORED_BYTES, 'Unsafe stored size')
        total += row['bytes']; require(total <= MAX_TOTAL_BYTES, 'Unsafe total original size')
        compressed = regular_file(folder / name, MAX_STORED_BYTES)
        require(len(compressed) == row['stored_bytes'] and digest(compressed) == row['stored_sha256'], 'Stored gzip identity changed')
        decoder = zlib.decompressobj(wbits=31)
        data = decoder.decompress(compressed, row['bytes'] + 1)
        require(len(data) == row['bytes'] and decoder.eof and not decoder.unused_data and not decoder.unconsumed_tail, 'Invalid or oversized gzip stream')
        require(digest(data) == row['sha256'] and blob_sha(data) == row['git_blob_sha1'], 'Original file identity changed')
        result.append((row, data))
    require(paths == sorted(set(paths)), 'Duplicate or out-of-order original path')
    require(not any(str(parent) in paths for path in paths for parent in Path(path).parents if str(parent) != '.'), 'Conflicting original paths')
    return result


def no_links(root):
    require(root.is_dir() and not root.is_symlink(), 'Missing or linked source directory')
    require(not any(p.is_symlink() for p in root.rglob('*')), 'Linked source entry')


def validate_restored(bundle=HERE):
    no_links(Path(bundle))
    records = packed_records(bundle)
    for row, data in records:
        path = Path(bundle) / row['path']
        require(regular_file(path, MAX_ORIGINAL_BYTES) == data, 'Restored original bytes changed')
    return records


def restore_bundle(destination, bundle=HERE, shared=SHARED):
    """Never overwrite a destination or modify either source bundle."""
    bundle = Path(bundle); shared = Path(shared)
    requested = Path(destination).absolute()
    # Check the original spelling before resolve() can erase a linked component
    # such as link/../output. Containment must then use canonical paths, not the
    # lexical Path.absolute() form, which retains '..'. Do this before writing.
    require(not any(p.is_symlink() for p in [requested, *requested.parents]), 'Linked output path')
    destination = requested.resolve()
    sources = [p.resolve() for p in [bundle, shared]]
    require(not any(destination.is_relative_to(p) or p.is_relative_to(destination) for p in sources), 'Output must be outside the source bundles')
    require(not destination.exists(), 'Output must be a new directory')
    require(destination.parent.is_dir(), 'Output parent must already exist')
    no_links(bundle); no_links(shared)
    bundle, shared = sources
    records = packed_records(bundle)
    for row, data in records:
        source = bundle / row['path']
        require(not source.exists() or regular_file(source, MAX_ORIGINAL_BYTES) == data, 'Existing original differs from packed bytes')
    destination.mkdir()
    restored = destination / 'appliance-baseline-visual'
    shutil.copytree(bundle, restored)
    shutil.copytree(shared, destination / 'fridge-shared-root-visual')
    for row, data in records:
        path = restored / row['path']
        if path.exists():
            require(path.read_bytes() == data, 'Copied original bytes changed')
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('xb') as output:
            output.write(data)
    validate_restored(restored)
    receipt = {'status': 'EXACT_REVIEW_BYTES_RESTORED_NOT_NATIVE_ACCEPTANCE',
               'restored_files': len(records), 'restored_bytes': sum(len(data) for _, data in records),
               'index_sha256': INDEX_SHA256, 'originals_changed': False, 'gui_operated': False}
    (destination / 'RESTORED.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return restored


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='New output directory; parent must exist. Omit to use a new temporary directory.')
    args = parser.parse_args()
    destination = args.output if args.output is not None else Path(tempfile.mkdtemp(prefix='otc-appliance-review-')) / 'review'
    restored = restore_bundle(destination)
    print(f'Exact review files restored to {restored}')
    print('Open the desired scenes/*.bbmodel there. This command does not launch an editor.')


if __name__ == '__main__':
    main()
