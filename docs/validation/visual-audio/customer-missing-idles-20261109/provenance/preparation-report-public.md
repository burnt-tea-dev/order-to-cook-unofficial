> Public projection of the historical preparation document, not its original bytes. Original SHA-256: ad765cec993b125d01479ccbfc40a2f9af2a847214c90d0602e28877932a39d4; length: 3556 bytes. Only review-routing prose is generalized; pending-GUI status and evidence claims are unchanged. The original is not reconstructed by this projection.

# Result and next step

Four new source/RP static scenes are ready for an independent copy
replay, then GUI review. They cover the two previously unsampled full posture
combinations, customer_wait_2 and customer_sit_3, on both wide and slim rigs.
No runtime change or native acceptance is proposed.

## Frozen scenes

- scenes/01_wide_wait2_head_query.bbmodel
  SHA-256 fc95a0c1e7f4a07bc8689b1fcd1ae81ebd1800d97686c455dbad1e972fa38e31
- scenes/02_slim_wait2_head_query.bbmodel
  SHA-256 072e6cb4f681f9b61d25d840b30a5796e562500afa256ff3b02acae9388fdf32
- scenes/03_wide_sit3_body_query.bbmodel
  SHA-256 c714e37176d13a924b239b9da2aa26110a7238eb84bbe47f6fe605f70961d5ec
- scenes/04_slim_sit3_body_query.bbmodel
  SHA-256 b023f7b525a22b410c07f046a4e2a6809b21788f451fdb380c8da43b95e715ae

Wait2: 0.375 local seconds, head-only query, symmetric -15-degree hanging arms,
straight legs. Sit3: 0.5833 local seconds, body query, seated legs, exact authored
left-arm splay [-157.5348,-6.8699,16.134]. All use synthetic target_x_rotation=15
and target_y_rotation=-30. These values do not prove native query conventions.

## Executed checks

- All 17 earlier inputs freshly checked against clean current main dbb2574.
  Sixteen are unchanged. Converter bytes changed only in make_motorcycle_geo
  by AST comparison; this is context-only motorcycle work, never executed here.
- Independent source/RP Decimal timeline oracle, 1,280 actual serialized-world
  corner checks, 960 independent face-UV records, 80 bone-parent edges, preserved
  cube ordering, inflate, original PNG bytes and physical/virtual 64x64 textures.
  Maximum corner-component error: 4.440892098500626e-15 model units.
- 248 globally unique group/cube UUIDs; complete unique outliner membership and
  correct parents. Seven targeted malformed-structure controls rejected.
- 52 hand-stated pose/default landmarks; four swapped-query-bone controls
  rejected. Sit3 correctly has nonzero body rotation, unlike the prior check.
- Each new pose differs from every declared same-rig previous sample in the
  bounded set of 29. This does not claim all-time novelty or native parity.
- Fresh-process builder reproduces the exact four scenes, four samples and
  scene manifest. Earlier 73 preparation files still match their frozen hashes.
- Source/RP use one common ordinary-cube editor renderer, SOURCE X=-20 and
  RP X=+20; screen sides remain camera-dependent. Default textures/Auto sides.

## Verifier commands

From this directory, using existing Python, NumPy, Pillow and Node:

```sh
python -B verify_review.py
python -B verify_selection.py
python -B verify_frozen.py
```

Do not run build_review.py in the original frozen directory. It is invoked only
inside the verifier's fresh temporary copy. preparation/ contains archived
one-shot setup/edit provenance, not runnable verifier entry points.

README.md gives the full evidence scope, source/decoder licensing/provenance,
landmarks and limitations. GUI_REVIEW.md is the camera/identity checklist.
scene-freeze-hashes.json binds scene, sample and manifest bytes;
artifact-hashes.json freezes this preparation before GUI handoff. Later captures
and receipts belong separately, without rewriting the preparation claims.

No GUI, Java/Bedrock native renderer, Minecraft client, BDS, LIVE, user-local
machine, full playback, transitions, query behavior, riding alignment, multiplayer,
late join, sound, particles or transparency/culling acceptance occurred here.
All four GUI observations remain pending. No blocker or denied action occurred.
