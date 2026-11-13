# Staging-only comparison diagnostic B

This is a hypothesis test, NOT a repair or acceptance. Apply comparison.patch to current 0.1.63 source, preserving integration version fields; owner allocates next paired version. Do not deploy this copied source wholesale. No deployment was performed here.

## Evidence and question

Client 26.63 reported DIAG A, desktop=true, size7=true, direct title-key=false while the nonlocalized title rendered container.ordertocook.stove. A also displayed only its banner over the world, without slots. We do NOT claim the injected screen controls preserve inherited controls: the blank screen may be a diagnostic inheritance side effect. Do not move items or perform gameplay acceptance on this diagnostic.

The Bedrock Wiki's author-tested actionbar example requires copying an engine text variable before comparing it. This supports an experiment, not a proven statement that container title follows the same rule:
https://wiki.bedrock.dev/json-ui/json-ui-intro#conditional-rendering-with-variables
Official string equality in requires is valid, e.g. Mojang game_tip_screen.json at 15701fa9c13923f12662984c32c124327e40e3d3. Do not claim strings cannot be compared.

## Read all rows in one screenshot

- DIAG B confirms this new marker, then original raw title, desktop/pocket, size7, direct title-key.
- panel-copy compares a local panel alias of the engine title in visible.
- literal compares the exact key to itself in visible. This is an expression control.
- screen-copy-visible compares a screen-level alias in visible.
- screen-requires-copy reports whether a screen variables.requires branch using that alias fired.
- screen-requires-literal reports the literal control at the requires stage.
- Last row prints the screen-level copied title, localize=false.

The two appended requires entries only set diagnostic flags. The first four routing entries, exact identity guard, native collections, slots, BP and all version metadata remain unchanged.

## Interpretation

Direct=false and copies=true supports the engine-variable copy hypothesis. Only if screen-requires-copy also succeeds should a screen requires repair use that alias. Visible-copy=true but requires-copy=false is evidence of a stage/scope difference, not permission to remove identity protection. A false literal control invalidates interpretation of the corresponding stage. Copy text blank or different distinguishes alias resolution from equality.

## Withdrawal and validation

python3 tools/stove_ui_diagnostic.py --remove validates the exact owned overlay, flags and appended branches then restores production UI SHA256 f2bda88378f3011ddd38c51131f030e0f2b89afd37edccb6c045715363589b9d. Reapplying refuses. Normal asset generator produces nondiagnostic UI; apply helper only for the dedicated staging build. withdraw-to-production.patch also removes diagnostic helper/docs/tests, for integration-owner use with a new paired version. No installed packs or caches should be edited in place.

Seven focused tests passed, including original-route preservation, exact removal, passive labels/panels, rollback refusal and 50 modelled route cases. This Python evaluation is NOT the Bedrock engine. No full npm verify or client validation of B has run. New B client test is required; never release to LIVE.
