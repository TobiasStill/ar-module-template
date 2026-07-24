# Proximity wave feature guide

Proximity-triggered waving motion: an entity nods forward/back as the
camera approaches (fading in smoothly over a distance band), plus a
subtle, always-on idle float. Works standalone on a single entity, or
applied once to a whole group so every member shares the same parameters.
Ported from `Gyumin_module`'s `glowstick-motion`, split into two
components — see [3. Under the hood](#3-under-the-hood).

Files:

```
src/a-frame-components/
  proximity-wave.ts        # per-entity motion — works standalone
  proximity-wave-group.ts   # broadcasts shared parameters to a group's children
examples/proximity-wave-usage.html   # scene wiring + full attribute reference
examples/random-field-lod-billboard-proximity-wave-scene.html # combined with
                                    # the other three Gyumin_module features
```

No assets. Independent of every other feature on this branch — combines
particularly naturally with [Random Field](RANDOM-FIELD-FEATURE-GUIDE.md)
(put `proximity-wave-group` on the same entity as `random-field` for
shared motion across a whole scattered field), but works with a single
entity with no other feature involved at all.

## 1. Step-by-step: adding this to a new project

1. **Copy the files** — `proximity-wave.ts` and, if you want the group
   broadcaster, `proximity-wave-group.ts` — into your project's own
   `src/a-frame-components/`. No path changes, no data files.

2. **Register in `src/manifest.ts`**:

   ```ts
   import proximityWave from "./a-frame-components/proximity-wave";
   import proximityWaveGroup from "./a-frame-components/proximity-wave-group"; // optional

   export const manifest: Manifest = {
     assets: assetManifest.assets,
     components: {
       // ...whatever you already have...
       "proximity-wave": proximityWave,
       "proximity-wave-group": proximityWaveGroup // optional
     }
   };
   ```

3. **Wire it into the scene** — see
   [2. Entities & attributes](#2-entities--attributes) or copy directly
   from `examples/proximity-wave-usage.html`.

4. **Build and test** — `npm run build`, then `npm run dev:ar` on a phone
   (or a VR/desktop preview, moving the camera close) to see the
   distance-gated wave actually trigger.

## 2. Entities & attributes

Both components share the exact same schema — `proximity-wave` applies it
to its own entity; `proximity-wave-group` applies the same set to every
qualifying direct child.

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `waveNear` | number | `2` (metres) | ≤ this camera distance ⇒ full-strength wave. |
| `waveFar` | number | `5` (metres) | ≥ this camera distance ⇒ no wave at all — smoothly ramped between the two. |
| `waveIntensity` | number | `20` (degrees) | Peak swing each way at full strength. |
| `waveSpeed` | number | `3` | Swing rate — higher is faster. |
| `pivotY` | number | `0` (local units, along the entity's own axis) | Where the wave pivots from — 0 = the entity's own origin; negative lowers it (e.g. toward a "base" the object should swing from rather than its centre). |
| `idleRadius` | number | `0.02` (local units) | Amplitude of a subtle, always-on float in every direction, independent per axis. `0` disables the idle motion entirely. |

```html
<!-- Standalone, single entity -->
<a-entity gltf-model="#MyProp" proximity-wave="waveNear: 2; waveFar: 5; waveIntensity: 20"></a-entity>

<!-- Shared across a group -->
<a-entity proximity-wave-group="waveNear: 2; waveFar: 5; waveIntensity: 15">
  <a-entity gltf-model="#PropA"></a-entity>
  <a-entity gltf-model="#PropB"></a-entity>
</a-entity>
```

The wave swings along the azimuth the entity already leans toward (read
from its own authored X/Z rotation at `init()`) — an upright entity nods
straight forward/back by default. Every instance seeds its own random
phase, so a group never waves/floats in unison even with identical
parameters.

`proximity-wave-group` leaves a child alone if it already has its own
`proximity-wave` attribute — group defaults and per-child overrides
coexist. See `examples/proximity-wave-usage.html` for that pattern and the
`random-field` combination.

## 3. Under the hood

### What changed from the source, and why

The source, `glowstick-motion`, was already a fully self-contained
per-instance component — it read its own base transform and computed wave
direction from its own tilt, nothing about it assumed it was attached by
another component rather than authored directly. Renamed to
`proximity-wave`, otherwise **unchanged**. The one addition is
`proximity-wave-group`, a new component: the source's group-application
("every stick gets the same wave settings") used to be baked directly into
the field-population component itself, setting the `glowstick-motion`
attribute string on each generated instance as it built them. Splitting
that out into its own standalone broadcaster is what makes "applicable to
a group of objects **or** the field" (per the request that produced this
port) actually true — `proximity-wave-group` doesn't know or care whether
its children came from `random-field` or were hand-authored; it just
looks at whatever direct children it has.

### Why `proximity-wave-group` scans children lazily, on the first `tick()`

Not in `init()`. If `proximity-wave-group` and `random-field` sit on the
*same* entity (the intended combination), `random-field`'s clones are
created inside `random-field`'s own `init()` — and A-Frame doesn't
guarantee which of two components on the same entity initializes first.
Scanning in `init()` risks running before the clones exist. Deferring the
scan to the first `tick()` call sidesteps the ordering question entirely —
by the time any component's `tick()` runs, every component's synchronous
`init()` work for that frame is already done, matching the same
lazy-first-tick pattern `wander-in-band.ts` already uses for its own
sibling-avoidance scan (see `WANDER-IN-BAND-FEATURE-GUIDE.md`).

### The wave/idle motion itself

Unchanged from the source. Two composed effects, both written straight to
`object3D` each tick (no attribute re-parsing):

- **Wave** — `sin(time * waveSpeed + phase)`, scaled by a smoothstepped
  distance factor (1 at/inside `waveNear`, 0 at/beyond `waveFar`) and by
  `waveIntensity`, applied along the entity's own base lean azimuth (an
  upright entity defaults to nodding about local X). `sin()` naturally eases
  to zero velocity at each swing extreme.
- **Idle** — three independent `sin()` terms (different frequencies/phases
  per axis) added to the entity's base position, scaled by `idleRadius`.

If `pivotY` is non-zero, a compensating position offset keeps that pivot
point visually fixed while the entity rotates through the wave — otherwise
rotating about the entity's own origin would visibly translate the whole
object if the intent was "swing from a lower point," not just rotate it in
place.

## 4. Incompatibilities, risks & troubleshooting

### Real conflict with `attach-to` (and `ground-decal` with `live: true`) — do not combine on the same entity

Writes its own entity's `position`/`rotation` every tick, with no
awareness of anything else doing the same. Combining with
[`attach-to`](ATTACH-TO-FEATURE-GUIDE.md) (or
[`ground-decal`](GROUND-DECAL-FEATURE-GUIDE.md) with `live: true`) on the
*same* entity means whichever component's `tick()` runs last —
same-element registration order, per
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §5.2](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#52-multiple-components-mutating-nodematerial-on-the-same-element--order-matters) —
simply overwrites whatever the other just set. `proximity-wave-group`
itself is unaffected (it only sets an attribute on children, never a
transform directly), but any individual `proximity-wave` child it drives
is subject to the same rule as standalone `proximity-wave`.

### No other interaction found with any other feature on this branch

Otherwise only ever writes its own entity's `position`/`rotation` (or, for
`proximity-wave-group`, sets a `proximity-wave` attribute on direct
children) — no `document` listeners, no shared/global state, no material
patches, no camera *writes* (only reads the camera's position to compute
distance, same as `follow-node`/`wander-in-band`). Free to combine with
`random-field`, `lod-object`/`lod-manager`, `render-order`,
`ar-button`/`sound-button`, `trim-loop-clip`, and
`mirror-shard`/`liquid-texture` — none of them touch the same state.

### `proximity-wave-group`'s one-time scan means late-added children are missed

If children are added to a `proximity-wave-group` entity well after its
first `tick()` (e.g. some other dynamic scene change, not the
same-frame `random-field` combination this was designed around), they
won't automatically get `proximity-wave` applied. Re-set the group
component's own attribute (even to the same values) to force a fresh scan,
or add `proximity-wave` to those specific children directly.

### `pivotY` assumes a consistent local +Y "up along the object"

The pivot-compensation math scales `pivotY` by the entity's own Y scale and
rotates it by the entity's base orientation — this matches the source's
own assumption (objects modelled with their "base" toward -Y from a
natural holding/mounting point). If your object's natural pivot axis isn't
local Y, `pivotY` won't produce the intended "swings from a fixed base"
look — leave it at `0` (rotate about the origin) rather than fighting it.
