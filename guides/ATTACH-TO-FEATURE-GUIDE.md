# Attach-to feature guide

Makes an entity follow another entity's world position (plus a fixed
world-space offset), every frame — even if it isn't that entity's DOM
child. Applicable to any entity. Ported from `Gyumin_module` unchanged —
already fully generic in the source, see
[3. Under the hood](#3-under-the-hood).

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

2. **Register it** in your project's `src/manifest.ts`:

   ```ts
   import attachTo from "./a-frame-components/attach-to";

   export const manifest: Manifest = {
     assets: assetManifest.assets,
     components: {
       // ...whatever you already have...
       "attach-to": attachTo
     }
   };
   ```

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

Originally built as this project's stand-in for 8th Wall's
`xrextras-attach`, specifically so something (a light, in the source) could
track the host-provided camera even though it isn't a DOM child of it —
`target: #camera` is the common case, but `target` accepts any resolvable
selector, so this works for tracking any entity, not just the camera.

### What changed from the source

Nothing — checked deliberately, not skipped. Every tunable (`target`,
`offset`) is a freely-set schema attribute; nothing hardcoded to a specific
entity id, naming convention, or scene structure. The lazy per-tick target
resolution (rather than caching it once in `init()`) was already a
deliberate, generic design choice in the source, not something added by
this port.

## 4. Incompatibilities, risks & troubleshooting

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
