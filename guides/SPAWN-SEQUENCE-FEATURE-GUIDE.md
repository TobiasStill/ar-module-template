# Spawn Sequence feature guide

<!-- overview -->
## Overview

Makes things pop up one after another around the visitor, like
mushrooms after rain. At a steady beat or at chosen moments, a new object
springs out of the ground with a bouncy little wobble — right in front of
the visitor, wherever they are looking, or scattered at random spots
nearby. Each one can bring its own short sound from where it appears. Over
time, the space fills up around the visitor.

<!-- /overview -->

## Technical summary

Models spring up one after another — at an interval or on a timeline, in
front of the viewer or at random spots — each growing from nothing with an
elastic bounce, optionally with its own one-shot positional sound.
Applicable to any (empty) entity — see
[3. Under the hood](#3-under-the-hood).

<!-- project-specific -->
### Project context: origin

Merged from two Augmented Bahnhofsviertel ports
(`augmented-bahnhofsviertel`: #4 Europaplatz II's
`distance-place-interval`, #6 Birdkin(d)'s `distance-place-sequence`) —
see §3.

<!-- /project-specific -->

Files:

```
src/a-frame-components/spawn-sequence.ts
examples/spawn-sequence-usage.html   # scene wiring + attribute reference
```

No shipped assets (the models and sounds are a project's content).
Related: [Random Field](RANDOM-FIELD-FEATURE-GUIDE.md) scatters copies all
at once; Spawn Sequence adds them over time.

## 1. Step-by-step: adding this to a new project

1. **Copy** `spawn-sequence.ts` into `src/a-frame-components/`.

2. **Nothing to register** — every component file in
   `src/a-frame-components/` is registered automatically under its file
   name as soon as the scene uses it (README, "The manifest"); unused ones
   aren't even bundled. Only a component registered under a different name,
   or one whose name is built at runtime, needs a manual entry in
   `src/manifest.ts`.

3. **Add the content** — the models (`.glb`) and optional sounds to
   `src/assets/`; list their ids in `models` / `sounds`.

4. **Wire the scene** — an empty entity with `spawn-sequence`, usually
   inside a [Placement](PLACEMENT-FEATURE-GUIDE.md) scene
   (`examples/spawn-sequence-usage.html`). With sounds: `auto: false`, and
   dispatch `spawn-sequence-start` from a tap (e.g. an [AR Overlay](AR-OVERLAY-FEATURE-GUIDE.md)
   "Start" control) — iOS needs the gesture.

5. **Build and test** — `npm run dev` already shows the spawning; the
   camera-relative positions and sound only make sense in `npm run dev:ar`
   on a phone.

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `models` | array | `[]` | Model asset ids, cycled in `order`. |
| `order` | string | `sequential` | `sequential` or `random`. |
| `interval` | number | `1000` | ms between spawns (when `times` is empty). |
| `delay` | number | `0` | ms before the first spawn (interval mode). |
| `times` | array | `[]` | Seconds after start for each spawn; overrides `interval`/`count`. |
| `count` | int | `10` | Spawns in interval mode; `0` = endless. |
| `auto` | boolean | `true` | Start on init; `false` = on `spawn-sequence-start`. |
| `mode` | string | `camera` | `camera`: in front along the view direction; `random`: within `radius` of the origin. |
| `distance` / `variation` | number | `3` / `0.5` | camera mode: distance ± variation/2 (local units). |
| `radius` | number | `3` | random mode: radius. |
| `floor` | boolean | `true` | Models on y = 0; `false` = at the view ray's height (camera mode). |
| `facing` | string | `camera` | `camera`, `random` or `none`. |
| `scaleMin` / `scaleMax` | number | `1` / `1` | Random target scale range; equal = fixed. |
| `growDuration` | number | `750` | ms to spring up. |
| `easing` | string | `easeOutElastic` | Any A-Frame animation easing. |
| `castShadow` / `receiveShadow` | boolean | `true` / `false` | Shadow settings of each model. |
| `sounds` | array | `[]` | Audio asset ids, one per spawn (cycled). |
| `volume`, `refDistance`, `maxDistance`, `rolloffFactor`, `distanceModel` | — | `1`, `1`, `10000`, `1`, `inverse` | Positional sound settings; distances are multiplied by the entity's world scale. |

Events: **in** `spawn-sequence-start`, `spawn-sequence-stop`,
`spawn-sequence-clear` (removes all spawned models); **out**
`spawn-sequence-spawned` `{ el, index }`, `spawn-sequence-done`.

```html
<a-entity place-in-front="distance: 0">
  <a-entity spawn-sequence="models: #slat1, #slat2; interval: 1000; count: 40; distance: 4"></a-entity>
</a-entity>
```

## 3. Under the hood

**One spawn routine, many rhythms.** Every spawn computes the same thing:
the camera's position and view direction converted into the entity's
space, a point `distance ± variation/2` along that direction (or a random
point within `radius`), dropped to the floor, then an elastic scale-up
(750 ms by default). Rhythm (`interval`/`times`), orientation (`facing`),
size (`scaleMin`/`scaleMax`) and sound (`sounds`) are the options on top.

<!-- project-specific -->
#### Project context: Augmented Bahnhofsviertel

##### One component for two originals

#4 Europaplatz II placed a slat every second (fixed scale, turned to the
viewer, `runs` with an off-by-one), #6 Birdkin(d) placed membranes on a
timeline of seconds (random heading, random size, one sound each). Both
computed the routine above; their differences became the attributes, so
one component replaces both. `mode: random` and `order: random` are new.
Both originals also waited for their scene placement and spawned closer
when looking down, which the clock and positions below keep.

<!-- /project-specific -->

**Clock.** Time is accumulated in `tick` (not `setInterval`), so `times`
can be fractional, the sequence pauses with the entity, and it waits while
an enclosing `place-in-front` scene hasn't been placed yet. Several spawns that fall into one frame
are all made in that frame.

**Positions are local.** The camera pose is converted into the entity's
space with its inverse world transform, and models are children of the
entity — so the sequence works inside any scaled/rotated parent; the view
direction includes the pitch, so looking down spawns closer.

**Bounce after load.** Each model starts at scale 0.001; the grow
animation (`animation__spawn-grow`) is set when its mesh arrives
(`object3dset`), so a slow-loading model doesn't spend its bounce while
still invisible.

**Sound distances.** `sound`'s refDistance/maxDistance are world units;
they're multiplied by the entity's world scale once the sound has loaded,
so a "fades within 4 units" sound stays proportional inside a scaled scene
(like [Placement](PLACEMENT-FEATURE-GUIDE.md)'s `scaleSounds`, which only
sees sounds present at placement time).

## 4. Incompatibilities, risks & troubleshooting

- **Audio before a gesture.** On iOS a spawned model's sound stays silent
  unless audio was unlocked by a tap first — start the sequence inside a
  tap handler.
- **Many models.** Every spawn is a new glTF entity (the asset itself is
  loaded once and shared). Endless sequences (`count: 0`) keep adding;
  use `spawn-sequence-clear` or a finite count for long sessions.
- **Shared materials.** Spawned copies share the asset's materials — a
  component that mutates materials must clone them (all template
  components do).
- **Animations.** Spawned models don't get `animation-mixer`; for animated
  models listen to `spawn-sequence-spawned` and set it on `detail.el`.
  Frustum culling: put `no-frustum-cull` on the module root as usual.
- **Combining.** Spawned models are plain children; gestures or other
  components can be added in a `spawn-sequence-spawned` listener. The
  spawner itself writes nothing to its own transform, so it may sit on a
  placed or attached entity.
