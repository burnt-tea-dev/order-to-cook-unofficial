# Temporary staging-only stove UI diagnostic A

Not a fix or client acceptance. This adds a passive yellow bottom-left banner to the data-driven screen only. It intentionally appears on other data-driven containers for a control comparison, but does not change their routes, slots, item collections, transactions, BP, data, or controls. Normal chest screen definitions are untouched.

The marker identifies this screen writer; raw title uses localize=false. Boolean labels expose desktop/pocket, size=7 and exact stove title-key match. No numeric-to-text coercion is assumed. No fake progress is shown.

## Build and withdrawal

The normal generator remains the production generator. After any regeneration, explicitly run `python3 tools/stove_ui_diagnostic.py` only for this diagnostic staging package. Reapplying is refused. `python3 tools/stove_ui_diagnostic.py --remove` removes only the exact expected banner and modification; if changed, it refuses rollback. Removing restores the original UI bytes with canonical JSON formatting. A source reverse patch is supplied in the delivery directory. Never ship this diagnostic to LIVE or as a release.

Integration owner must allocate a new paired BP/RP version with unchanged UUIDs and preserve all unrelated work. Do not deploy the copied source version fields as-is. No deployment was performed by this worker.

## Client comparison

1. Confirm the new candidate cache manifest and UI hashes, after exiting the server before deployment.
2. Open the stove. Record full screenshot including marker, raw title, all flags and layout; do not move items solely to collect diagnostics.
3. If allowed, open a different data-driven container to compare marker and flags, then reopen stove. Ordinary chest remains a separate unaffected control.
4. Marker absent with verified new bytes: screen path/loader is still unproven; do not relax title guard. Marker present with title-key=false: record exact raw title before designing an identity-safe correction. Marker present with both match flags true but wrong layout: investigate screen variable evaluation/override semantics. Both/neither profile labels: investigate profile scope, not client settings assumptions.
5. Withdraw diagnostic using integration owner's normal staging deployment and a new version, restoring the prediagnostic UI hash f2bda88378f3011ddd38c51131f030e0f2b89afd37edccb6c045715363589b9d. Do not mutate installed packs or delete client caches in place.

## Verification limits

Focused unittest checks validate roundtrip, passive-only controls, raw-title settings, stacking/rollback refusal and 50 routing cases. These do not simulate Bedrock's UI loader, render placement or actual screen variables. Real client validation is required. Content Log UI inspection was blocked before executing; no workaround attempted. The available on-disk client log predates this session.
