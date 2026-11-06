# Attach-to feature guide

<!-- overview -->
## Overview

Glues one object to another without making it its child: wherever the
target goes, the attached object goes along, keeping the same distance. A
light can hover above the visitor's head wherever they walk, a label can
float next to a moving figure, a sparkle can trail a flying object. Only
the position follows — the attached object keeps its own rotation and
size.

<!-- /overview -->

## Technical summary

Makes an entity follow another entity's world position (plus a fixed
world-space offset), every frame — even if it isn't that entity's DOM
child. Applicable to any entity — see
[3. Under the hood](#3-under-the-hood).

<!-- project-specific -->
### Project context: origin

Ported from `Gyumin_module` unchanged — already fully generic there (see
§3 "What changed from the source"). The `space: parent` option was added
later from the Augmented Bahnhofsviertel ports' `legacy-attach`.

<!-- /project-specific -->

Files:

```
src/a-frame-components/attach-to.ts
examples/attach-to-usage.html   # scene wiring + full attribute reference
```

No assets. Writes `object3D.position` every tick — read
[4. Incompatibilities](#4-incompatibilities-risks--troubleshooting) before
putting this on the same entity as `wander-in-band` or `proximity-wave`.

## 1. Step-by-step: adding this to a new project

1. **Copy the file** — `attach-to.ts` — into your project's own
   `src/a-frame-components/`. No path changes, no data files.

2. **Nothing to register** — every component file in
   `src/a-frame-components/` is registered automatically under its file
   name as soon as the scene uses it (README, "The manifest"); unused ones
   aren't even bundled. Only a component registered under a different name,
   or one whose name is built at runtime, needs a manual entry in
   `src/manifest.ts`.

3. **Wire it into the scene** — see
   [2. Entities & attributes](#2-entities--attributes) or copy directly
   from `examples/attach-to-usage.html`.

4. **Build and test** — `npm run build`, then `npm run dev`. Easiest to
   verify by attaching something to a moving entity (or the camera, via a
   VR/desktop preview's WASD movement) and watching it track.

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `target` | selector | — | The entity to follow. Resolved on every tick, not cached — works even if the target mounts *after* this entity does. |
| `offset` | vec3 | `{x:0, y:0, z:0}` | Added to the target's world position, in world-space units, before converting into this entity's own parent space. |
| `space` | string | `world` | `world`: `offset` in world units/axes (as above). `parent`: `offset` added *after* converting into the parent's space, so it scales and turns with the parent — what `xrextras-attach` effectively did for elements sharing a parent, and what a scaled scene ([Placement](PLACEMENT-FEATURE-GUIDE.md) with `referenceHeight`) needs. |

```html
<a-entity
    light="type: point; intensity: 1"
    attach-to="target: #camera; offset: 0 1 0">
</a-entity>
```

Position only — rotation and scale are left completely untouched, so this
composes with anything you set on those directly.

## 3. Under the hood

Every tick: reads the target's world position via
`targetEl.object3D.getWorldPosition()`, adds `offset` in world space, then
converts that world point into this entity's own **parent's** local space
(`parent.worldToLocal()`) before writing it to `object3D.position` — so the
result lands correctly regardless of what transform this entity's own
parent carries, without this component needing to know or care about that
parent's transform itself.

It is the template's stand-in for 8th Wall's `xrextras-attach`: something
(e.g. a light) can track the host-provided camera even though it isn't a DOM
child of it. `target: #camera` is the common case, but `target` accepts any
resolvable selector, so this works for tracking any entity, not just the
camera. Every tunable (`target`, `offset`, `space`) is a freely-set schema
attribute; nothing is hardcoded to a specific entity id, naming convention,
or scene structure. The target is resolved lazily on every tick (rather
than cached once in `init()`), so it may mount later than this entity.

<!-- project-specific -->
### Project context: `Gyumin_module`

#### What changed from the source

Nothing — checked deliberately, not skipped. In `Gyumin_module` it attached
a light to the camera; the lazy per-tick target resolution was already a
deliberate, generic design choice there, not something added by the port.

<!-- /project-specific -->

## 4. Incompatibilities, risks & troubleshooting

### Shares the entity transform with Placement & Gestures — don't combine on one entity

[`place-in-front`](PLACEMENT-FEATURE-GUIDE.md) writes position/rotation/scale
on every placement, and [`gesture-control`/`hold-drag`](GESTURES-FEATURE-GUIDE.md)
write them while a gesture runs. Put this component on a parent or child of
such an entity, never on the same one (found while adding those features).

### Real conflict with anything else that writes `position` every tick

This component sets `object3D.position` directly, every tick, with no
awareness of what else might also be writing it. Putting `attach-to` on
the same entity as [`wander-in-band`](WANDER-IN-BAND-FEATURE-GUIDE.md) or
[`proximity-wave`](PROXIMITY-WAVE-FEATURE-GUIDE.md) (both of which also
write `position` unconditionally every tick) means whichever component's
`tick()` runs last on that entity — same-element registration order, the
same rule documented in
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §5.2](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#52-multiple-components-mutating-nodematerial-on-the-same-element--order-matters)
for materials — simply overwrites whatever the other one just set, with no
composition between the two. Don't combine `attach-to` with either on the
same entity; if you need "wander around a point that itself moves", put
`attach-to` on a separate parent entity and `wander-in-band` on a child of
it instead (their transforms compose naturally through the normal
parent/child hierarchy, since `wander-in-band` writes its own *local*
position relative to whatever parent it has).

### `random-field` composes fine — it only places once

[`random-field`](RANDOM-FIELD-FEATURE-GUIDE.md) only writes `position` once,
at clone/placement time, not every tick — so `attach-to` placed on a
prototype entity that `random-field` clones works as expected (each clone
gets its own `attach-to` instance, independently tracking its own target).

### No target resolved

If `target` doesn't resolve (typo in the selector, or the target entity not
yet in the DOM), `tick()` simply returns early — no console warning, no
crash, the entity just stays wherever it was last positioned. Once `target`
does resolve on some later tick, following starts from that point on.

### No interaction found with any other feature on this branch

No `document` listeners, no shared/global state, no material patches, no
`renderOrder`. Free to combine with `ar-button`/`sound-button`,
`follow-node`, `trim-loop-clip`, or any material-touching component with no
interaction at all.
