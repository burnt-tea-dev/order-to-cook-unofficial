#!/usr/bin/env python3
"""Reproduce the fridge-only documentation checks without GUI or network."""
import sys
sys.dont_write_bytecode=True
import hashlib,json,subprocess
from pathlib import Path
from PIL import Image
HERE=Path(__file__).resolve().parent


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    hashes=json.loads((HERE/'files.sha256.json').read_text())
    for path,digest in hashes.items():assert sha(HERE/path)==digest,('Changed review artifact',path)
    steps=[]
    for script in ['test_tree_chunks.py','verify_candidate_math.py','verify_control_evidence.py','verify_candidate_equivalence.py','verify_freeze_equivalence.py','verify_calibration.py']:
        result=subprocess.run([sys.executable,'-B',str(HERE/script)],check=True,capture_output=True,text=True)
        steps.append({'script':script,'exit_code':result.returncode})
    index=json.loads((HERE/'index.json').read_text())
    assert index['candidate_fixtures']==7 and index['candidate_photographs']==9
    assert len(index['files'])==7 and len(index['photographs'])==9
    seen=set()
    for entry in index['files']:
        assert sha(HERE/entry['path'])==entry['sha256'];seen.add(entry['path'])
    supplemental=json.loads((HERE/'supplemental-evidence-manifest.json').read_text())
    assert len(supplemental['screenshots'])==5
    for row in supplemental['screenshots']:
        assert row['scene']in seen and sha(HERE/row['scene'])==row['scene_sha256']
        assert sha(HERE/row['path'])==row['sha256']
        with Image.open(HERE/row['path'])as im:assert im.format=='JPEG'and im.size==(1188,848)
    for photo in index['photographs']:assert sha(HERE/photo['path'])==photo['sha256']
    assert len(list((HERE/'baseline-evidence').glob('*.jpg')))==4
    # Numerical reports are deterministic and immutable scene/JPEG bytes remain
    # the same after all verification. No crop images are generated.
    for path,digest in hashes.items():assert sha(HERE/path)==digest,('Verifier changed artifact',path)
    private=[]
    for path in HERE.rglob('*'):
        if not path.is_file()or path.suffix.lower()in ['.jpg','.png']:continue
        text=path.read_text(errors='ignore')
        forbidden=['/work'+'space/','/home/'+'agent/']
        if any(token in text for token in forbidden):private.append(str(path.relative_to(HERE)))
    assert not private,('Private execution path in public bundle',private)
    result={'status':'FRIDGE_REVIEW_REPRODUCED_NOT_NATIVE_RUNTIME_ACCEPTANCE','steps':steps,
            'candidate_fixtures':7,'candidate_original_jpegs':9,'baseline_original_jpegs':4,
            'calibration_original_jpegs':len(list((HERE/'calibration/screenshots').glob('*.jpg'))),
            'snapshot_blobs_and_full_tree_hashes_verified':True,'deterministic_reports_and_scene_bytes':True,
            'private_execution_paths_found':0,'gui_operated':False,'runtime_modified':False}
    (HERE/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))


if __name__=='__main__':main()
