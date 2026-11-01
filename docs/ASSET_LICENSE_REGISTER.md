# Asset licence and rights register

**Status: additional clarification pending; non-blocking by itself.** The earlier blanket HOLD was a maintainer precaution, not an additional condition of GPLv3. Development and candidate testing do not wait for a redundant permission response.

## Upstream identity and licence evidence

- Work: Order To Cook / 下单了
- Original author shown by upstream: breezeth / breezeth-CN
- Upstream repository: https://github.com/breezeth-CN/OrdertoCook
- Pinned source revision: `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`
- Upstream licence file: `LICENSE.txt` at that revision; GNU GPL version 3
- Upstream README states that the project code is licensed under GNU GPL v3.
- No separate asset-exclusion notice was found in the inspected pinned shared resource subset. This is not independent proof of ownership of every asset.

## Scope and evidence

The upstream licence, original attribution, editable inputs and conversion records remain preserved. This project does not claim that a separate author response has been received or that every third-party rights chain has been independently verified. The existing JSON status `PENDING_RIGHTS_HOLDER_CONFIRMATION` records that unanswered supplementary inquiry; it is not a publication veto.

GPL-covered material may be modified and conveyed under the existing licence, subject to its conditions. A further permission request is not a universal prerequisite. A specific incompatible asset licence, credible ownership objection or other concrete rights conflict must still be investigated and the affected material withheld or replaced as necessary. Record such a conflict as `BLOCKED` with its supporting evidence; do not mark it `CONFIRMED` just to make CI pass.

## Per-file inventory

`runtime/asset_conversion_manifest.json` records source paths, output paths, source SHA-256 and transformation operations at the pinned revision. `tools/check_compliance.py` verifies the recorded inputs and outputs. Multiple references may point to the same input or combine into one output; entry counts are not counts of unique assets.

| Scope | Recorded evidence | Supplementary confirmation |
|---|---|---|
| Java source code | Upstream README and pinned GPLv3 LICENSE.txt | Upstream GPLv3 declaration |
| PNG textures and icons | Source ledger and upstream repository licence | No separate reply recorded |
| OGG sound effects | Source ledger and upstream repository licence | No separate reply recorded |
| Models and geometry | Source ledger and upstream repository licence | No separate reply recorded |
| Animation data | Source ledger and upstream repository licence | No separate reply recorded |
| Language files / translations | Pinned upstream resources and repository licence | No separate reply recorded |
| Port-authored code and tools | Repository GPL-3.0-only declaration | Not dependent on an upstream reply |

## Follow-up

Issue #3 remains a non-blocking clarification record. Do not repeatedly contact the author or treat silence as affirmative permission. Record a substantive response and any asset-specific exception when received. The pending JSON evidence has not been changed to `CONFIRMED`.

Required attribution, source correspondence and licence checks remain release requirements. Missing paperwork that the applicable licence actually requires, a documented rights conflict or a gameplay release blocker is not waived by this change.
