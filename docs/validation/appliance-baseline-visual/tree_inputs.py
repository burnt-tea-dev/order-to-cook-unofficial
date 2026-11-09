"""Use the adjacent reviewed chunk loader with this baseline's fixed identity.

The shared loader has a fixed module-level record pin. Load a separate instance
instead of changing the live shared module or duplicating its validation logic.
No repository, network or application process is needed.
"""
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
SHARED = HERE.parent / 'fridge-shared-root-visual'
ORIGINAL_TREE_RECORD = {
    'bytes': 456347,
    'sha256': 'c891d6cbac98c32d2ec728f57a39503893d547896ddfd60923acbeff7170ade1',
    'git_blob_sha1': '265bc7f373b237e03791048555b7b957780d595e',
}
_spec = importlib.util.spec_from_file_location('appliance_tree_chunk_loader', SHARED / 'review_inputs.py')
_loader = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_loader)
_loader.ORIGINAL_TREE_RECORD = ORIGINAL_TREE_RECORD.copy()
CHUNK_BYTES = _loader.CHUNK_BYTES
unique_object = _loader.unique_object


def tree_record_bytes(provenance=None):
    return _loader.tree_record_bytes(HERE / 'provenance' if provenance is None else provenance)
