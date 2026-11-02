# Project instructions

This is an unofficial GPL-3.0 Bedrock adaptation of breezeth-CN/OrdertoCook.
Preserve upstream attribution, pinned source provenance, and all license notices.
Do not distribute the Java mod JAR in this repository or Bedrock packages.

Target Minecraft Bedrock 26.60 with @minecraft/server 2.12.0-beta and
@minecraft/server-ui 2.0.0. Beta APIs and Points of Interest world experiments
are required for native station discovery; pin the matching 26.60 npm types.
Do not add a player.json override. POI queries must not run in before-events:
placement cancellation and break authorization keep their synchronous canonical
record lookup. POI stores candidate positions, never ownership or inventory.
World access must wait for worldLoad; register block components at startup.

Gameplay source lives in runtime/BP/scripts. Pure order logic must be testable
without Minecraft. Before publishing, run npm run verify. Tests and static checks
are not a substitute for client/world play testing; document what was actually run.
Keep unimplemented or adapted features visible in docs/PARITY.md and README.md.

Do not force-push or overwrite unrelated remote work. Keep stable pack UUIDs so
world dynamic properties survive upgrades. Never clear state after a parse error.
