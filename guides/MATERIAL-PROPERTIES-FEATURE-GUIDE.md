# Material properties feature guide

Manually tunes a loaded model's PBR material properties — roughness,
metalness, opacity, and emissive intensity/tint — directly on whatever
material the glTF/primitive already has (typically `MeshStandardMaterial`),
without discarding it the way [unlit-material](LOD-BILLBOARD-FEATURE-GUIDE.md#unlit-material)
does. Applicable to any entity — a `gltf-model` or a plain A-Frame primitive.

Combines two needs that don't exist anywhere else in this project's source
branches into one component, rather than shipping them separately — see
[3. Under the hood](#3-under-the-hood) for why:

1. **Manual roughness/metalness/opacity control.** No equivalent existed in
   any `_module` branch — the closest thing found was `Gyumin_module`'s
   `camera-reflection.ts` (a dead/unregistered prototype), which hardcodes
   `metalness = 1; roughness = 0` for one specific chrome-mirror effect
   rather than exposing them as general-purpose attributes.
2. **Emissive glow tuning**, ported from `Gyumin_module`'s
   `emissive-material.ts` (`intensity`/`tint` attributes here renamed to
   `emissiveIntensity`/`emissiveTint`, since this component also covers
   unrelated properties where a bare "intensity" would be ambiguous), plus a
   real `KHR_materials_emissive_strength` extension workaround — see
   [3](#3-under-the-hood).

Files:

```
src/a-frame-components/material-properties.ts
examples/material-properties-usage.html   # scene wiring + full attribute reference
```

No assets. **Read [RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md)
before combining this with `unlit-material`, `dither-material`, or either
proximity feature** — several real ordering conflicts are documented there,
not here (see [4](#4-incompatibilities-risks--troubleshooting)).

## 1. Step-by-step: adding this to a new project

1. **Copy the file** — `material-properties.ts` — into your project's own
   `src/a-frame-components/`. No path changes, no data files.

2. **Register it** in your project's `src/manifest.ts`:

   ```ts
   import materialProperties from "./a-frame-components/material-properties";

   export const manifest: Manifest = {
     assets: assetManifest.assets,
     components: {
       // ...whatever you already have...
       "material-properties": materialProperties
     }
   };
   ```

3. **Wire it into the scene** — see
   [2. Entities & attributes](#2-entities--attributes) or copy directly
   from `examples/material-properties-usage.html`.

4. **Build and test** — `npm run build`, then `npm run dev`. Roughness and
   metalness changes are easiest to see under real (or simulated) lighting
   at a glancing angle; opacity and emissive changes are visible under any
   lighting.

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `roughness` | number | `-1` (don't override) | `>= 0` forces `material.roughness` on every mesh that has one. No-ops on a material with no `roughness` property (e.g. one already converted by `unlit-material`). |
| `metalness` | number | `-1` (don't override) | Same as `roughness`, for `material.metalness`. |
| `opacity` | number | `-1` (don't override) | `>= 0` forces `material.opacity`. If the resulting value is `< 1`, also forces `material.transparent = true` (opacity alone does nothing visually unless the material is flagged transparent) — left untouched if the value is `>= 1`. |
| `emissiveIntensity` | number | `1` | Multiplier on top of the *resolved* emissive intensity (see [3](#3-under-the-hood) for what "resolved" means) — `1` = no change. |
| `emissiveTint` | color | `""` (none) | Hex colour multiplied into the emissive colour. |
| `disableShadow` | boolean | `false` | Forces `castShadow`/`receiveShadow` off. Off by default — see [3](#3-under-the-hood) for why this isn't the source's original unconditional behaviour. |

```html
<a-entity gltf-model="#Statue" material-properties="metalness: 1; roughness: 0.1"></a-entity>
<a-entity gltf-model="#Glass" material-properties="opacity: 0.4"></a-entity>
<a-entity gltf-model="#Glow" material-properties="emissiveIntensity: 2; emissiveTint: #ff2d55; disableShadow: true"></a-entity>
```

Reactive: changing any attribute at runtime (e.g.
`el.setAttribute('material-properties', 'opacity: 1')`) re-applies
immediately without needing a reload.

## 3. Under the hood

Listens for `object3dset` (filtered to `detail.type === "mesh"`) plus an
immediate check in case the mesh is already present — the same pattern
every other material-mutating component in this template uses, so this
also works on a plain primitive.

### Why this couldn't just extend `unlit-material`

`unlit-material` deliberately **replaces** a material with a flat
`MeshBasicMaterial`, discarding roughness/metalness/emissive entirely — the
whole point is to stop responding to scene lighting. This component does
the opposite: it keeps whatever real, lit material is already there and
only *tunes* a few of its numeric properties. Cramming both intents into
one component's schema would make "flatten to unlit" and "tune the
existing PBR material" fight over the same attributes for no benefit — see
[4](#4-incompatibilities-risks--troubleshooting) for what happens if both
end up on the same entity anyway.

### Why emissive tuning was merged in, not kept as its own component

Both needs (numeric PBR overrides, and emissive tuning) traverse the same
mesh graph, clone the same materials, and need the same ownership-guard
idempotency check — see the clone-ownership paragraph below. Two separate
components doing that independently would double the clone/traversal cost
per apply and double the same-element registration-order surface
documented in
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §5.2](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#52-multiple-components-mutating-nodematerial-on-the-same-element--order-matters)
for no real benefit — the same reasoning `unlit-material`'s own attribute
set (`keepEmissive`/`brightness`/`tint`/`alphaTest`/`keepShadowBehavior`)
already grew from across two separate ports.

### Clone ownership, and why it matters for `update()`

Each material is cloned exactly once, the first time this component sees
it, and marked via `material.userData.materialPropertiesOwner = this` —
every later apply (including ones triggered by `update()` after a runtime
attribute change) checks that marker: if it's already this component
instance's own clone, it mutates that same clone directly instead of
re-cloning. This matters for two separate reasons:

- **Shared source materials.** A glTF asset loaded via `gltf-model` shares
  one material object across every instance of that asset (e.g. several
  [`random-field`](RANDOM-FIELD-FEATURE-GUIDE.md) clones of the same
  referenced entity) unless something clones it first — see
  [RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.2](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#42-materials-must-be-cloned-before-mutating).
  Without per-instance clone ownership, tuning one instance's roughness
  would leak onto every other clone sharing that source material.
- **Correct `update()` semantics.** The emissive intensity/tint math is
  derived fresh every apply from a *snapshot* of the base (pre-attribute)
  emissive intensity/colour, captured once at clone time
  (`userData.baseEmissiveIntensity`/`baseEmissiveColor`) — not accumulated
  by repeatedly multiplying the live value. Re-authoring
  `emissiveIntensity` from `2` to `3` at runtime yields `base * 3`, not
  `base * 2 * 3`. Getting this wrong (mutating `emissiveIntensity`/
  `emissive` in place on every call) would silently compound on every
  runtime attribute change — a real bug this design avoids, not merely a
  style choice.

### `KHR_materials_emissive_strength`

A model's materials may use this glTF extension (set in Blender) to push
`emissiveIntensity` above the extension's un-boosted `0..1` range — but
A-Frame's bundled three.js predates that extension's native `GLTFLoader`
support. On an unsupported extension, `GLTFLoader` still preserves the raw
values on `material.userData.gltfExtensions` instead of applying them, so
`emissiveIntensity` silently stays at its `1.0` default and the glow reads
as dim/flat rather than the boosted brightness the artist authored. This is
reapplied by hand from the preserved raw data, unconditionally — a
correctness fix, not an opt-in behaviour, exactly matching the source
component's own logic.

### `disableShadow` defaults to `false`, unlike the source

The source `emissive-material.ts` always forced `castShadow`/
`receiveShadow` off unconditionally — correct for its one specific use case
(a glowing "light-emitting" part shouldn't cast a shadow of its own light),
but wrong as a silent default for a *generic* material-tuning component
(e.g. tuning metalness/roughness on an ordinary shadow-casting statue
should obviously not also turn its shadow off). This port makes it an
explicit opt-in instead, defaulting to leaving shadow behaviour untouched —
the least-surprising default for the broader audience this component is
meant to serve.

## 4. Incompatibilities, risks & troubleshooting

### Real conflict with `unlit-material` — do not combine on the same entity

`unlit-material` replaces `node.material` outright with a
`MeshBasicMaterial`, which has no `roughness`/`metalness`/`emissive`
properties at all. Whichever component's `object3dset` listener fires
first on a shared entity wins the outcome, and the loser silently no-ops
(this component's `"roughness" in owned` / `"metalness" in owned` /
`"emissive" in owned` checks are specifically there so it fails quietly
rather than throwing — but the *effect* is still lost). Same category of
conflict as the one already documented between `unlit-material` and
`proximity-fade`/`proximity-cutout` — see
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.5](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#45-unlit-material-replaces-materials--a-different-risk-than-onbeforecompile-collisions).
Don't put both on the same entity.

### Combining with `dither-material` — order matters, but it's usable

Both components clone-then-mutate the same material rather than replacing
it outright, so combining them (e.g. tune roughness/opacity here, then
dither the result) is a plausible, supported use — but same-element
registration order decides who operates on whose output, per
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §5.2](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#52-multiple-components-mutating-nodematerial-on-the-same-element--order-matters).
Author `material-properties` before `dither-material` in markup if you want
the tuned values to be what gets dithered.

### No interaction found with any other feature on this branch

Doesn't touch `document` listeners, shared/global state, `renderOrder`, or
`onBeforeCompile` — only ever writes scalar material properties on meshes
inside its own entity's loaded model. Free to combine with `random-field`,
`proximity-wave`, `follow-node`, `wander-in-band`, `ar-button`/
`sound-button`, `mirror-shard`/`liquid-texture`, `render-order`, and
`mesh-render-order` with no interaction at all.
