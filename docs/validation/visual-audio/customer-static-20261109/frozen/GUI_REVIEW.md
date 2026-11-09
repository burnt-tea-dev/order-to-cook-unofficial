# Customer GUI receipt: first four photographs

Four original full-window JPEGs independently inspected after capture cover
three of the seven frozen candidate scenes. Both models are complete and
unselected. No newly visible broad missing texture or broken face appears in
these views. This is a limited editor observation, not full animation/native
acceptance, and the prepared manifest is not changed to PASS.

- `01_slim_idle4_wrist-isometric-right-2-1.jpg`: slim seated idle4, 1.3333s,
  Isometric Right (2:1). SOURCE right/lower, RP left/upper. Raised compound wrist,
  sleeve, head/arm posture and bent feet correspond.
- `01_slim_idle4_wrist-north.jpg`: same scene/time, North. SOURCE right, RP left.
  The frontal view adds visibility of the raised hand, sleeve, torso and feet.
- `04_wide_interrupt_shrink-isometric-right-2-1.jpg`: wide interrupt .375s,
  Isometric Right (2:1). SOURCE right/lower, RP left/upper. Hand and leg chains
  remain visible/coherent in the frozen half-scale pose. The .5 scale comes from
  the fixed input, not arbitrary screenshot zoom or a pixel-size measurement.
- `05_wide_boom_peak-isometric-right-2-1.jpg`: wide boom 5.9157s,
  Isometric Right (2:1). SOURCE right/lower, RP left/upper. Enlarged head/body,
  asymmetrical arms and bent legs remain visible. The source1.6 / RP1.5928057554
  input difference is known; this image does not quantify it or prove a
  player-visible timing difference.

Source/RP identities come from the fixed X−20/X+20 scene layout and camera
record, not visually guessing between near-identical models. North is labelled
in its screenshot. The exact isometric preset is reported by the capture
operator and is consistent with the displayed axes/layout. Both sides use the
same rig and byte-identical original skin. `gui-receipt.json` retains exact
scene identities, per-side bindings, times/queries, image SHA-256 and dimensions.

## Separate renderer diagnostics

Three additional JPEGs are diagnostic evidence and **do not count as customer
pose coverage or fresh refrigerator acceptance**:

1. `renderer-white-diagnostic.jpg`: customer title visible, white viewport.
2. `known-control-renderer-white-diagnostic.jpg`: known refrigerator control
   also produces a white viewport. The failed condition is not specific to the
   customer asset.
3. `known-control-after-editor-restart.jpg`: known control visible after restart.

The capture operator reports closing only their own editor window and restarting
the original executable with the same independent profile. No new flags,
service, settings change, scene save or shared-window operation was used. Hardware
Acceleration had previously been off; this run neither changed that setting nor
established a cause. The before/after images support recovery after restart,
not a particular renderer, GPU, driver or asset diagnosis. Global Render Sides
is not freshly shown in these screenshots; textures in all frozen scenes remain
`auto`. No native alpha/material claim follows.

## Preservation and verification

All seven scene files still match `scene-freeze-hashes.json`. The original
JPEG bytes are retained: no crop, alignment, rescale, repaint or re-encoding.
No runtime, source PNG, prepared manifest or previously frozen scene was changed
by this image-review worker. The separate GUI receipt records actual coverage;
`README.md`, `scene-manifest.json` and `verification.json` remain their original
preparation/offline records rather than being retroactively promoted.

The source/RP snapshots share one editor renderer. These views do not execute
Java, Bedrock, animation curves, controller stop/reset/re-entry, native action
clock/late join, entity removal, alpha sorting/culling, particles, sounds or
multiplayer. The original scope boundaries remain in force.
