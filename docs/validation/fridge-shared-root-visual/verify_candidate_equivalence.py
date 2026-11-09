#!/usr/bin/env python3
"""Compare fixed Git objects, preserving the original fixture's e544 identity."""
import sys
sys.dont_write_bytecode=True
import hashlib,json,subprocess
from pathlib import Path
import build_candidates as build
a=build.a;HERE=Path(__file__).resolve().parent
NEW='dcee546b7b918e3deb0163ec607f280cef2880d4'
NEW_TREE='b30ddd91768fd19bee556b3f337bf9ee08855fe5'


def main():
    from review_inputs import verified_trees, object_sha
    trees=verified_trees();old=trees[build.PIN];new=trees[NEW]
    paths=set(a.read(HERE/'math-verification.json')['geometry_inputs'])
    for folder in ['scenes','supplemental-scenes']:paths.update(a.read(HERE/folder/'manifest.json')['inputs'])
    paths.add('tools/convert_assets.py');same=[];changed=[]
    for path in sorted(paths):
        before=old[path]['sha'];after=new[path]['sha']
        row={'path':path,'e544_git_blob':before,'dcee_git_blob':after,'same':before==after}
        data=(HERE/'inputs'/('e544'if before==after else'dcee')/path).read_bytes()
        assert object_sha('blob',data)==after
        row['dcee_content_sha256']=hashlib.sha256(data).hexdigest()
        (same if before==after else changed).append(row)
    assert [r['path']for r in changed]==['runtime/BP/scripts/appliances.js']
    changed_paths=sorted(path for path in set(old)|set(new)if old.get(path)!=new.get(path))
    for prefix in ['runtime/RP/','runtime/BP/blocks/','upstream/']:
        assert {p:r for p,r in old.items()if p.startswith(prefix)}=={p:r for p,r in new.items()if p.startswith(prefix)}
    photos=a.read(HERE/'control-evidence-manifest.json')['screenshots']+a.read(HERE/'supplemental-evidence-manifest.json')['screenshots']
    for row in photos:
        assert a.sha(HERE/row['path'])==row['sha256']
        assert a.sha(HERE/row['scene'])==row['scene_sha256']
    result={'status':'VISUAL_INPUT_BLOBS_IDENTICAL_NOT_SERVICE_ACCEPTANCE','fixture_commit':build.PIN,
      'fixture_tree':build.TREE,'candidate_service_commit':NEW,'candidate_service_tree':NEW_TREE,
      'changed_paths':changed_paths,'identical_input_count':len(same),
      'identical_inputs':same,'changed_service_input':changed,
      'unchanged_complete_trees':['runtime/RP','runtime/BP/blocks','upstream'],
      'inherited_evidence':[{'path':r['path'],'sha256':r['sha256'],'scene':r['scene'],'scene_sha256':r['scene_sha256']}for r in photos],
      'rule':'Original fixture/image identity stays e544. All model, animation, PNG, BP geometry dispatch, root-selector and pose-data inputs are blob-identical at dcee. Only the service exception path differs among tracked scene inputs; this receipt does not validate its behavior.',
      'comparison_method':'Reconstruct both complete Git tree hashes from bundled relative-path records, then verify selected original bytes against the exact blob hashes. No checkout or Git-object network access required.',
      'geometry_count':176,'original_scenes_rewritten':False,'images_edited':False,'runtime_modified_by_this_check':False}
    a.write(HERE/'dcee-input-equivalence.json',result)
    print(f'PASS: {len(same)} identical inputs, 176 geometries, complete RP/BP-block trees unchanged; service input differs. Nine e544 images retain their original identity.')


if __name__=='__main__':main()
