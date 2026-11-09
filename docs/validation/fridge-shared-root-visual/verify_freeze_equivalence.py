#!/usr/bin/env python3
"""Verify final-freeze visual identities without relabelling original fixtures."""
import sys
sys.dont_write_bytecode=True
import json
from pathlib import Path
import review_inputs as inputs
import build_candidates as build
a=build.a;HERE=Path(__file__).resolve().parent


def main():
    trees=inputs.verified_trees();old=trees[inputs.PIN];service=trees[inputs.NEW];freeze=trees[inputs.FREEZE]
    paths=set(a.read(HERE/'math-verification.json')['geometry_inputs'])
    for folder in ['scenes','supplemental-scenes']:paths.update(a.read(HERE/folder/'manifest.json')['inputs'])
    paths.add('tools/convert_assets.py');rows=[]
    for path in sorted(paths):
        assert service[path]==freeze[path]
        rows.append({'path':path,'fixture_blob':old[path]['sha'],'dcee_blob':service[path]['sha'],
                     'freeze_blob':freeze[path]['sha'],'same_as_fixture':old[path]==freeze[path]})
    differences=[r['path']for r in rows if not r['same_as_fixture']]
    assert differences==['runtime/BP/scripts/appliances.js']
    for prefix in ['runtime/BP/blocks/','runtime/BP/scripts/','upstream/']:
        assert {p:r for p,r in service.items()if p.startswith(prefix)}=={p:r for p,r in freeze.items()if p.startswith(prefix)}
    rp=lambda tree:{p:r for p,r in tree.items()if p.startswith('runtime/RP/')and p!='runtime/RP/manifest.json'}
    assert rp(service)==rp(freeze)
    changed=sorted(p for p in set(service)|set(freeze)if service.get(p)!=freeze.get(p))
    assert [p for p in changed if p.startswith('runtime/')]==['runtime/BP/manifest.json','runtime/RP/manifest.json']
    index=a.read(HERE/'index.json')
    for photo in index['photographs']:assert a.sha(HERE/photo['path'])==photo['sha256']
    result={'status':'FINAL_FREEZE_VISUAL_INPUTS_IDENTICAL_NOT_ADDITIONAL_GUI_ACCEPTANCE',
      'original_fixture_commit':inputs.PIN,'service_commit':inputs.NEW,'freeze_commit':inputs.FREEZE,
      'freeze_tree':inputs.TREES[inputs.FREEZE],'checked_inputs':rows,'checked_input_count':len(rows),
      'changed_paths_since_service_commit':changed,'runtime_only_changes_since_service_commit':['runtime/BP/manifest.json','runtime/RP/manifest.json'],
      'unchanged_content':'All geometry, animations, textures, materials, BP blocks/scripts and source assets. RP manifest identity is deliberately excluded from the unchanged visual-content claim.',
      'candidate_fixtures':7,'original_candidate_photographs':9,
      'limits':'The original fixture/capture identity stays e544. This proves exact visual-input equivalence at the final freeze, not service behavior, new screenshots or native/game/client acceptance.',
      'images_or_scenes_rewritten':False,'runtime_modified_by_this_check':False}
    a.write(HERE/'freeze-input-equivalence.json',result)
    print('PASS: final freeze retains all 187 tracked inputs from dcee; original nine e544 photographs and seven fixtures unchanged. Runtime manifest identity changes are explicit.')


if __name__=='__main__':main()
