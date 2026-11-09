# Global delivery probability: source validation

Date: 2026-11-08. Runtime reproduction base: `15d8b3d41d7a12ccf1b29f99a3e19044fa3208d7` (`0.1.41-alpha.1`). Integrated base: `45e1a6d5a845174cfb8ff4be1a463abb4f3ac9d6`, which adds independent dining-asset test/CI coverage without changing runtime. Scope: the global `deliveryRate` pipeline only. Paired BP/RP/module/dependency version is `0.1.42-alpha.1`, retaining UUIDs and stable APIs. This source report does not imply publication or native/client acceptance.

## Fixed Java contract and operator adaptation

- [`ModConfig.java`, lines 49–56](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/config/ModConfig.java#L49-L56) declares `public double deliveryRate = 0.3`.
- [`OrderGenerator.java`, lines 84–103](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/core/OrderGenerator.java#L84-L103) reads `ConfigManager.get()` and chooses delivery when `world.random.nextDouble() < config.deliveryRate`. Zero is a real dine-in-only option for machine offers.
- [`ConfigManager.java`, lines 41–70](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/config/ConfigManager.java#L41-L70) owns the global config file. The verified Java interface is administrator editing the startup-loaded file. No matching Java GUI or live file-reload claim is made.

The existing Bedrock administrator event is the supported interface adaptation:

```mcfunction
/scriptevent ordertocook:config {"deliveryRate":0}
/scriptevent ordertocook:config {"deliveryRate":1}
/scriptevent ordertocook:config {"deliveryRate":0.3}
```

The first command produces only dine-in **future machine offers**, the second only delivery, and the last restores the default probability. Server events, creative players and players tagged `otc_admin` retain access. Ordinary players and other entity sources cannot configure it. Values must be finite JSON numbers in `0..1`; null, strings, booleans, arrays, objects, out-of-range values and JSON numeric overflow reject the whole command before writes. No other probability fields are exposed.

## Runtime and preservation boundaries

Global defaults, the existing `ordertocook:settings` property, successful configuration propagation, ordinary machine creation and portable machine restore now carry `deliveryRate`. Portable metadata itself still excludes config and orders; it supplies no per-machine exception. On worldLoad, missing/invalid saved fields use `0.3` in memory without rewriting raw settings. Malformed JSON, non-object documents and non-string properties stop initialization and remain untouched.

All actual machine generation routes in `main.js` converge on `refreshMachineOrders`:

1. The machine interaction form opens a brand-new restaurant with sequence zero.
2. The administrator `ordertocook:refresh` event refreshes the nearby machine.
3. The registered `ordertocook:machine_timing` native block tick reaches the timing service's refresh callback.

That common function first checks that its caller is the current canonical restaurant, then copies the current confirmed global rate into its config before calling the unchanged pure `refreshOrders` rule. The existing caller saves the config and generated offers together. This is intentionally a generation-time reconciliation: a saved restaurant may retain an older rate after reload, partial propagation or a later failed save, but that snapshot cannot control its next machine-generated offers. A failed restaurant save still restores a different canonical object. The fix does not revive the stale object, merge its orders into the replacement, or weaken form/timing rollback checks.

A successful configuration command copies the field into existing restaurant configs without generating anything. Existing offered, accepted, packed and completed order types, proof, deadlines, carriers and other order data remain unchanged. Normal future refreshes still perform their existing cancellation/expiry rules; a configuration change is not itself a refresh. Ordinary walk-ins use the separate unchanged `generateWalkInOrder` path and remain dine-in even at rate one.

The .40 leather setting, .41 signed count validation, registered/live placement geometry, and count-only no-record-migration behavior remain. Count plus delivery is not count-only and does propagate delivery. No store schema, property key, core probability rule, entity implementation, model, texture, animation, vehicle or NPC helper is changed.

## Persistence is not an atomic global transaction

Commands containing `deliveryRate` read back the settings string before replacing live settings, using the same boundary as the existing leather/count controls. A setter failure before the write and a silent non-write leave both previous bytes and live behavior unchanged.

If the setter writes then throws, or readback throws/mismatches after a write, live memory can remain old while storage contains the new value. The next successful worldLoad applies that stored value. Tests exercise this uncertainty; this patch adds no recovery or claim that all global updates are atomic.

Once the global setting has been confirmed and live settings replaced, a later restaurant-save failure does **not** roll back the global commit. Earlier restaurants may have new configs, the failed restaurant has a restored canonical snapshot, and later restaurants may be untouched. The next generation in each uses the global rate; newly placed machines do too. The handler continues to report the save failure rather than claim complete propagation. Legacy refresh/upgrade propagation is not redesigned into a transaction.

## Source regressions

`tests/delivery-config.test.js` uses the actual registered script-event, placement, interaction and native-tick callbacks with the repository's native I/O/form doubles. It does not substitute a config implementation or rely only on a private hook. Every tested generation asserts an increased sequence so an old matching offer cannot pass as newly generated. A fresh fixture recreates physical saved machine/board blocks separately from restored records. The main harness's deliberate dine-in override is replaced in these tests to avoid masking the original bug.

Before runtime edits, the delivery suite produced **9 failing contract groups and 4 passing controls** on the `.41` runtime. After the fix, **13/13 groups pass**, covering:

- Both endpoints through Server/creative/tagged-admin input and all three production generation entries, fixed RNG zero and near-one, conflicting restaurant snapshots, forbidden caller controls.
- Strict invalid inputs and JSON overflow; absent/invalid saved fields, raw document preservation, default `0.3`, boundary RNG `0.3`, reset and reload.
- Ordinary and metadata-bearing portable placement, first opening, saved/restored machines, stale saved config and real timed refresh after reload.
- Settings failures before write, silent omission, write-then-throw and unavailable/mismatched readback, with old live versus new persisted values distinguished.
- First/later restaurant propagation failure after global commit, unchanged existing orders, all machines generating from the committed value before/after reload, subsequent portable creation and mixed count+delivery input.
- A failed generated-order save, canonical replacement and safe retry; explicit stale refresh rejection; open-form setting changes and stale-form abandonment after rollback.
- Offered/accepted/packed/completed order metadata and held carriers unchanged by configuration; ordinary walk-in control through 1201 registered native tick callbacks.

The focused delivery/leather/placement/timing/core suite passed **90/90** and direct TypeScript `--noEmit` passed before identity freeze. After integration on `45e1a6d` and the paired `.42` identity freeze, the full direct checks passed:

- `node --test --test-reporter=tap tests/*.test.js`: **812/812 JavaScript tests**.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `python tools/validate_pack.py`: **367 JSON files**, no errors.
- Python unittest discovery: **23 appliance geometry**, **13 segmented-source**, **8 CI-scope** and **4 dining-asset** tests. Segmented tests used the previously obtained pinned Mojang inputs; no new download was needed.
- `python tools/build.py`, `python tools/check_compliance.py` and `python tests/check_release_policy.py`: passed. The existing pending asset-rights clarification remains advisory; evidence is unchanged.

The source is committed before the final packaging check. Two clean-commit builds are compared for identical hashes and exact `sourceRevision` with `sourceDirty=false`; those generated hashes belong in the delivery report rather than this self-referencing source file. No published tag or GitHub change is implied by the local build.

No npm, registry access, installs, new dependencies, client, LIVE world, personal desktop or BDS were used. JavaScript tests execute shipped scripts with doubles. Reload tests are source-level reconstruction, not actual disk restart. These results do not establish multiplayer native event ordering, rendering, performance or 100% Java parity. Existing asset-rights clarification remains advisory and unrelated to this configuration change.
