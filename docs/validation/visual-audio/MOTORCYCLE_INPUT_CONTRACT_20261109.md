# Motorcycle input and wheel-state evidence

The later [bounded presentation repair](../MOTORCYCLE_PRESENTATION_20261109.md)
only corrects the model-local wheel X sign and adds a third-person idle base.
It leaves the input/hidden-speed contract gaps below open; the historical
negative active-expression example describes the pre-repair source.

This read-only follow-up inspected addon `dbb2574154a54cc5ad69e75e71d23900a98a79fe`
(0.1.48-alpha.1) against the pinned Java source
`e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`. It changes no runtime, dependencies,
experiments or vehicle behavior. No Minecraft client, BDS or real player input
was used. The [earlier dynamic-binding audit](MOTORCYCLE_VISUAL_BINDING_20261108.md)
and its stationary-steering/reverse gaps remain applicable; the later static
geometry correction does not resolve them.

## Result

Official sources now establish movement signs at the **wire-protocol layer**:
left is negative X, right positive X, forward positive Y, in player-local space.
They do not establish that Script API `getMovementVector()` returns this field
unchanged for a mounted custom entity. No inspected stable or experimental API
source supplies that missing bridge. Applying the protocol signs directly would
still be an assumption, so no input-dependent runtime patch is proposed.

Current native movement also does not expose the separate Java internal-speed
state. Velocity or signed travel can support a different visual adaptation, but
cannot recover Java's collision-independent wheel integration. More static poses
or pure helper tests would not resolve either runtime contract.

## Official evidence and its boundaries

### Protocol signs, raw movement and riding

