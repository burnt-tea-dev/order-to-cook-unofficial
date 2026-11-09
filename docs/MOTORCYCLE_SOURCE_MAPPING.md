# Motorcycle neutral source mapping

This is a source-only static geometry/UV correction. It does not establish native
Minecraft rendering parity, repair steering or unsigned-distance wheel animation,
change input/movement behavior, or freeze a new runtime version.

[Nine subsequent Blockbench before/candidate captures](validation/visual-audio/motorcycle-source-mapping-20261109/README.md)
show the static front-structure correction and four candidate color variants.
Their exact fixtures, raw images and read-only verifier are preserved separately;
they do not establish native rendering or vehicle behavior.

## Authority and coordinate frame

The pinned upstream source is OrdertoCook
[e59e3dbcabe19b783d9adb933db5fcb8bc1e4642](https://github.com/breezeth-CN/OrdertoCook/tree/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642).
The Forge 1.20.1 client registers `MotorcycleRenderer::new` and binds its layer to
`MotorcycleModel::getTexturedModelData` in
[OrderToCookModClient.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/OrderToCookModClient.java)
(blob `9ce9ceabf37b4d39a390f75ac44fced8516043fe`). The registered
[renderer](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/render/MotorcycleRenderer.java)
(blob `efa03cf253ed3d5822ff9ed571cd46ce0c78e4d1`) scales `(-1,-1,1)` then
translates `(0,-1.501,0)`. At neutral entity yaw, its model-unit frame is
`(-JavaX, 24.016-JavaY, JavaZ)`.

The independent review common frame is `(JavaX,24-JavaY,JavaZ)`: apply the
Blockbench Bedrock import X reflection and separately normalize the constant
+0.016 vertical offset. That normalization does not account for any tilt or UV
change. Keep it explicit rather than claiming absolute origin identity.

Official, GPL-licensed Blockbench 5.2.2
[Java entity exporter](https://github.com/JannisX11/blockbench/blob/v5.2.2/js/formats/java/modded_entity.ts)
(blob `fe3d0f0a0c24b709516c96dbd76b433d926ab62a`, lines 548–624) supplies an
independent source contract: its Forge 1.17+ template writes CubeListBuilder,
CubeDeformation and PartPose. Exported Java angles are `(-BBx,-BBy,BBz)`, local
Java X is `group.origin.x-cube.to.x`, Y is reflected with a root height of 24,
and Java mirror is the cube's box-UV mirror flag. Inverting these equations,
then reflecting the displayed X axis into the stated common frame, explains
both the angle signs and horizontal UV inversion/east-west exchange. The
[official license](https://github.com/JannisX11/blockbench/blob/v5.2.2/LICENSE.MD)
is GPL v3 (blob `e72bfddabc15be5718a7cc061ac10e47741d8219`).

Official Blockbench 5.2.2 Bedrock `parseBone`/`parseCube`, box-UV layout and
physical face-corner order are in
[bedrock.js](https://github.com/JannisX11/blockbench/blob/v5.2.2/js/formats/bedrock/bedrock.js),
[cube.js](https://github.com/JannisX11/blockbench/blob/v5.2.2/js/outliner/types/cube.js),
and [three_custom.js](https://github.com/JannisX11/blockbench/blob/v5.2.2/js/util/three_custom.js).
The independent oracle implements the small geometric contracts rather than
loading the production converter. A separately executed data-only official
Bedrock decoder corroborated all 41 cubes/246 face rectangles in the pre-fix
review. No Blockbench application is needed by the tests.

A decompiled ModelPart reference was private corroboration only. It is not an
authenticated Forge 1.20.1 binary, is not required by these tests and is not
redistributed. The official exporter supports the mapping contract, but neither
it nor these tests proves native shader, filtering, culling or engine parity.

## Bounded correction

The existing authored origins/pivots, hierarchy, sizes, atlas offsets and
inflation stay unchanged. Seven X-only child rotations change sign
(`cube_r1` through `cube_r5`, `cube_r10`, `cube_r11`), covering 16 of 41 boxes.
Every cube gains box `mirror: true`, implementing U inversion plus east/west
exchange. The four original color PNGs and light data remain untouched.
This is 41 physical mapping differences, not 41 demonstrated visible defects;
symmetric, constant-color or transparent pixels can mask the difference.

The converter consumes the entire bounded layer body and each complete
statement, builder chain and pose. Unsupported calls, including whitespace
variants of mirror calls and trailing builder operations, cannot be skipped.
Pose numeric grammar and arity, parent identities and the 128×128 atlas return
are checked. It explicitly rejects Z or multi-axis static poses instead of
silently extending this model-specific derivation.
Both original zero-width wheel planes remain zero-width, and their east/west
physical faces remain distinct in the oracle. Inflation is applied before
world transforms without modifying authored dimensions or UV endpoints.

## Reproduction and controls

- `python tests/test_motorcycle_mapping.py -v` regenerates using the real
  production function into a temporary directory, checks the checked-in output,
  and independently compares each source/local vertex through the parent chain
  against decoded RP world corners and each physical face/corner's UV.
- Source X-angle and atlas-offset mutations must regenerate different correct
  output and reject the stale result. Nonzero inflation is separately exercised.
- Restoring only the old X signs must fail 16 boxes while UV stays green;
  removing only the mirror flags must fail all 41 mappings while corners stay
  green. An unexercised source Z mutation must be rejected.
- Seven unsupported statement/builder/pose mutations, including `.mirror (true)`
  after an otherwise valid box, must fail rather than emit unchanged geometry.
- Hand checks: `cube_r1` first local box center `(2.5,18,1.5)` becomes
  `(2.5,9.7489282637,-15.3526184199)`; body cube 0 north top +X maps to `(61,8)`
  and north top -X to `(53,8)`.
- `python tools/review_motorcycle.py --output <directory>` prepares four
  source/candidate comparison scenes and a small three-box control, with source
  at X−20 and candidate at X+20. Original texture bytes are embedded unchanged.
  Cube UUIDs include an explicit delimiter so cube_r1 box 0 cannot collide
  with group cube_r10. Regression tests evaluate the serialized UUID graph,
  check every node is referenced exactly once, and compare actual hierarchical
  world corners against both source and formal RP.
  It preserves authored zero thickness and inflation. Blockbench's preview-only
  0.001 plane expansion is not a native result; explicit per-face UVs bypass
  its 1/64-pixel box-UV inset. Fixture hashes are recorded in a manifest.

On the old converter, max corresponding-corner error was 16.6363672034 model
units and max UV endpoint error 34 pixels. Corrected regeneration gives
1.2905531e-7 model units (stored-degree rounding) and zero UV endpoint error.
These are data results, not screenshots or native acceptance. The lamp's
existing derived alpha, shaders, backfaces, moving steering/wheels and native
world behavior remain outside this correction.
