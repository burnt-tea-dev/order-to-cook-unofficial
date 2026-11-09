# Independent expectation and coordinate provenance

The expectation never imports or executes convert_assets.py, normalize_geo,
bake_pose, render_visual_review.py, or any prior source sampler. The strict
hand-stated clip schema in oracle.py is first compared with the saved source JSON.
This prevents the prompt's sample numbers from becoming unverified authority.

## Dynamic key value, then interpolation

Pinned Gecko sources under `source/gecko/`:
- `AnimationController.java:582` binds ANIM_TIME to adjusted clip ticks /20.
- `:717–738` reads current keyframe startValue.get()/endValue.get() at the
  evaluation time, then converts rotation units/signs. Values are not frozen
  at the timestamp of the first key.
- `BakedAnimationsAdapter.java:194–215` constructs previous/current values,
  defaults to LINEAR and converts seconds to ticks. Static X/Y rotations have
  negative signs; Z is positive. Dynamic X/Y receive the same sign in controller.
- `SinDegrees.java:21` implements sin(arg/180*pi).
- `EasingType.java:64–90` applies the linear currentTick/transitionLength ratio.

Therefore printer's Z is 5*sin_deg(1000t)*(1-t/.4167) until .4167, then zero;
bag and plate Z are 3*sin_deg(1000t)*(1-t/.5) until .5, then zero.
Source scale is ordinary linear interpolation of the exact authored keys:
printer (0,.95),(.125,1.05),(.25,.95),(.375,1);
bag (0,.85),(.1667,1.1),(.3333,.95),(.5,1);
plate substitutes 1.05 at .1667. Printer paper is [0,-2+9t,-.75+3.75t].
Bag/plate root position is [0,.5-t,0]. Hold endpoints are clamped as authored.

The runtime plate sample separately reads its actual RP channel arrays and
performs the specified interpolation. Its anim_time_update expression is checked
but not executed as an engine clock. Source root positions/scales/rotations are
not inferred from the runtime result.

## Renderer, hierarchy and physical UVs

The three registrations are saved in OTC `OrderToCookModClient.java:153–155`.
Their saved GeoModel classes select the exact source geo, animation and PNG.
`OrderMachineRenderer` supplies the idle paper suppression and waiting override.
FoodPlatePlacedRenderer gates stage-zero placement and adds no custom transform.

`GeoBlockRenderer.java:146–159,201–214` translates (.5,0,.5) blocks then rotates
by facing, with NORTH=0 degrees. Review coordinates are centered block-local
model pixels, so common X/Z block-centering cancels; Java Y remains zero.
`GeoRenderer` traverses the source hierarchy using `RenderUtils.prepMatrixForBone`.
`RenderUtils.java:42–111` supplies the matrix sequence
T(position reflected X) * T(pivot) * Rz * Ry * Rx * S * T(-pivot).
Cube-local rotation is applied before the parent chain. Cube scale is not a
lossy Euler decomposition. Only uniform root scaling occurs in these inputs.

`BakedModelFactory.java` was retrieved at the exact Gecko 4.8.3 commit for this
package. Bone pivot is [-x,y,z]; cube minimum is [-originX-sizeX,originY,originZ].
Both bone/cube rotations map to [-rx,-ry,rz]. VertexSet supplies all eight physical
vertices and the exact per-face corner identity; GeoQuad and FaceUV supply the
UV assignment. Their exact Git blobs and SHA-256 identities are recorded in input-manifest.json. This
covers source rest geometry as well as the animation signs, rather than assuming
that raw JSON orientation is the final renderer convention.

Official Blockbench 5.2.2 `bedrock.js` parseCube/parseBone uses the same origin and
angle mapping and reverses the up/down UV rectangle endpoints. Generic/free uses
per_texture_uv_size; the format default Euler order is ZYX (format.ts:717).
The builder is checked against exact official parseCube in a data-only harness.
The numeric harness loads no GUI application, custom plugin or remote prompt.
GUI evidence is pending and is not included in this package.

The independent source oracle applies matrices to original source corners. The
editor builder instead embeds the uniform scale and child translation in cube
origins/sizes/pivots while preserving bone/cube rotations and hierarchy; the
verifier reconstructs each finished bbmodel's group chain and compares it back
to the original oracle. Actual printer/bag RP geometry is read, not regenerated.
For plate, both source and RP frozen animation embeddings are checked against
their unbaked hierarchy, then the RP parent +.2 model pixels is applied outside
that animation. Common support slab tops remain Y=0 on both sides.

Every original/runtime input here uses explicit per-face UV. There are no
box-UV/mirror/inflate/rescale/shade overrides to approximate. Fail-closed
assertions reject those if introduced. Negative UV extents are preserved.
Each physical face corner's UV is matched, not just the unordered rectangle.
For plate, actual atlas U/V is source U/V+[2,2]; dimensions are source32×32 and
atlas256×256. Full corresponding RGBA tile bytes also match. Original PNG bytes
are embedded without conversion or resizing.

Material identity is retained separately from preview: Java GeoModel default
entityCutoutNoCull, runtime terrain alpha_test and entity_alphatest. Double in
both editor halves is a declared comparison control, not a native material
emulator. Native actor yaw, contact appearance and all temporal semantics remain
outside this static proof. The numeric checks make no screenshot or camera claim.
GUI observations and actual camera settings are pending and not included.

## Public package and replay boundary

Source, runtime, texture and scene bytes are unchanged from the frozen preparation.
Acquisition paths and unrelated reports are omitted. The public input and scene
manifests are declared projections, with original manifest hashes retained in
`provenance.json`. They are not presented as the unmodified acquisition records.
The saved `validation.json` is the original successful numeric-only run, and its
`gui_run: false` describes that run. GUI evidence remains pending; no captures
are included in this package.

`verify_integrity.py` checks the full package inventory, relative paths, exact input
SHA-256/Git blobs, source-map selection and scene identities before the numeric
verifier invokes the official parseCube excerpt. It rejects missing, extra,
changed or symlinked files and paths outside this package. No network, production
converter, installed Blockbench application or renderer is used. Run Python with
`-B`; verification writes only its report to stdout. Pillow and Node must already
be available. Hashes are consistency checks, not a signature or fresh remote audit.
