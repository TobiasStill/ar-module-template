# Ground-decal feature guide

Keeps a decal plane flat on the ground directly under its parent entity's
pivot, regardless of how the parent is rotated/tilted, and excludes it from
scene fog so it doesn't fade with distance the way ordinary geometry does.
Applicable to any entity with a parent — a `gltf-model` or a plain A-Frame
primitive. Ported from `Gyumin_module` — see
[3. Under the hood](#3-under-the-hood) for two real fixes this port made.

Files:

```
src/a-frame-components/ground-decal.ts
examples/ground-decal-usage.html   # scene wiring + full attribute reference
```

No assets. Requires a parent entity — see
[4. Incompatibilities](#4-incompatibilities-risks--troubleshooting).

## 1. Step-by-step: adding this to a new project

1. **Copy the file** — `ground-decal.ts` — into your project's own
   `src/a-frame-components/`. No path changes, no data files.

2. **Register it** in your project's `src/manifest.ts`:

   ```ts
   import groundDecal from "./a-frame-components/ground-decal";

   export const manifest: Manifest = {
     assets: assetManifest.assets,
     components: {
       // ...whatever you already have...
       "ground-decal": groundDecal
     }
   };
   ```

3. **Wire it into the scene** — see
   [2. Entities & attributes](#2-entities--attributes) or copy directly
   from `examples/ground-decal-usage.html`. The decal entity must be a
   **child** of whatever it should stay pinned under.

4. **Build and test** — `npm run build`, then `npm run dev`. Tilt/rotate
   the parent to confirm the decal stays flat on the ground rather than
   tilting with it.

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `groundY` | number | `0` | World-space Y height of the ground plane the decal sits on. |
| `live` | boolean | `false` | `false` (default) applies the flat-on-ground placement once and stops — cheapest option, correct for a static parent. `true` recomputes every frame — needed only if the parent itself moves/rotates after placement. |

```html
<a-entity gltf-model="#Statue" rotation="0 30 15" position="0 0 -5">
  <a-entity gltf-model="#StatueShadowDecal" ground-decal="groundY: 0"></a-entity>
</a-entity>
```

Nothing to call — applies automatically. Fog exclusion applies as soon as
the decal's mesh is available; placement applies on the next tick after
that.

## 3. Under the hood

Every tick (or once, if `live: false` and already applied): reads the
parent's world rotation and computes the local rotation that would make
this entity's *world* orientation exactly flat (texture facing +Y) — so the
decal visually ignores whatever tilt the parent carries. Position is
computed the same way: take the parent's world X/Z, fix Y to `groundY`,
convert that world point into the parent's local space, and write it as
this entity's local position.

Separately, on the entity's own mesh becoming available, every material is
cloned and has `fog = false` set on it, taking the decal out of the scene's
fog computation entirely (so it doesn't dim with distance the way ordinary
geometry does — a decal is meant to read as flat on a surface, not as an
object receding into haze).

### Two fixes made during this port

**Primitive support for the fog exclusion.** The source only listened for
`gltf-model`'s own `model-loaded`, which never fires for a plain A-Frame
primitive — the same gap found and fixed in every other material-touching
component on this branch (see
[RENDER-ORDER-FEATURE-GUIDE.md §3](RENDER-ORDER-FEATURE-GUIDE.md#3-under-the-hood)
for the original finding). Switched to `object3dset` plus an immediate
check.

**Clone before mutate — a real, previously-latent bug.** The source set
`fog = false` directly on each mesh's material **in place**, without
cloning it first. A glTF asset loaded via `gltf-model` shares one material
object across every instance of that asset unless something clones it
first — see
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.2](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#42-materials-must-be-cloned-before-mutating).
Concretely: two `ground-decal` instances placed at different distances but
sharing the same decal asset would, on the source as written, share one
material — disabling fog on the nearer instance would silently also
disable it on the farther one, which should still visibly fade with
distance. This port clones each material on first encounter (marked via
`userData.groundDecalOwner`, matching the ownership-marker pattern
[`material-properties`](MATERIAL-PROPERTIES-FEATURE-GUIDE.md) already
uses) so every instance owns an independent copy.

## 4. Incompatibilities, risks & troubleshooting

### Requires a parent — not usable on a root-level entity

`tick()` reads `self.el.object3D.parent` and returns immediately if there
is none. This is inherent to what the component does (stay pinned under a
*parent's* pivot), not a bug — a decal with no parent has nothing to stay
"under". Always nest the decal entity inside whatever it should track.

### Real conflict with anything else that writes `position`/`rotation` every tick (when `live: true`)

With `live: true`, this writes `position` and `quaternion` every tick, with
no awareness of what else might also be writing them. The same
same-element registration-order conflict documented for
[`attach-to`](ATTACH-TO-FEATURE-GUIDE.md#4-incompatibilities-risks--troubleshooting)
applies here too if combined with `wander-in-band`/`proximity-wave` on the
same entity. With the default `live: false`, this only writes once, so the
window for conflict is much narrower (whichever of the two components
happens to apply first on that one frame "wins" the entity's resting
transform) but not zero — prefer keeping a `ground-decal` entity free of
other transform-writing components regardless of `live`.

### No interaction found with any other feature on this branch

Beyond the transform-writing conflict above, this doesn't touch `document`
listeners, shared/global state, `renderOrder`, or camera. Free to combine
with `random-field` (each clone gets its own `ground-decal` instance,
independently tracking its own parent), `ar-button`/`sound-button`,
`trim-loop-clip`, or any other feature with no interaction at all.