Mojang's [pinned changelog, lines 464–469](https://github.com/Mojang/bedrock-protocol-docs/blob/f8d1496b5efc95105bd9ae1f2f2f076a43f71d82/legacy_changelogs/changelog_776_1_14_25.md#L464-L469)
defines the axis signs and normalized diagonal input. The newer packet schema
describes [Move Vector as desired movement in player-local space](https://github.com/Mojang/bedrock-protocol-docs/blob/f8d1496b5efc95105bd9ae1f2f2f076a43f71d82/json/PlayerAuthInputPacketPayload.json#L68-L72).
Its [Raw Move Vector ignores input permissions](https://github.com/Mojang/bedrock-protocol-docs/blob/f8d1496b5efc95105bd9ae1f2f2f076a43f71d82/json/PlayerAuthInputPacketPayload.json#L124-L133).
The schema declares Minecraft 1.26.60-beta.0, protocol 2225; it is not a stable
2.11.0 Script API binding specification.

The [vehicle-input flag](https://github.com/Mojang/bedrock-protocol-docs/blob/f8d1496b5efc95105bd9ae1f2f2f076a43f71d82/legacy_changelogs/changelog_776_1_14_25.md#L515-L516)
and [movement overview](https://github.com/Mojang/bedrock-protocol-docs/blob/f8d1496b5efc95105bd9ae1f2f2f076a43f71d82/additional_docs/PlayerMovementOverview.md#L77-L97)
describe input/prediction for ridden vehicles. Thus mounted input is not inherently
absent from the protocol. Neither source guarantees Script API values for this
addon's custom `minecraft:input_ground_controlled` entity, camera/control modes,
keyboard, touch or gamepad. Packet-driven simulation is also not proof of a
one-to-one relationship with arbitrary script callbacks.

The official [Preview 1.21.50.25 input-API announcement](https://www.minecraft.net/en-us/article/minecraft-preview-1-21-50-25)
calls `getMovementVector` raw movement input and says input remains readable when
permissions disable movement. The API suite later became stable in
[server 1.18.0](https://www.minecraft.net/en-us/article/minecraft-1-21-70-bedrock-changelog).
A future visual integrator therefore cannot assume that disabling movement also
zeros raw input. This evidence still does not specify the returned axis signs.

### Stable and experimental Script API

Installed stable `@minecraft/server@2.11.0` declares a Vector2 return and possible
InvalidEntityError for `getMovementVector`, without coordinate or riding remarks.
Its `InputButton` contains only Jump and Sneak. Directional members of
`InputPermissionCategory` are permission controls, not pressed-button readers.
`lastInputModeUsed` identifies a device category without supplying its mapping.

The [experimental InputInfo page](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/inputinfo?view=minecraft-bedrock-experimental)
([pinned source](https://github.com/MicrosoftDocs/minecraft-creator/blob/457cdeaa5aa428429884b092895f3979b1f69ad3/creator/ScriptAPI/minecraft/server/InputInfo.md))
and [pinned InputButton source](https://github.com/MicrosoftDocs/minecraft-creator/blob/457cdeaa5aa428429884b092895f3979b1f69ad3/creator/ScriptAPI/minecraft/server/InputButton.md)
do not close this gap. The [inspected changelog through 2.13.0-beta.1.26.70-preview.23](https://github.com/MicrosoftDocs/minecraft-creator/blob/457cdeaa5aa428429884b092895f3979b1f69ad3/creator/ScriptAPI/minecraft/server/changelog.md#L47)
does not add directional button-state readers. There is no demonstrated capability
gain here that justifies changing the stable dependency or enabling another experiment.

Official InputButton remarks also distinguish short touch Sneak presses and
horse/boat dismounts without Sneak-change events. Mounted state should not be
inferred solely from Sneak. No custom-motorcycle dismount behavior was exercised.

Scoped official repository searches found the already-inspected
[Toss Lab use of the X component](https://github.com/microsoft/minecraft-samples/blob/5e04b6f719c316b0611f569af0cab7d6e9a2fb26/toss_lab/scripts/tossLabGame.ts#L703-L713),
not a mounted sign/device contract. This is a bounded search result, not a claim
that no other documentation or sample can exist.

## Why observed motion cannot recover Java wheel state

The current [behavior entity](../../../runtime/BP/entities/motorcycle.json) uses
movement 0.35, basic movement, ground input control and one controlling seat.
There is no scripted authoritative throttle, signed internal speed, steering
target or accumulated wheel phase. The active resource animation still uses
unsigned `q.modified_distance_moved * -114.6`.

The [official ground-control component](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_input_ground_controlled?view=minecraft-bedrock-stable)
describes WASD control, not Java's acceleration, reverse limit or friction.
Java separately [advances internal speed and wheel phase](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/vehicle/motorcycle/MotorcycleEntity.java#L180-L288):
speed approaches +0.6 or −0.3 by 0.02 per tick, decays by 0.01 while mounted or
0.005 unmounted, and contributes `internalSpeed * 25` degrees to the wheels.
Its [initialization/persistence](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/vehicle/motorcycle/MotorcycleEntity.java#L51-L103)
does not promise restoration of that hidden state after recreation.

Neutral at rest and accelerating against a wall can produce identical actual
displacement but different Java internal speed and wheel phase. Bedrock velocity
has no documented equivalence to that separate integrator. A movement attribute
of 0.35 supplies neither the signed evolving state nor its input history.
Heading change is also not a steering-input substitute: Java permits steering at
rest, and reversing changes body-turn direction without flipping the handle target.

## Distinct possible future implementations

1. **Java-law visual state:** after establishing the input contract, retain the
   source steering/speed states and integrate signed wheel phase. This would put
   Java visual update laws over native Bedrock movement, not establish identical
   vehicle physics. Sampling, lifecycle reset, replication and interpolation need
   their own contract and client checks.
2. **Signed native-travel adaptation:** increment phase from signed horizontal
   travel in a verified forward frame. This deliberately differs from Java when
   blocked or coasting. Teleports, dimension changes, side-slip, recreation and
   sampling gaps need handling. Never multiply all previous unsigned distance by
   the current input sign, which makes old phase jump.
3. **Authoritative movement replacement:** owning acceleration, steering,
   friction and collision behavior would be substantial gameplay work, not a
   small visual-binding fix. It is not implemented or validated here.

For now, retaining the documented gap is the evidence-supported production
choice. Before an input-dependent patch, verify the actual mounted Script API
sign/frame mapping, keyboard/touch/gamepad availability, dead zones/diagonals,
disabled permissions, menus, mount transitions and tick gaps. Then choose the
intended wheel-state semantics and test both independent front-wheel axes, rear
wheel isolation, retained phase at rest and synchronization. Static Blockbench
poses do not pass those gates.

## Rechecking this bounded result

The installed stable declaration inspected here has SHA-256
`62d606f497f8a4272fcbe559428ee11d064137e5a731a8356aeb0fcff60fee51`.
This is the package's `index.d.ts`, not a client implementation. Recheck the
locked dependency and the exact addon commit above, then compare the pinned
official sources rather than silently upgrading the package or treating mutable
documentation as a new runtime test. The protocol and documentation commits
identify the inspected texts; they are not guarantees that future versions keep
the same contract. No negative search result proves universal absence.
