# Asset licence and rights register

**Status: HOLD — upstream rights-holder confirmation is still required before public redistribution of the bundled original assets.**

## Upstream identity and licence evidence

- Work: Order To Cook / 下单了
- Original author shown by upstream: breezeth / breezeth-CN
- Upstream repository: https://github.com/breezeth-CN/OrdertoCook
- Pinned source revision: `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`
- Upstream licence file: `LICENSE.txt` at that revision; GNU GPL version 3
- Upstream README states that the project code is licensed under GNU GPL v3.
- The pinned shared resource subset contains the assets used by this port and no separate asset-exclusion notice was found in the inspected subset.

## Important limitation

A repository-level GPL notice is strong evidence of the upstream project's stated licensing, but it does not independently establish that the upstream author owns or controls every third-party image, sound, model, animation, font or translation. The absence of a separate exclusion notice is not proof of ownership or sublicensing authority.

**The port must not represent the complete asset rights chain as independently verified until the original rights holder confirms that all redistributed upstream assets are covered by GPLv3, or identifies exceptions and their licences.** This checks that the upstream publisher had authority to license the complete asset set; it does not replace or override GPL rights.

## Per-file inventory

The authoritative per-file ledger is `runtime/asset_conversion_manifest.json`. It records the exact upstream source path, Bedrock output path, source SHA-256 and transformation operation for each copied or converted source reference, pinned to the upstream revision above.

The ledger describes the original PNG, OGG, model, animation and language resources and their generated outputs. `tools/check_compliance.py` validates every entry, verifies each output exists and classifies its file type. The ledger is the per-file inventory; this document records the current rights conclusion.

## Rights status

| Scope | Evidence | Current status |
|---|---|---|
| Java source code | Upstream README and pinned GPLv3 LICENSE.txt | GPLv3 declared upstream |
| PNG textures and icons | Per-file conversion ledger; upstream project licence | **Pending rights-holder confirmation** |
| OGG sound effects | Per-file conversion ledger; upstream project licence | **Pending rights-holder confirmation** |
| Models and geometry | Per-file conversion ledger; upstream project licence | **Pending rights-holder confirmation** |
| Animation data | Per-file conversion ledger; upstream project licence | **Pending rights-holder confirmation** |
| Language files / translations | Per-file conversion ledger; upstream project licence | **Pending rights-holder confirmation** |
| Port-authored scripts, tests and conversion tools | Repository SPDX headers and GPL-3.0-only project declaration | GPL-3.0-only |

## Confirmation record

No direct confirmation from the original rights holder has been recorded in this repository as of this change. Do not mark pending categories as cleared based on assumptions, README wording alone, or the lack of a separate asset licence file.

When confirmation is received, record the rights holder's identity and date, exact asset categories and upstream revision covered, any excluded or third-party assets and their separate licence, and a durable public reference where publication is authorised.

Release tags are blocked while any upstream asset category remains pending.
