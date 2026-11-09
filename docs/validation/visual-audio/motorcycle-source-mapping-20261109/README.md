# Motorcycle static source mapping: before and candidate

Nine raw official Blockbench 5.2.2 screenshots were captured on 2026-11-09.
The old neutral front structure visibly folds into a V relative to the pinned
Java source. The candidate removes that disagreement in the white motorcycle's
isometric and top views. Four candidate color variants and the three-box control
were also inspected. All source and comparison geometry is inside the saved
frames; the screenshots are unedited application-window JPEG bytes.

This is static editor evidence, not native Minecraft rendering, movement,
steering, wheel-phase, transparency, culling, emissive-shader or timing acceptance.
No game client, BDS, LIVE deployment or user-local machine was used.

## Captured comparisons

For **Isometric Right (2:1)** the source at scene X−20 appears **right/lower**;
the before/candidate at X+20 appears **left/upper**. For **TOP**, the source is
**left** and the comparison is **right**. Do not generalize screen direction
from the scene offset or a different camera.

| Image | Scene and observation |
| --- | --- |
| [01](screenshots/01_before-control-isometric-right-2-1.jpg) | Before three-box control. The strut's static angle differs from the source. |
| [02](screenshots/02_before-white-isometric-right-2-1.jpg) | Before white motorcycle. The comparison's front panel folds into a V. |
| [03](screenshots/03_before-white-top.jpg) | Before white TOP. Front structure differs while the source remains intact. |
| [04](screenshots/04_candidate-control-isometric-right-2-1.jpg) | Candidate control. Corresponding static shapes and visible texture patterns align. |
| [05](screenshots/05_candidate-white-isometric-right-2-1.jpg) | Candidate white. Front-column disagreement is removed in this view. |
| [06](screenshots/06_candidate-white-top.jpg) | Candidate white TOP. Corresponding front structure and atlas placement align. |
| [07](screenshots/07_candidate-red-isometric-right-2-1.jpg) | Candidate red, original source PNG bytes on both sides. |
| [08](screenshots/08_candidate-blue-isometric-right-2-1.jpg) | Candidate blue, original source PNG bytes on both sides. |
| [09](screenshots/09_candidate-yellow-isometric-right-2-1.jpg) | Candidate yellow, original source PNG bytes on both sides. |

The last three color pairs show corresponding overall form and displayed
texture placement. This is not an exact framebuffer equality claim. Editor
shading, rasterization and obscured faces limit what each view establishes.
Only white and the discriminating control were photographed before the fix;
the other three before-color fixtures are mathematically checked, not GUI-tested.

## Inputs and bounded correction

- Before main: `ce7e8916ac5627be08a6c366ea933a4ad96ad3bd` (0.1.47).
- Source-only repair candidate: `df6d0ade7fe6e0667c0078e5d417686a89f1159a`,
  tree `99c38533938d2b409b561f1ff76b0da0871e303f`.
- Candidate geometry SHA256:
  `c94a03d87f3916b374375f2cd03d98f213d5867c0a56464fc6a12c5987490093`.
- Pinned Java source: `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`.

See [the mapping contract](../../../MOTORCYCLE_SOURCE_MAPPING.md) for registered
renderer, fixed-source links, official GPL Blockbench codec authority and
independent hand checks. The shared review frame is `(JavaX, 24−JavaY, JavaZ)`;
the renderer's constant 0.016 vertical offset is explicitly normalized.

Seven static X-angle signs and 41 box mirror flags are corrected. No original
PNG, animation or gameplay script changes. The independent oracle finds 16
before boxes with wrong world corners (maximum error 16.6363672034 model units)
and 41 physical UV mappings with differences (maximum endpoint error 34 pixels).
The candidate has maximum corner residual about 1.29e−7 from stored-degree
rounding and zero UV endpoint residual. A physical mapping difference is not
necessarily a visible pixel defect: symmetry and uniform/transparent art can
mask it. The snapshots support the narrower visual statements above.

The independent source review passed 937 JavaScript and 74 Python tests before
this documentation batch. At that stage the release build deliberately rejected
the unchanged paired version identity. These captures do not turn that blocked
source-only build into a completed release; later version/package validation
must be recorded separately.

## Exact reproduction

From a checkout containing this bundle and the source repair, run:

```
python -B docs/validation/visual-audio/motorcycle-source-mapping-20261109/verify.py
python -B docs/validation/visual-audio/motorcycle-source-mapping-20261109/test_verifier.py -v
python -B tests/test_motorcycle_mapping.py -v
```

The first command checks the complete file inventory, nine original JPEG hashes,
13 current source/helper/oracle/texture identities, the frozen before geometry,
and ten compressed original scene payloads. It evaluates the actual serialized
UUID/outliner graph against the independent Java and formal RP world transforms,
then regenerates all ten scene files in a fresh temporary directory and compares
every byte with the exact viewed or prepared scene. It writes no repository
files and provides no extraction/output-directory option. Gzip decoding is
in-memory, single-member, length-checked and bounded to 1 MiB per scene. The
separate tests reject truncated, oversized, concatenated and trailing payloads,
unsafe relative paths and symlinks.

To prepare editable copies for a new review, use the checked-in helper in a new
scratch directory. For the old comparison, pass this bundle's `before.geo.json`
and `--comparison-label 'CURRENT RP'`; the default generates the candidate.
The saved manifest hashes identify which existing evidence is being compared.
No new GUI result should be inferred merely from successful regeneration.

## Fixture integrity and preview limits

An early, **unviewed** fixture version had cube/group UUID collisions. Those
were detected and corrected before this GUI batch. Every captured v2 scene has
globally unique IDs, exactly one outliner reference per node and the original
parent hierarchy. The correction changed only cube IDs and matching outliner
references, not source/comparison geometry, UVs, PNGs or group transforms. All
ten v2 scene hashes remained unchanged after capture. The current helper uses
an explicit cube-ID delimiter and includes collision/missing-node mutations.

The minimal scene has six cubes and six groups; each full pair has 82 cubes and
32 groups. The actual serialized-graph maximum corner residual is below 1e−5
(about 5.33e−15 in this batch). Both sides use the same default editor render
mode and Auto sidedness. The explicit physical-face review UVs bypass the
editor's 1/64-pixel box-UV inset, and its 0.001 expansion of zero-width planes is
not a native result. Original zero dimensions and inflation are retained in
the scene data. Light/emissive assets are unchanged and not displayed as a
native shader test. Existing steering and signed-wheel-motion gaps remain open.

No app binary, mod JAR or decompiled Minecraft source is redistributed. Java
source and original art retain upstream GPL attribution in the repository;
the exact original images are embedded in the review scenes without re-encoding.
