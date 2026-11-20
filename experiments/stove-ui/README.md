# Experimental Java-parity stove container UI

This folder is an isolated, non-packaged Resource Pack UI prototype for OTC #90. It is **not** copied into `runtime/RP`, the build output, or a release.

## Source boundaries

- Target engine: Bedrock 1.26.60; the official UI source is pinned to [Mojang/bedrock-samples@15701fa9c13923f12662984c32c124327e40e3d3](https://github.com/Mojang/bedrock-samples/tree/15701fa9c13923f12662984c32c124327e40e3d3).
- The overlay is based on Mojang's `resource_pack/ui/data_driven_container_screen.json` and uses its native `container_items` collection and `chest.chest_grid_item` template.
- Java slot coordinates come from [StoveScreenHandler.java](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/screen/StoveScreenHandler.java): input 0–2 at (38,17)/(56,17)/(74,17), fuel 3 at (56,53), output 4–6 at (116,35)/(134,35)/(152,35).

## Prototype behavior

The seven existing native container slots are rendered individually through three horizontal collection panels. The desktop screen selects the custom panel only when `$container_title` matches `container.ordertocook.stove`; other data-driven containers retain the vanilla desktop panel, and pocket/mobile screens retain the vanilla pocket panel.

## Deliberate limits

- This changes only the visual arrangement. It does not create a second inventory or duplicate ItemStacks.
- It cannot enforce fuel-only or output-only slot rules. The 26.60 native container schema has no per-slot filter.
- It has no Java-equivalent burn/cook progress values because the native data-driven container screen exposes container title/size/slots, not the stove's script-side cook state.
- The title match, actual UI merge behavior, slot collection routing, keyboard/mouse, touch, controller, multiplayer and resource-pack conflict behavior require a real 26.60 client test. Static tests are not UI acceptance.
- The legacy HTML `experimental_custom_ui` capability is not used. The current supported candidate is the JSON UI data-driven container screen.

Do not copy this prototype into the production RP until the UI engine has been tested on the target client and the remaining slot/progress differences have an explicit acceptance decision.
