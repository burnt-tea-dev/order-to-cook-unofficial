# Additional customer static-pose evidence: seven new scenes

**Nine model photographs and one Render Sides diagnostic were independently inspected.** All figures are complete and unselected in these views. The scene05 sleeve stippling is present on both source and RP and is retained, not cosmetically removed. No port-only broad missing texture or broken face was identified in this bounded review. This does not accept native game rendering or playback.

## Photo captions and exact scope

SOURCE is model X=-20, screen right/lower in Isometric Right (2:1), right in North. RP is X=+20, screen left/upper in ISO, left in North. Identity follows the frozen layout and operator record. Both figures use one common Blockbench CubeRenderer. Application 5.2.2 and ISO preset are operator provenance; the North label and Auto setting are visible in their photographs. Times below are declared local clip seconds, not measured native clocks.

- [01_slim_sit1_counterphase-isometric-right-2-1.jpg](frozen/screenshots/01_slim_sit1_counterphase-isometric-right-2-1.jpg): `customer_sit_1`, 0.75 s. Complete slim seated pair. Counterphase bent feet and hanging arms are visible; inner joint faces remain occluded.
- [02_wide_wait1_phase0-isometric-right-2-1.jpg](frozen/screenshots/02_wide_wait1_phase0-isometric-right-2-1.jpg): `customer_wait_1`, 0.0 s. Complete wide standing pair, asymmetric hanging arms, hands and straight legs. No broad missing texture is visible in this view.
- [03_slim_sit2_head_query-isometric-right-2-1.jpg](frozen/screenshots/03_slim_sit2_head_query-isometric-right-2-1.jpg): `customer_sit_2`, 0.375 s. Complete slim seated pair with turned/pitched head and forward-facing torso under declared synthetic inputs. Isometric shows head top and lateral silhouette.
- [03_slim_sit2_head_query-north.jpg](frozen/screenshots/03_slim_sit2_head_query-north.jpg): `customer_sit_2`, 0.375 s. North control shows both faces, shoulders, hanging hands and seated feet. The head orientation is a synthetic frozen input, not observed native tracking.
- [04_wide_wait4_yaw-isometric-right-2-1.jpg](frozen/screenshots/04_wide_wait4_yaw-isometric-right-2-1.jpg): `customer_wait_4`, 3.7778 s. Complete wide standing pair with head yaw, shoulders and hands visible. Snapshot does not test the prior wrist gesture or its return.
- [05_wide_eat_left_wrist-isometric-right-2-1.jpg](frozen/screenshots/05_wide_eat_left_wrist-isometric-right-2-1.jpg): `npc_eat&scale`, 4.0 s. Complete wide seated eating pair. Bent hands near face, pitched head and teal stippling at sleeve/forearm joins on BOTH figures. Retained for diagnosis.
- [05_wide_eat_left_wrist-north-sleeve-control.jpg](frozen/screenshots/05_wide_eat_left_wrist-north-sleeve-control.jpg): `npc_eat&scale`, 4.0 s. North control confirms teal seam stippling on both figures and frontal hand/forearm overlap. No texture cleanup or render-side override was applied.
- [06_slim_sittake_phase0-isometric-right-2-1.jpg](frozen/screenshots/06_slim_sittake_phase0-isometric-right-2-1.jpg): `npc_sittake`, 0.0 s. Complete slim seated-take pair at phase0, with raised arms/hands and counterphase feet. No frame is interpreted as live animation.
- [07_slim_sittake_phase05-isometric-right-2-1.jpg](frozen/screenshots/07_slim_sittake_phase05-isometric-right-2-1.jpg): `npc_sittake`, 0.5 s. Complete slim seated-take pair at phase0.5. The arm splay and foot phase differ from scene06. Preset and scroll amount were the same by operator record, not proof of equal camera matrices.
- [editor-render-sides-auto.jpg](frozen/screenshots/editor-render-sides-auto.jpg): Render Sides setting visibly reads Auto. This is an editor-setting diagnostic, not a model acceptance photo or a native material test.

Full scene hashes, original image hashes/sizes, per-side input/skin identities, synthetic query inputs and individual captions are in [the independent receipt](gui-independent-receipt.json). Images are the original full-window JPEG bytes, never cropped, aligned, rescaled or re-encoded. Automated verification checks identities and decoding, not subjective image quality or capture time.

## Scene05: shared overlap, not a demonstrated port defect

The ISO and North photos show teal striping/stippling where sleeves meet bent forearms on both figures. [The geometric diagnostic](sleeve-overlap.json) evaluates the original world-space corners for each side and intersects coplanar convex face polygons. Both left and right arm/hand front and back faces overlap with positive area, for both the base cubes and the original 0.25-inflate overlay cubes. Their wrist rotations around local Z and zero local-Z translation retain common face planes. Plane residuals are below 1e-10 model units; overlap areas are identical between the source and RP to the same tolerance.

