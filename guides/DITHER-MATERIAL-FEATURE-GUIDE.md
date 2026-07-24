# Dither material feature guide

Screen-door dithered transparency for a loaded model's materials — a
**manual, fixed-opacity** dither, not driven by camera distance.
Applicable to any entity — a `gltf-model` or a plain A-Frame primitive.
Ported from `Fanyu_module`'s `dither-transparency.ts`, renamed to fit this
project's `[x]-material` naming (see
[unlit-material](LOD-BILLBOARD-FEATURE-GUIDE.md#unlit-material),
[material-properties](MATERIAL-PROPERTIES-FEATURE-GUIDE.md)) and to
distinguish it from the two *distance-driven* dither variants already in
this template — see [3. Under the hood](#3-under-the-hood) for two real
fixes this port made, plus a `ditherType` attribute added after the port
(purely aesthetic — see [2](#2-entities--attributes)), and
[4. Incompatibilities](#4-incompatibilities-risks--troubleshooting) for why
this is now a **fourth** independent `onBeforeCompile`-based dithering
implementation in this codebase, and what that means for combining it with
the other three.

Files:

```
src/a-frame-components/dither-material.ts
examples/dither-material-usage.html   # scene wiring + full attribute reference
```

No assets. **Read [RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md)
before using this** — the dithering mental model (why a screen-door discard
instead of real alpha blending, `customProgramCacheKey` collisions) is
covered there, not repeated here.

## 1. Step-by-step: adding this to a new project

1. **Copy the file** — `dither-material.ts` — into your project's own
   `src/a-frame-components/`. No path changes, no data files.

2. **Register it** in your project's `src/manifest.ts`:

   ```ts
   import ditherMaterial from "./a-frame-components/dither-material";

   export const manifest: Manifest = {
     assets: assetManifest.assets,
     components: {
       // ...whatever you already have...
       "dither-material": ditherMaterial
     }
   };
   ```

3. **Wire it into the scene** — see
   [2. Entities & attributes](#2-entities--attributes) or copy directly
   from `examples/dither-material-usage.html`.

4. **Build and test** — `npm run build`, then `npm run dev`. The dot
   pattern is easiest to judge on-device (or in a VR/desktop preview) at
   the actual scale/distance the object will be viewed at.

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `opacity` | number | `-1` (keep each material's own alpha) | `>= 0` overrides every mesh's material opacity before dithering — higher values dither a denser/more-solid-looking pattern, lower values a sparser one. |
| `ditherType` | string | `"bayer"` | Which dither pattern to use — `"bayer"`, `"noise"`, or `"interleaved-gradient"`. Purely aesthetic, no functional difference; see the table below for what each looks like. An unrecognised value falls back to `"bayer"` with a console warning. |

```html
<a-entity gltf-model="#glass" dither-material></a-entity>
<a-entity gltf-model="#glass" dither-material="opacity: 0.4"></a-entity>
<a-entity gltf-model="#glass" dither-material="ditherType: noise"></a-entity>
```

### `ditherType` options

Each option reuses the *exact* formula already used elsewhere in this
codebase for that visual pattern, rather than inventing new ones — so
picking one here matches the equivalent look already established by an
existing feature:

| `ditherType` | Looks like | Same formula as |
|---|---|---|
| `bayer` (default) | A visibly regular 8×8 ordered grid/crosshatch pattern. | `proximity-fade-dither.ts` |
| `noise` | A per-pixel pseudo-random hash — grainy, no repeating structure, but can visibly clump since it isn't evenly distributed. | `proximity-cutout.ts` |
| `interleaved-gradient` | The Jimenez interleaved-gradient-noise formula — soft diagonal streaks, a middle ground between the other two, the common real-time-rendering choice. | `lod-object.ts`'s `setupDitherMaterial()` |

Reactive: changing `opacity` or `ditherType` at runtime re-applies
immediately — a `ditherType` change forces a shader recompile (see
[3](#3-under-the-hood)), same cost as any other `onBeforeCompile` change.
Removing the component (or unmounting the entity) restores every affected
material's original `transparent`/`depthWrite`/`opacity`/`onBeforeCompile`/
`customProgramCacheKey` — this is the only material-mutating component in
this family with a real `remove()` teardown; see [3](#3-under-the-hood) for
why that matters more here than for the scalar-property components.

## 3. Under the hood

Listens for `object3dset` (filtered to `detail.type === "mesh"`) plus an
immediate check in case the mesh is already present, then traverses every
mesh and (re)places its material with a dithered clone. The dither itself
injects the selected pattern's threshold function into the fragment shader
(`onBeforeCompile`, pinned to a distinct `customProgramCacheKey` — see
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.4](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#44-onbeforecompile--program-caching)
for why that pin is required) and forces the material into the **opaque**
render queue (`transparent: false`, `depthWrite: true`) so the discard —
not draw order — is what makes it see-through. This template's other two
dither-writers each independently picked a different pattern of their own:
`proximity-fade-dither.ts` already uses the same ordered Bayer pattern this
component defaults to, `proximity-cutout.ts` uses the pseudo-random hash,
and `lod-object.ts`'s `setupDitherMaterial()` uses interleaved gradient
noise — `ditherType` (added after the port, not part of the source) simply
exposes the choice between the three formulas that already existed
somewhere in this codebase, rather than fixing this component to just one.

### Why the program cache key includes `ditherType`

`owned.customProgramCacheKey` is `"dither-material-" + ditherType`, not a
static string — three.js's default cache key doesn't fold in
`onBeforeCompile` edits at all (see
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.4](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#44-onbeforecompile--program-caching)),
so a static key here would let a `bayer`-dithered material and a
`noise`-dithered material silently share one compiled program — whichever
of the two compiled first would "win" and both would render with the same
pattern, regardless of what `ditherType` was actually set on either
entity. Including `ditherType` in the key guarantees each pattern always
gets (and keeps) its own compiled program, including when `ditherType`
changes on an already-mounted entity at runtime.

### Two fixes made during this port

**Primitive support.** The source only listened for `gltf-model`'s own
`model-loaded`, which never fires for a plain A-Frame primitive — the same
gap found and fixed in every other material-mutating component on this
branch (see
[RENDER-ORDER-FEATURE-GUIDE.md §3](RENDER-ORDER-FEATURE-GUIDE.md#3-under-the-hood)
for the original finding). Switched to `object3dset` plus an immediate
check, matching the rest of this family.

**Clone before mutate — a real, previously-latent bug.** The source
mutated each material **in place**, without cloning it first. A glTF asset
loaded via `gltf-model` shares one material object across every instance of
that asset (e.g. several [`random-field`](RANDOM-FIELD-FEATURE-GUIDE.md)
clones of the same referenced entity) unless something clones it first —
see
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.2](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#42-materials-must-be-cloned-before-mutating).
Concretely, on the source as written: a second `dither-transparency`
instance sharing that same source material would see the idempotency flag
the first instance already set directly on the shared object and silently
no-op — no visible dithering on the second instance at all — and calling
`remove()` on *either* instance would revert the *shared* material,
un-dithering the still-mounted other instance too. This port clones each
material on first encounter (marking the clone itself, not the shared
original, via `userData.__ditherMaterial`) so every instance owns an
independent copy, exactly like every other material-mutating component in
this template already does.

## 4. Incompatibilities, risks & troubleshooting

### A fourth `onBeforeCompile` writer — same collision rule as the other three

This template now has **four** independent components that patch
`material.onBeforeCompile` with a pinned `customProgramCacheKey`:
`proximity-fade-dither`, `proximity-cutout`, `lod-object`'s internal
`setupDitherMaterial()`, and now this one. All four follow the same
"whichever patches a given material last wins, the other goes silently
inert" rule already documented in
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.4](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#44-onbeforecompile--program-caching) —
this port doesn't change that rule, it just adds a fourth participant to
it. Don't target the same material with `dither-material` and any of the
other three at once.

### Combining with `material-properties` — order matters, but it's usable

Both clone-then-mutate the same material rather than replacing it
outright, so tuning roughness/metalness/opacity *then* dithering the
result is a plausible, supported combination — but same-element
registration order decides who operates on whose output, per
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §5.2](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#52-multiple-components-mutating-nodematerial-on-the-same-element--order-matters).
Author `material-properties` before `dither-material` in markup if you
want the tuned values to be what gets dithered.

### Real conflict with `unlit-material` — do not combine on the same entity

`unlit-material` replaces `node.material` outright with a
`MeshBasicMaterial` before this component ever sees it (or discards this
component's dithered clone if it runs afterward) — same category of
conflict already documented for `proximity-fade`/`proximity-cutout` vs.
`unlit-material`, see
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.5](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#45-unlit-material-replaces-materials--a-different-risk-than-onbeforecompile-collisions).

### No interaction found with any other feature on this branch

Doesn't touch `document` listeners, shared/global state, `renderOrder`, or
camera — only ever writes `node.material` on meshes inside its own
entity's loaded model. Free to combine with `random-field`,
`proximity-wave`, `follow-node`, `wander-in-band`, `ar-button`/
`sound-button`, `mirror-shard`/`liquid-texture`, `render-order`, and
`mesh-render-order` with no interaction at all.
