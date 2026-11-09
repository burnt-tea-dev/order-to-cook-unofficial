# Washing-table inactive-pivot control

This is a follow-up to the [0.1.45 washing-water review](../washing-water/README.md), not a new runtime change or a native-client test. It was performed in the official cloud Blockbench 5.2.2 desktop after PR #70 merged as `f8e0895f0703d786c6f282ad3001a9de2ada5460`.

## Controlled change

The scene is a copy of `washing-water/scenes/water-after-5.bbmodel`. Only its display name and six **source-side** cube rotation origins changed. Every affected cube has rotation `[0, 0, 0]`, so the change does not alter its transformed vertices. The original source values remain in the earlier evidence and are not rewritten.

| Element index | Original origin | Control origin |
| --- | --- | --- |
| 6 | `[-15, 16, 5]` | `[-14, 0, 0]` |
| 7 | `[-15, 17, 5]` | `[-14, 0, 0]` |
| 8 | `[-15, 20, 5]` | `[-14, 0, 0]` |
| 9 | `[-15, 19, 5]` | `[-14, 0, 0]` |
| 13 | `[-16.5, 13.5, -0.5]` | `[-14, 0, 0]` |
| 14 | `[-16.5, 12.5, -1]` | `[-14, 0, 0]` |

The source-equivalent water plane, all cube bounds, rotations, faces, UVs, textures, groups, and the whole canonical side are byte-equivalent data. `verify_control.py` checks that the complete structured diff is exactly the change above and checks the evidence hashes.

## Observed result

- [Top view](screenshots/pivot-diagnostic-top.jpg): source-equivalent **left**, canonical **right**. The submerged plate outline and its gray/tan contrast now visually agree. The extra source-side obscuration seen in the earlier unmodified source preview is no longer apparent.
- [Isometric view](screenshots/pivot-diagnostic-isometric.jpg): source-equivalent **right/front**, canonical **left/back**. Both retain the same basin water coverage and plate arrangement.

These are original JPEG application-capture bytes, not generated images. Earlier captures retain their historical `.png` filenames but also contain original JPEG bytes; they have not been re-encoded or silently replaced. The model was opened and inspected but was not edited or saved through Blockbench. Other projects were left open.

This controlled result supports an inactive-pivot-dependent transparency-sorting effect in the editor. It does **not** establish the internal renderer mechanism, universal pixel equality, native Bedrock blending, Java shader parity, back-face behavior, or transparency ordering in a game world. No Minecraft or Java client, LIVE world, or user-local computer was used. The source-equivalent side still combines authored model geometry with the separately reconstructed Java water renderer, not a running Java renderer.

## Reproduce the data check

Run `python docs/validation/visual-audio/blockbench-20261108/washing-pivot-control/verify_control.py` from the repository root. Open the `.bbmodel` in official Blockbench for the visual check. The script validates the recorded evidence; it does not claim to repeat GUI or client acceptance.
