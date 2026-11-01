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
