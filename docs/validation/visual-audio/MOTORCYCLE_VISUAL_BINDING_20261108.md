# Motorcycle visual binding audit

**Later coordinate correction:** this is the historical .41/.42 audit. After
the .48 neutral-model repair, the current mapping preserves Java X and negates
Y; the X/Y-both-negative statement below must not be reused for the new model.
The [bounded .51 presentation repair](../MOTORCYCLE_PRESENTATION_20261109.md)
corrects active X sign and adds a TP idle base. Input-driven steering and signed
wheel state remain unbound; no later native/client acceptance is implied.

## Result and scope

Source inspection confirms two visible differences, not a completed runtime fix:

- The current active Bedrock animation turns the wheels on X but has no steering
  channel for the handlebar or front wheel. The fixed Java source rotates both on Y.
- The current wheel animation uses accumulated unsigned travel. Java integrates a
  signed internal speed, so reversing, coasting and collision behavior differ.

The inspected Bedrock baseline is `45e1a6d5a845174cfb8ff4be1a463abb4f3ac9d6`
(0.1.41); the inspected files remain unchanged at 0.1.42 main
`b0d54f4c7f1353788f82307227ac008b83d89c63`. No vehicle runtime, property, physics
or version was changed in this audit.
No Minecraft client, player input or native vehicle motion was tested.

The [0.1.48 input-contract follow-up](MOTORCYCLE_INPUT_CONTRACT_20261109.md)
adds pinned official protocol and experimental-API evidence. Protocol movement
signs are documented, but their Script API bridge remains unverified; native
motion also cannot reconstruct Java's internal-speed state. No dynamic fix or
native acceptance follows from that later audit.

## Fixed Java evidence

Upstream commit: `e59e3dbcabe19b783d9adb933db5fcb8bc1e4642`.

- [MotorcycleModel.java, lines 93–105](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/client/java/cn/breezeth/ordertocook/client/render/model/MotorcycleModel.java#L93-L105):
  `handle.yRot` and `front_t.yRot` use the same interpolated handle angle;
  `front_t.xRot` and `rear_t.xRot` use the wheel angle.
- [MotorcycleEntity.java, lines 180–288](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/vehicle/motorcycle/MotorcycleEntity.java#L180-L288):
  input, steering smoothing, internal speed, body motion and wheel accumulation.
- [Interpolation, lines 502–507](https://github.com/breezeth-CN/OrdertoCook/blob/e59e3dbcabe19b783d9adb933db5fcb8bc1e4642/forge-1.20.1/src/main/java/cn/breezeth/ordertocook/vehicle/motorcycle/MotorcycleEntity.java#L502-L507).

### Steering

Java side input above zero targets −45°, below zero targets +45°, otherwise zero.
While mounted, the steering target approaches its destination by 4.5° per tick;
unmounted, it returns by 2° per tick. The visible handle angle separately approaches
that target by `6 + 8 * clamp(abs(internalSpeed) / 0.6, 0, 1)` degrees per tick.
The model interpolates between the previous and current visible handle angles.

Steering is possible at rest. Reverse changes the body-turning direction, not the
sign of the handle target. Both front-wheel axes must remain independent: steering
on Y and rolling on X. The rear wheel must not acquire steering yaw.

The existing Java-model converter negates Java X/Y angles and preserves Z. Thus a
Java handle yaw of −45° corresponds to +45° in the converted Bedrock model. This
coordinate conversion does not establish the sign of Bedrock player input.

### Wheel rolling

Each Java tick adds `internalSpeed * 25` degrees. Internal speed is clamped to
−0.3 through +0.6, accelerates by 0.02 per tick and decelerates by 0.01 while mounted
or 0.005 while unmounted. At magnitude at most 0.001, wheel rotation stops and
retains its accumulated phase. Forward-to-reverse motion passes through zero.

The source updates internal speed before collision-limited movement and does not
replace that speed with actual displacement afterward. Wheels can therefore keep
turning while throttle is held against a collision. Vertical slope/step movement
does not become additional wheel distance. Unmounted coasting from the speed
limits takes 120 forward or 60 reverse ticks in this source calculation.

Newly created entity fields reset internal speed and wheel phase. The persistence
code must not be treated as a promise to restore those fields or as equivalent to
pausing an already instantiated entity.

## Current active Bedrock binding

[`motorcycle.entity.json`](../../../runtime/RP/entity/motorcycle.entity.json)
binds only `animation.ordertocook.motorcycle.drive`. In
[`runtime.animation.json`](../../../runtime/RP/animations/runtime.animation.json),
both wheel rotations are:

```json
["q.modified_distance_moved * -114.6", 0, 0]
```

There is no active handlebar rotation channel. The behavior entity has color and
light properties, but no client-synced steering property.

The [official query description](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions/query_modified_distance_moved?view=minecraft-bedrock-stable)
defines modified distance as accumulated horizontal travel. It does not supply
signed reverse displacement. Multiplying that total by the current input sign
would also introduce phase jumps when the sign changes and is not an acceptable
fix.

For a simple source calculation with unmodified horizontal motion and no collision,
Java accumulates 25° per unit of travel versus the current magnitude 114.6° per
unit, a ratio of 4.584. This is not a measured Java/Bedrock gameplay speed comparison.

The separately preserved `drive` clips and stove ignition clip are not active
vehicle bindings. Missing easing in an unbound archive clip is not evidence of a
new active-animation regression. Existing rider, helmet-layer and horn-pose gaps
remain distinct from these steering and wheel findings.

## Why this audit does not wire an input-based fix

The installed stable 2.11.0 definitions expose `EntityRideableComponent.getRiders`,
`Player.inputInfo.getMovementVector`, `Entity.getVelocity` and rotation/location
readers. Their existence alone does not establish movement-vector signs or all
riding/input-device behavior.

The official [Toss Lab sample](https://github.com/microsoft/minecraft-samples/blob/5e04b6f719c316b0611f569af0cab7d6e9a2fb26/toss_lab/scripts/tossLabGame.ts#L703-L713)
uses `getMovementVector().x` for A/D aiming. It is a non-mounted side-view game;
this inspected sample does not identify the individual key signs or verify
mounted keyboard, touch and gamepad steering. It therefore does not resolve the
required input mapping.

A future change must verify that mapping before choosing a sign. It must also
choose and document whether wheel phase follows Java internal speed or actual
Bedrock movement. Actual signed horizontal movement can follow native motion but
is not equivalent to Java's collision/coasting semantics. Such an approach needs
explicit handling of teleportation, dimension changes, load/recreation, sampling
gaps and side-slip, rather than a three-dimensional distance accumulator.

Any runtime patch needs formal binding tests and client checks for stationary
steering, left/right, reverse, braking, dismount return, wheel-axis independence
and all supported controls. Offline fixture poses alone cannot complete that gate.

## GUI illustrations

[Two static Blockbench yaw comparisons](blockbench-20261108/stage-review/README.md#steering-views)
show current neutral geometry beside source-equivalent ±45° handle/front-wheel
poses. They preserve the formal mesh and texture and only apply the declared
pose/layout changes. They are not an implemented runtime fix, raw Java renderer
screenshots or native input evidence.
