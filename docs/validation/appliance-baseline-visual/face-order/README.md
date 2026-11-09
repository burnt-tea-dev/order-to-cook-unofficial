# Dishwasher door face-order control

At phase 1/frame 15 (`empty_in`, 0.6667 s), the selected six source mesh cubes
and six canonical cubes have matching physical vertices and UVs across 35 faces
and 140 face corners. The identity endpoint avoids the known intermediate
cuboid-fit approximation.

Two single-pair fixtures are extracted from the original `dish_1_12_15` sheet.
The control changes only `elements[3].faces` key order for source `group5`
original cube 1. Source mesh order is north/east/south/west/up/down; the editor
cube order is east/west/up/down/south/north, reversing front/rear contribution
order for this window. Vertices, UVs, face winding, textures, alpha, material,
pose, UUIDs, names and canonical geometry are unchanged. Reversing this one
permutation recovers the baseline fixture bytes exactly.

- [Baseline original North photograph](screenshots/dish-phase1-frame15-baseline-north.jpg)
- [Face-order-only original North photograph](screenshots/dish-phase1-frame15-door-face-order-only-north.jpg)

Both were captured in official Blockbench 5.2.2, same camera and zoom, models
unselected. Source is on the right; canonical is on the left. The source gains
the canonical four horizontal bands when only its door face order changes.

Measurements decode the original 1188×848 JPEGs without alignment, warping,
resampling, color normalization or saved crops:

- Canonical model ROI: 41,209 pixels, **zero changed RGB pixels**.
- Canonical/source window mean absolute channel difference drops from
  **12.069978213507625 to 0.8490631808278867** on a 0–255 channel scale.
- All eight sampled center rows have exactly equal source/canonical RGB values
  in the control. In viewport strip Y=120…739, all 4,430 changed pixels lie in
  the half-open box `[856,360,936,416)`, around the source window.

[manifest.json](manifest.json) records both fixture/photo identities, exact ROIs,
RGB samples and all measurements. Small remaining differences are not exact
pixel parity; their individual causes are not determined. No threshold defines
acceptance. The source preview mechanism is controlled at this endpoint only:
other poses, coplanar/inter-object order, reverse views and native rendering are
not thereby accepted. No runtime material or geometry was modified.

The official editor source is reused from the shared calibration: `Canvas.face_order`
in `js__preview__canvas.js.txt`, cube iteration in `js__outliner__types__cube.js.txt`,
and mesh face-key iteration in `js__outliner__types__mesh.js.txt`. Source URLs
and SHA-256 identities accompany that calibration.
