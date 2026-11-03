# SPDX-License-Identifier: GPL-3.0-only
"""Prepare only the marked disposable world used by bedrock_smoke.py."""
from pathlib import Path
import os
import struct
import tempfile

MARKER_NAME = '.ordertocook-qa-runtime'
MARKER_TEXT = 'Disposable Order To Cook QA runtime.\n'
REQUIRED_EXPERIMENTS = ('gametest', 'poi', 'experiments_ever_used', 'saved_with_toggled_experiments')


def assert_server_stopped(runtime):
    """The Linux-only BDS runner must not edit a world owned by a running server."""
    for process in Path('/proc').iterdir():
        if not process.name.isdecimal():
            continue
        try:
            command = (process / 'cmdline').read_bytes().split(b'\0', 1)[0]
            if Path(os.fsdecode(command)).name != 'bedrock_server':
                continue
            if (process / 'cwd').resolve(strict=True) == runtime.resolve():
                raise ValueError(f'Refusing to modify a running BDS runtime (PID {process.name}).')
        except (FileNotFoundError, ProcessLookupError):
            continue
        except PermissionError as error:
            raise ValueError('Cannot confirm that the BDS runtime is stopped.') from error


def validate_qa_runtime(runtime, mode):
    if not (runtime / 'bedrock_server').is_file():
        raise ValueError('Provide a fresh extracted Linux Bedrock Dedicated Server directory.')
    worlds = runtime / 'worlds'
    world = worlds / 'otc-qa'
    marker = runtime / MARKER_NAME
    if worlds.is_symlink() or world.is_symlink() or marker.is_symlink():
        raise ValueError('Refusing a symlinked QA world or marker.')
    if worlds.exists() and any(path.name != 'otc-qa' for path in worlds.iterdir()):
        raise ValueError('Refusing to use a directory containing a non-QA world.')
    marked = marker.is_file() and marker.read_text() == MARKER_TEXT
    if marker.exists() and not marked:
        raise ValueError('Refusing an unrecognized QA runtime marker.')
    if world.exists() and not marked:
        raise ValueError('Refusing an unmarked existing QA world; use a fresh extracted server directory.')
    if mode != 'initial' and (not marked or not (world / 'level.dat').is_file()):
        raise ValueError('Reload/upgrade requires a marked QA world from an initial run.')
    assert_server_stopped(runtime)
    return world, marker


def required_experiment_data(data):
    """Preserve all unrelated little-endian NBT bytes; reject malformed input."""
    if len(data) < 9 or struct.unpack_from('<I', data, 4)[0] != len(data) - 8:
        raise ValueError('Invalid Bedrock level.dat header or payload length.')
    payload = data[8:]

    def bounds(offset, size):
        if offset < 0 or size < 0 or offset + size > len(payload):
            raise ValueError('Truncated or invalid level.dat NBT.')
        return offset + size

    def string_end(offset):
        bounds(offset, 2)
        return bounds(offset + 2, struct.unpack_from('<H', payload, offset)[0])

    def skip(tag, offset, depth=0):
        if depth > 128:
            raise ValueError('Unexpectedly deep level.dat NBT.')
        sizes = {1: 1, 2: 2, 3: 4, 4: 8, 5: 4, 6: 8}
        if tag in sizes:
            return bounds(offset, sizes[tag])
        if tag == 8:
            return string_end(offset)
        if tag in (7, 11, 12):
            bounds(offset, 4)
            count = struct.unpack_from('<i', payload, offset)[0]
            return bounds(offset + 4, count * {7: 1, 11: 4, 12: 8}[tag])
        if tag == 9:
            bounds(offset, 5)
            item_tag = payload[offset]
            count = struct.unpack_from('<i', payload, offset + 1)[0]
            if count < 0 or count > len(payload):
                raise ValueError('Invalid level.dat NBT list length.')
            offset += 5
            for _ in range(count):
                offset = skip(item_tag, offset, depth + 1)
            return offset
        if tag == 10:
            while payload[bounds(offset, 1) - 1]:
                offset = skip(payload[offset], string_end(offset + 1), depth + 1)
            return offset + 1
        raise ValueError(f'Unknown level.dat NBT tag {tag}.')

    def named(offset):
        tag = payload[bounds(offset, 1) - 1]
        start = string_end(offset + 1)
        name = payload[offset + 3:start].decode('utf-8')
        return tag, name, start, skip(tag, start)

    if payload[0] != 10 or skip(10, string_end(1)) != len(payload):
        raise ValueError('Invalid level.dat root compound.')
    offset = string_end(1)
    experiment_span = None
    while payload[offset]:
        tag, name, start, end = named(offset)
        if name == 'experiments':
            if tag != 10 or experiment_span is not None:
                raise ValueError('Invalid or duplicate experiments compound.')
            experiment_span = (start, end)
        offset = end
    if experiment_span is None:
        raise ValueError('Generated world has no experiments compound; refusing to guess its format.')
    start, end = experiment_span
    entries = {}
    offset = start
    while payload[offset]:
        tag, name, child_start, child_end = named(offset)
        if name in entries or (name in REQUIRED_EXPERIMENTS and tag != 1):
            raise ValueError('Invalid or duplicate experiment flag.')
        entries[name] = payload[offset:child_end]
        offset = child_end
    for name in REQUIRED_EXPERIMENTS:
        encoded = name.encode('utf-8')
        entries[name] = b'\x01' + struct.pack('<H', len(encoded)) + encoded + b'\x01'
    result = payload[:start] + b''.join(entries.values()) + b'\0' + payload[end:]
    return data[:4] + struct.pack('<I', len(result)) + result


def enable_required_experiments(runtime):
    world, _ = validate_qa_runtime(runtime, 'reload')
    path = world / 'level.dat'
    if path.is_symlink():
        raise ValueError('Refusing a symlinked QA level.dat.')
    original = path.read_bytes()
    updated = required_experiment_data(original)
    if updated == original:
        return
    backup = world / 'level.dat.before-required-experiments'
    if not backup.exists():
        with backup.open('xb') as output:
            output.write(original)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=world, prefix='level.dat.qa-', delete=False) as output:
            temporary = Path(output.name)
            output.write(updated)
            output.flush()
            os.fsync(output.fileno())
        temporary.chmod(path.stat().st_mode & 0o777)
        assert_server_stopped(runtime)
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