This is a concrete shared geometric condition consistent with editor depth competition (z-fighting). It is not an instrumented determination of each stippled pixel’s cause: JPEG compression, draw order, depth precision and transparency were not isolated. No native renderer defect or source/RP port difference is established. The two raw skins retain binary alpha values 0/255, the wide skin’s base/overlay UVs and inflation remain untouched, and the ordinary verifier checks every face UV and inflate value independently. No alpha flattening, overlay deletion, face removal or Render Sides override is proposed.

## Preparation history remains unchanged

[frozen/README.md](frozen/README.md), [frozen/GUI_REVIEW.md](frozen/GUI_REVIEW.md), the frozen manifest and verification records remain historical preparation results. Their pending GUI statements are not retroactively rewritten. [The separate capture receipt public projection](capture-receipt-public.json) records the later nine model observations and one diagnostic; the independent receipt above records inspection of those originals. The 73-file preparation hash manifest remains SHA-256 `460e22c0b7e85abc1c1c57899556013e34cdf451d47fc5aa334f82c4fc121157`.

## Offline reproduction and safe packaging

Keep this directory and its sibling [customer-static-20261109](../customer-static-20261109/) together from the same repository. This bundle intentionally reuses 45 exact prior artifacts (including licensed source excerpts and the compressed converter fixture); it is not a standalone single-directory download. Every dependency is pinned by SHA-256, length, original Git blob and the prior public inventory SHA-256. No network, Git executable, app binary or JAR is needed to verify. The converter is restored only as a hash-bound fixture and is never executed or imported.

With Python 3.10+, NumPy, Pillow and Node 18+ already installed, run from this directory:

```sh
python -B verify_public_bundle.py
python -B test_public_bundle.py
```

The verifier reconstructs exact original files into a temporary directory, verifies the historical manifests and GUI binding, runs the independent pose oracle and selection checks in fresh processes, rebuilds all seven scene/sample files byte-for-byte and reproduces the sleeve diagnostic. It checks 2,240 inflated corners, 1,680 face-UV records, hierarchy, pivot, cube order, original texture bytes and 165 normalized bone/channel tracks across 15 clips. These are static data checks, not two native engines. The original oracle is retained; its public adaptation changes only provenance projection handling and interpreter selection, with exact replacements recorded in [portable-adaptation.json](provenance/portable-adaptation.json).

To restore originals for inspection, choose a new disposable output directory under an existing real directory:

```sh
python -B verify_public_bundle.py --assemble /tmp/customer-remaining-inspection
```

Assembly rejects existing output, source overlap (including any enclosing Git checkout/worktree of either bundle), symlinks, dot-dot paths and conflicting outputs; standalone sibling bundles outside a Git checkout can still restore into a new sibling directory; all payloads are validated before writes and decompression is size-bounded. New public files are limited to 110 KiB; inherited prior files retain their established 128 KiB ceiling. Original model/animation/PNG/JPEG bytes are unchanged. Two original metadata receipts are omitted: the private acquisition record and the raw GUI capture receipt. Their original hashes and sizes are retained. The acquisition projection is reused from the prior bundle; the capture projection changes only the operator label to “visual review operator”. Neither omitted original can be reconstructed from its public projection. All other 83 original files are reconstructible. The original private files were not modified. Preserved scripts in frozen/ are historical; use this public verifier rather than directly running historical scripts.

[Portable commit/tree objects](provenance/repository-identity.json) authenticate all 17 declared inputs against preparation commit `dd3153ed9c9755702244696c5271dcd35feb6d13`, then-recorded main `36e9d6eac9594ed598a7cf528189b7c942f3bafa`, and baseline `ce7e8916ac5627be08a6c366ea933a4ad96ad3bd` (tree `7d09bfd89ea2cd860725586f1c234fe968319559`). This is selected-input equality, not whole-tree equality, remote server authentication or signature validation. Upstream OTC and GeckoLib source/blob identities remain pinned.

License notices and full GPL/MIT texts reconstruct at licenses/ from the authenticated earlier bundle; see [its attribution](../customer-static-20261109/frozen/licenses/NOTICE.md). New scripts and review derivatives are GPL-3.0-only. No application binary, mod JAR, private acquisition URL, credential or filesystem path is published. [Validation](validation.json) distinguishes executed checks from limits.

## Boundaries still open

Seven new cases supplement the earlier frozen coverage. The bounded selection check confirms these exact static poses differ from listed same-rig prior samples, not that every rig/clip/time has now been reviewed. Scene03 uses synthetic target_x_rotation=15 and target_y_rotation=-30, not accepted native look-at conventions. Scenes06/07 are static instants and do not demonstrate playback. Hidden inner surfaces remain unreviewed.

No LIVE, Minecraft client, BDS, native Java/Bedrock renderer, controller timing, continuous curves, transitions, STOP/reset/re-entry, query clamping, action clocks, late join, unload/reload, multiplayer, riding alignment, entity removal, sounds, particles or native alpha/material ordering were exercised. Known narrow boom timing and unsampled standing-idle2/seated-idle3 combinations remain open. No runtime/version change or runtime fix is made.
