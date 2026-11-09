# Helmet inactive-pivot preview control

This later, docs-only diagnostic narrows the helmet discrepancy recorded in the
[earlier static review](../remaining-static/README.md). In official Blockbench
5.2.2, changing only fifteen unrotated SOURCE shell cube origins changes the
visible shell behind the visor. Returning to the original project restores the
discrepancy. This is **pivot-dependent editor preview behavior**, not a runtime
asset fix, native transparency acceptance, or proof of an internal sorting algorithm.
The earlier observation and its scope remain unchanged.

## Frozen inputs and exact change

- A: [authenticated original scene](../remaining-static/scenes/helmet-shell-and-visor.bbmodel),
  SHA-256 `5be95f8e613a76e6f467ed0756d46ee0e61504277f0d902cd98a5dc88074e954`.
  This is the exact existing repository scene, reused without another copy.
- B: [review-only control](scenes/helmet-pivot-control.bbmodel),
  SHA-256 `75b134dfcd81d85972435407453c96215b0a7dbcb4cdcdbc89c0ea89d316e000`.
- [Original preparation record](preparation.json) is preserved byte-for-byte,
  including its historical “GUI not yet performed” scope. The later
  [GUI observations](gui-observations.json) are a separate record.

Exactly sixteen parsed fields differ: the project name and `origin` of SOURCE
shell elements 0–14. Each of these cubes has zero rotation; its origin is changed
to `[-11, -24, 0]`. The active visor pivots and rotated shell tips are untouched.
Reversing those replacements restores the full original parsed scene. All forty
cubes, face UVs, embedded texture bytes, five groups, hierarchy, element order,
materials and the entire twenty-cube RP side are otherwise unchanged.
All 320 inflated cube corners agree within a maximum component residual of
`8.881784197001252e-16` model units under direct Euler transformation. Identity
group transforms leave these scene coordinates unchanged. This tiny floating
point residual is not a geometric repair.

The six original runtime/source input paths, sizes, SHA-256 and Git blob IDs
are recorded in preparation.json and checked against the repository: attachable,
shell geometry, visor geometry, both PNGs and original Java helmet item model.
The source review offset is `[-11, 0, 0]`; RP is `[11, -24, 0]`. The preview alone
removes the native head-space `+24Y` translation. No production file changes.

## Actual editor sequence and independent image review

The recorded session opened A, opened B, then returned to A without scene editing
or saving. Every capture uses the **Isometric Right (2:1)** preset, without extra
zoom or camera drag. Grid was off and both side panels hidden. This is a common
preset, not a calibrated camera-matrix or pixel-equivalence claim. On screen,
**SOURCE is right/lower and RP is left/upper**.

1. [A: original](screenshots/helmet-original-isometric-right-2-1.jpg):
   the SOURCE visor shows dark checkerboard/background where the RP visor shows
   the rear shell.
2. [B: inactive-pivot control](screenshots/helmet-pivot-control-isometric-right-2-1.jpg):
   the SOURCE rear shell is now visible through its visor, agreeing with the RP
   presentation in this view.
3. [A: original again](screenshots/helmet-original-return-isometric-right-2-1.jpg):
   the SOURCE discrepancy returns while the RP presentation remains the same.

All three full-window original JPEGs were independently opened and visually
compared, in addition to the recorded GUI operation. The two A images agree in
the relevant visor observation; they are not byte-identical screenshots. All
three images remain unmodified: no crop, alignment, retouching or re-encoding.
Each is 1188 × 848 pixels. Scene hashes after capture still match preparation.
[Manifest](manifest.json) and [independent review](independent-review.json)
separate byte/data checks from the image interpretation.

This reversible, narrowly controlled observation supports a preview-ordering
explanation tied to inactive pivots, without establishing how Blockbench's
renderer implements sorting. It does not establish Java or Bedrock native
alpha blending, material/culling behavior, lighting, worn helmet/head binding,
player animation, armor visibility, automatic riding helmets or color variants.
There was no new native client, BDS, LIVE, runtime, release or version acceptance.

## Read-only verification and manual reproduction

From the repository root, run:

```sh
python docs/validation/visual-audio/blockbench-20261108/helmet-pivot-control/verify.py
```

The standard-library verifier only reads files. It checks original/control and
capture identities, all six runtime/source inputs, exact field differences,
complete unchanged RP content, group/UV/texture preservation and all corners.
It reconstructs the control **in memory** and requires exact byte equality.
It never overwrites preparation, scenes, photographs or production assets and
does not need the historical Git commit to be present in a shallow checkout.
It does not launch an editor or reproduce screenshots.

For a manual visual repeat, open the linked A and B files read-only in Blockbench,
use the camera and display controls above, and compare A → B → A. Do not save
over the frozen scenes. Any new captures belong in a separate disposable folder,
not this historical evidence directory. No downloaded plugin is required.

## Source and license

Original models and textures are by **breezeth / breezeth-CN**,
[OrdertoCook](https://github.com/breezeth-CN/OrdertoCook), pinned upstream commit
`e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`, GPL-3.0. This is an unofficial
modified Bedrock adaptation. The control changes only diagnostic editor pivots;
it does not replace the original work or production assets. See the repository
[license](../../../../../LICENSE), [third-party notices](../../../../../THIRD_PARTY_NOTICES.md)
and [asset provenance](../../../../ASSET_PROVENANCE.md). No Java mod JAR is included.
