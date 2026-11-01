# Release compliance checklist

This is an unofficial Bedrock adaptation of Order To Cook. Keep the existing licence obligations, but do not turn an unanswered supplementary author inquiry into a blanket development or publication ban.

## Required for a release

- Preserve original attribution, copyright/licence notices, modification notices and the complete GPL text.
- Provide the exact corresponding source, build scripts and editable conversion inputs for each distributed package.
- Record the source identity, package version, runtime fingerprint and SHA-256 checksums. A version tag must match the package version; do not silently replace it.
- Keep the in-game attribution and unofficial status accessible.
- Validate the source ledger and legal files in BP, RP and nested MCAddon packs.
- Resolve any concrete, documented third-party licence conflict affecting the distributed files.
- Report actual gameplay/client validation and unresolved defects. Automated checks alone are not proof of Java parity or client usability.

## Automated checks

Normal builds run `python tools/check_compliance.py`. Actual version tags also run `python tools/check_compliance.py --release` for tag and build-output checks. `PENDING_RIGHTS_HOLDER_CONFIRMATION` emits a warning in both modes; it does not fail a build. `BLOCKED` remains an error for a documented rights conflict. Unknown states, missing required notices, source hash mismatches and incorrect release tags still fail.

`python tests/check_release_policy.py` exercises the real checker after a build: matching tag passes with an advisory pending inquiry, incorrect tag fails, and the rights record is not changed. It neither creates a tag nor publishes anything.

Branch candidates use normal validation, not the actual-tag-only check. Their status must remain clearly experimental. Passing the checker is not a legal opinion or a claim that the original author endorses the port.

## Superseded blanket hold

The earlier rule forbidding every candidate, Actions artifact or package solely because the author had not replied is withdrawn. The source register remains honest about that unanswered inquiry. Existing removed binaries and deleted Actions artifacts are not restored by this policy change, and it does not create a formal Release. New candidates need their own version/commit/hash and validation evidence; old client results must not be relabelled as tests of new bytes.

This policy does not waive GPL obligations, platform rules, known incompatible asset terms, or credible ownership objections.
