# Proximity-cutout feature guide

Opens a dithered hole in a model centred on the camera as the camera
approaches, letting the camera "cut into" the model instead of clipping
through it or being blocked by it. Ported from `Madleen_module`. A separate
feature from proximity-fade (see `PROXIMITY-FADE-FEATURE-GUIDE.md`) — they
look related (both are camera-distance-driven material effects) but do
different things, take different attributes, and have separate guides, per
this project's `ADDING-FEATURES-WORKFLOW.md` workflow. Read
[4](#4-incompatibilities-risks--troubleshooting) below if a scene ever
combines the two on the same model.

Files:

```
src/a-frame-components/proximity-cutout.ts   # the whole feature — one file
src/manifest.ts                               # registers proximity-cutout
examples/proximity-cutout-usage.html           # scene wiring + attribute reference
```

No assets ship with this feature — it's pure shader logic operating on
whatever `gltf-model`s you already have in your scene.

## 1. Step-by-step: adding this to a new project

1. **Copy the file** — `proximity-cutout.ts` — into your project's own
   `src/a-frame-components/`. No path changes; already named per this
   template's convention (nothing to rename).

2. **Register it** in your project's `src/manifest.ts`:

   ```ts
   import proximityCutout from "./a-frame-components/proximity-cutout";

   export const manifest: Manifest = {
     assets: assetManifest.assets,
     components: {
       // ...whatever you already have...
       "proximity-cutout": proximityCutout
     }
   };
   ```

3. **Wire it onto a transform entity** wrapping one or more `gltf-model`
   children — see [2. Entities & attributes](#2-entities--attributes) or
   copy directly from `examples/proximity-cutout-usage.html`.

4. **Build and test** — `npm run build`, then `npm run dev` for a
   VR/desktop preview. The effect is purely camera-distance driven, so it's
   visible without a real device (move the preview camera toward the
   wrapped model).

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `radius` | number | `12` | Distance from the camera within which fragments are cut away entirely. |
| `feather` | number | `5` | Width of the dithered transition band, measured **inward** from `radius` — fully open at `radius - feather`, fully closed at `radius`. Keep `0 < feather <= radius`. |

```html
<a-entity proximity-cutout="radius: 2.5; feather: 0.3">
  <a-entity gltf-model="#SomeModel" position="0 0 0" shadow></a-entity>
</a-entity>
```

Put it on the transform entity that wraps the model(s) it should apply to —
`model-loaded` bubbles from every descendant `gltf-model`, so one instance
covers all of them. There's no `target` attribute (unlike proximity-fade) —
the cutout is always centred on the camera itself, not a configurable point,
and no singleton/manager entity is required.

## 3. Under the hood

A single component, no factory/patcher split like proximity-fade — there's
only one rendering technique here (a dithered discard in the fragment
shader), so there's no equivalent "which technique" question to answer.

### The shader patch

On each descendant model's `model-loaded`, every material is:

- Set to `THREE.DoubleSide` (so the inside surface exposed by the cutout is
  visible instead of back-face culled).
- Given an `onBeforeCompile` that injects a world-position varying and, in
  the fragment shader, discards fragments within `radius` of the camera
  (`uCenter`, updated every `tick()`), dithered across a `feather`-wide band
  via a screen-space noise threshold rather than a hard edge.
- Given a distinct `customProgramCacheKey` — A-Frame 1.3.0's three.js (r137)
  doesn't fold `onBeforeCompile` into the program cache key on its own, so
  without this a patched material could be handed a shader program compiled
  for an *unpatched* material with otherwise-matching parameters (the same
  fix `proximity-fade-dither` needs, for the same reason).

`tick()` only updates the `uRadius`/`uFeather` uniform values (so changing
those attributes live takes effect immediately) and the camera-position
uniform driving `uCenter` — it doesn't re-run the shader patch itself, which
only happens once per material.

### Patch/restore lifecycle (hardened during the port)

**This was fixed during the port.** The original `Madleen_module` version
patched materials on `model-loaded` but never undid it in `remove()` — it
only removed the event listener and cleared its own `materials` array,
leaving every patched `Material` object permanently running the cutout
shader (`onBeforeCompile`, `customProgramCacheKey`, the flipped `side`) even
after the component itself was gone. That's invisible in a scene that never
adds/removes a `proximity-cutout` entity dynamically (which is how
`Madleen_module` uses it — the entity exists for the module's whole
lifetime), but it's a real gap for any project that toggles this on/off at
runtime.

The universalized version snapshots each material's `onBeforeCompile`,
`customProgramCacheKey`, and `side` the first time it's patched, and
`remove()` now restores all three — mirroring the `MaterialPatcher.restore`
pattern `proximity-fade-shared.ts` already used. It also now guards against
patching the same material twice (relevant if `model-loaded` fires more than
once for a shared material instance), matching the same guard
`proximity-fade-shared.ts` already had.

## 4. Incompatibilities, risks & troubleshooting

### `proximity-cutout` vs. `proximity-fade`/`-dither` on the *same* material

**The main thing to know before combining this with the fade feature.** Both
features patch a material's `onBeforeCompile`/`customProgramCacheKey`
directly, and neither *composes* with the other — each just **overwrites**
whatever was already there. If a `proximity-cutout` wrapper and a
`proximity-fade`/`proximity-fade-dither` wrapper are both ancestors of the
same `gltf-model` (so both receive its `model-loaded` event and both patch
the same material object), whichever patches **last** wins — the other
effect is silently inactive on that material while both components stay
mounted. Since each component's `remove()` now correctly restores whatever
it found at patch time (see [3](#3-under-the-hood)), removing whichever
patched last does bring the earlier one's effect back — but while both are
live, you only get one.

`Madleen_module`'s real scene doesn't hit this — `proximity-cutout` wraps
`#Aussen1`/`#Aussen5`, while the `proximity-fade`/`-dither` variants there
wrap separate entities referencing `#Aussen2`/`#Aussen3`/`#Aussen4`/`#Aussen5`
— but note `#Aussen5` appears under *both* a `proximity-cutout` wrapper and
a `proximity-fade` wrapper in that scene, on what are presumably (see the
next note) separate entity/material instances rather than one shared
material patched twice. If a new project intentionally wants both a cutout
and a fade effect on the very same object, that isn't supported out of the
box by either component as ported — it would need deliberate composition
(chaining into the existing `onBeforeCompile` rather than replacing it).

### Multiple entities referencing the same model id

Same caveat as `PROXIMITY-FADE-FEATURE-GUIDE.md`: whether two
`<a-entity gltf-model="#SameId">` entities end up sharing one `Material`
instance (and thus one component's patch clobbering another's) or get
independent ones depends on A-Frame/three.js glTF loading/caching behavior
not re-verified against this project's exact pinned versions while writing
this guide. Test directly if a new scene applies `proximity-cutout` to one
entity and something else (another `proximity-cutout` config, or a
`proximity-fade`) to a different entity referencing the same model id.

### Interaction with the sound and [Image Tracking](IMAGE-TRACKING-FEATURE-GUIDE.md) features

No interaction found with either. Like proximity-fade, this only patches
materials reached via a bubbled `model-loaded` event from a `gltf-model`
descendant — Image Tracking's video plane and the sound feature's
`a-plane`-based buttons never fire that event and are never touched
regardless of scene nesting. The one exception is the same one noted in the
fade guide: a `sound-button`/`ar-button` whose visible geometry is itself a
`gltf-model` nested inside a `proximity-cutout` wrapper would have its
material patched by this feature too — cutting a hole through a tappable
button is visually unusual but not a code conflict (this feature doesn't
touch `object3D.scale`, `ar-button`'s own fade/raycast mechanism, or vice
versa).

### Interaction with LOD + Billboard's dithered fade

Same category of risk as the `proximity-fade` one above, found while
porting the LOD feature (see `LOD-BILLBOARD-FEATURE-GUIDE.md`): an
`lod-object`'s `data-lod-dither` part also patches `material.onBeforeCompile`
+ `customProgramCacheKey`. Nest `proximity-cutout` and a dithered LOD part
around the exact same `gltf-model` and only one of the two effects renders
— neither composes with the other, whichever attaches last wins. Full
mental model in
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.4](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#44-onbeforecompile--program-caching).

### General constraints

- **No document-level listeners, no singleton/manager entity, no per-module
  scoping concerns** — every instance is fully self-contained, and multiple
  co-mounted modules each using this feature don't interact with each other
  at all (each only touches its own scene's materials).
- **Camera-agnostic** — reads `sceneEl.camera` only, never sets anything on
  `<a-camera>`, unaffected by `CAMERA_PROPS_FORBIDDEN`.
- **Keep `0 < feather <= radius`.** `feather <= 0` or `feather > radius`
  pushes the underlying GLSL `smoothstep(radius - feather, radius, dist)`
  outside its documented domain (its low edge needs to be below its high
  edge) — not validated/clamped by the component, so an out-of-range
  `feather` may render incorrectly rather than erroring. The defaults
  (`radius: 12; feather: 5`) and every value used in `Madleen_module`'s own
  scene are well inside this range.
