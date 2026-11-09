# Future GUI recording guide

This is a handoff checklist, not an observation. No GUI has been operated for
this batch. Use the parent-coordinated authorized cloud Blockbench environment;
this file does not authorize installations, plugins, services or new access.

1. Before opening a file, verify its SHA-256 against `scene-freeze-hashes.json`.
   Open the seven `.bbmodel` files directly, without editing or re-exporting.
2. Record actual app/version and global Render Sides. Textures declare Auto;
   keep the same global setting for both source/RP members. If a setting differs,
   record it before any change rather than silently repairing the fixture.
3. Each file contains two top-level body groups. SOURCE is model X −20 and RP
   X +20. Identify by their outliner labels, not guessed screen position.
4. Plan seven isometric captures, one per scene, with the full application window
   and both complete silhouettes visible. Add a North view for scene03's head-only
   query to distinguish turned head from unrotated body. Record the scene path/hash
   and camera. Add any other view only when necessary to expose an occluded joint
   or overlap; seven scenes do not justify a large duplicate photo set.
5. For the two seated-take phases, preserve camera and scale between captures so
   the small arm/foot change can be inspected. Do not claim playback from them.
6. Record observations narrowly: visible seams, UV orientation, skin/overlay
   surfaces, limb placement, missing or clipped geometry. A common renderer
   pair with equal input data is a preservation control, not native parity.
7. Keep screenshots and a separate receipt outside this preparation manifest.
   Do not mark `scene-manifest.json` as GUI tested or overwrite earlier batches'
   receipts. Recheck the scene hashes after observation.
8. If a difference appears, preserve the exact screenshot/settings first and
   report it. Do not adjust PNGs, UVs, bone pivots, inflate, face winding or runtime
   assets to conceal an editor behavior.

All screenshots must be actual application captures. No diagram, generated
image, offscreen render or numerical plot substitutes for the requested GUI
observation. No game client, server, world or native animation was tested here.
