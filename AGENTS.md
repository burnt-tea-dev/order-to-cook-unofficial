# Project instructions

Follow upstream pstack for development and ready PR delivery through the [shared entry](https://github.com/burnt-tea-dev/kaleidoscope-tavern-unofficial/blob/1a992c4831f5bb83e237e70223e63acb7d326c69/family/UPDATE-WORKFLOW.md#pstack-代理入口). In Codex, read its linked host adapter once before any pstack skill.

This is an unofficial GPL-3.0 Bedrock adaptation of breezeth-CN/OrdertoCook.
Preserve upstream attribution, pinned source provenance, and all license notices.
Do not distribute the Java mod JAR in this repository or Bedrock packages.

Target Minecraft Bedrock 1.26.60 or later, stable @minecraft/server 2.11.0 and
@minecraft/server-ui 2.0.0. Upcoming Creator Features is required for native
block containers. Beta/Test APIs are allowed when their actual capabilities,
supported module versions and required experiments are verified and documented.
Do not introduce a player.json override.
World access must wait for worldLoad; register block components at startup.

Gameplay source lives in runtime/BP/scripts. Pure order logic must be testable
without Minecraft. Before publishing, run npm run verify. Keep unimplemented or adapted features visible in docs/PARITY.md and README.md.

Do not force-push or overwrite unrelated remote work. Keep stable pack UUIDs so
world dynamic properties survive upgrades. Never clear state after a parse error.
