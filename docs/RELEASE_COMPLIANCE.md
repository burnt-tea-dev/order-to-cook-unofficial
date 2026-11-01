# Release compliance checklist

This project is an unofficial derivative Bedrock adaptation of Order To Cook. The checklist is mandatory for every public release.

## Before creating a release tag

- [ ] Complete corresponding source, build scripts, tests and conversion inputs are present.
- [ ] The release tag points to the exact source commit used to build the distributed packages.
- [ ] BP, RP and combined MCAddon each contain the complete GPL text, third-party notices and source-location notice.
- [ ] The in-game guide exposes original author, original project links, port maintainer, upstream commit, GPL and unofficial status.
- [ ] The per-file asset ledger passes validation and every redistributed asset has a documented rights basis.
- [ ] The upstream rights holder has confirmed authority to license all redistributed original assets, or every exception has a separately verified licence.
- [ ] Source commit, package version, runtime tree hash and SHA-256 checksums are recorded together.
- [ ] Minecraft usage guidelines and distribution-platform rules have been reviewed.

## Automated enforcement

- Pull requests and normal builds run `python tools/check_compliance.py`.
- Version tags matching `v*` additionally run `python tools/check_compliance.py --release`.
- Release mode fails while any upstream asset scope remains pending.
- `tools/build.py` embeds source-location, original-author, upstream-revision and unofficial-product notices into each BP/RP pack; both are nested in the MCAddon.
- The release tag is the immutable source-revision anchor. Do not upload a package built from a different commit or silently replace a tagged source revision.

## Distribution statement

Do not imply that the original Java author or Mojang/Microsoft endorses this port. Do not remove upstream copyright notices or impose restrictions that conflict with GPLv3. This document is a project compliance process, not a legal opinion.


## Public-source and CI distribution hold

The rights hold applies to **all conveyance channels**, not only version tags:

- Do not commit generated .mcpack / .mcaddon files to public branches.
- Do not upload generated packages as GitHub Actions artifacts.
- Do not publish candidate packages from bedrock/** branches.
- Local dist/ output may be used privately for maintainer verification and author sample review; it is not a public download.
- Keep only non-binary build identity/checksum records in the tracked artifacts/ directory while the hold remains.

The main validation workflow may build locally for CI checks, but it must not upload package artifacts while rights are pending. Candidate staging must run python tools/check_compliance.py --release before any upload or commit. A green normal test/build job is not a rights clearance.

The repository itself currently contains source and converted asset inputs. Removing package downloads does not erase historical Git objects or make those source assets private. Repository visibility and historical Git-history exposure require a separate owner decision; do not describe this cleanup as a complete takedown of previously public content.
