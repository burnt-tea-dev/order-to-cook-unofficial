# Placed bag fold depth repair

## Source finding
The owner reported flicker in the top paper folds in image(20261111-152705).png. The screenshot was read on native cary-ser; its red box contains the crossed upper paper folds.

P173 selects OTC 0.1.56 from runs/20261111-p172-staging-repair/batch-inputs/OrderToCook. Its RP/models/blocks/takeout_bag.geo.json retains the original source's group cubes 1 and 2: both Z bounds are [-0.995, 0.995], rotations are +22.5 and -22.5 degrees about [0, 8.96717, 0], and the north/south UV rectangles differ. Both fold rectangles contain the common pivot and overlap above body Y=9; their alpha-tested texels are opaque. This proves a shared-depth region with competing textures. A still screenshot cannot prove its complete temporal cause.

The Java input is upstream/reference/common/src/main/resources/assets/ordertocook/geo/block/takeout_bag_placed.geo.json, pinned to e59e3dbcabe19b783d9adb933db5fcb8bc1e4642. The original placed renderer is a GeoBlockRenderer with an empty block model. The current native block has one exclusive frame selection; the unreferenced imported geometry remains only a source archive.

## Repair
tools/convert_assets.py now gives the second fold a centered 1/32-model-pixel inset per north/south face before the existing maked animation is baked. Its settled Z bounds become [-0.96375, 0.96375]; the first fold remains [-0.995, 0.995]. Only this fold's thickness changes. X/Y silhouette, pivot, angles, every UV, PNG, alpha-test material, five-cube count, placement timing and saved frame state are retained. The existing original-motion scale multiplies the gap in every frame.

The shared make_takeout_bag producer is used by full conversion and --bag-only. Only the eleven runtime/RP/models/blocks/takeout_bag*.geo.json outputs and their provenance entries need replacement. The targeted bag-only mode leaves the BP definition untouched; full conversion retains its original generation. The imported upstream archive and item icon are unchanged.

## Status
Source inspection and normal --bag-only generation only. No test suite, fixtures, gameplay probes, simulated player, CI, push, PR, deployment or client check ran. Existing plate and rider changes in the shared converter were preserved. The actual repaired near/far/moving client result is not yet observed. Paired pack version and staging deployment belong to the P174 integrator.
