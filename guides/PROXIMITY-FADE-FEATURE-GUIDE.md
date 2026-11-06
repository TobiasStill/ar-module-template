# Proximity-fade feature guide

<!-- overview -->
## Overview

Makes objects appear and disappear depending on how close the visitor is
to a certain spot. Approaching, a model slowly materialises out of thin
air; come even closer and it can dissolve again — like a ghost that is
only visible from the right distance. Fading in and fading out can be used
alone or together. Two looks are available: a smooth, glassy fade, or a
grainy "screen door" fade that stays clean when several see-through
objects overlap.

<!-- /overview -->

## Technical summary

Fades a model's opacity in and/or out as the camera approaches a configurable
target point — two independent, order-independent ramps (fade-in, fade-out)
that combine into one appear-then-disappear "window." Two interchangeable
rendering techniques (real alpha transparency vs. dithered opaque-pass) share
one implementation. **Not** the same feature as proximity-cutout (see
`PROXIMITY-CUTOUT-FEATURE-GUIDE.md`) — they look related but do different
things and have separate guides, per the project's
`ADDING-FEATURES-WORKFLOW.md` workflow.

<!-- project-specific -->
### Project context: origin

Ported from `Madleen_module`, which already split the feature into the
three files described in §3. The port made the fade ranges
order-independent (see §3).

<!-- /project-specific -->

Files:

```
src/a-frame-components/
  proximity-fade-shared.ts   # not a component: the shared schema/ramp/target logic
  proximity-fade.ts           # real alpha-blended transparency variant
  proximity-fade-dither.ts     # dithered opaque-pass transparency variant
(registered automatically by file name — nothing to add to src/manifest.ts)
examples/
  proximity-fade-usage.html    # scene wiring + full attribute reference
```

No assets ship with this feature — it's pure material/shader logic operating
on whatever `gltf-model`s you already have in your scene.

## 1. Step-by-step: adding this to a new project

1. **Copy the three component files** — `proximity-fade-shared.ts`,
   `proximity-fade.ts`, `proximity-fade-dither.ts` — into your project's own
   `src/a-frame-components/`. No path changes; these are flat files and
   already follow this template's `proximity-fade*` naming convention (see
   `src/manifest.ts`'s naming-convention comment) — nothing to rename.

2. **Nothing to register** — every component file in
   `src/a-frame-components/` is registered automatically under its file
   name as soon as the scene uses it (README, "The manifest"); unused ones
   aren't even bundled. Only a component registered under a different name,
   or one whose name is built at runtime, needs a manual entry in
   `src/manifest.ts`.

3. **Wire it onto a transform entity** wrapping one or more `gltf-model`
   children — see [2. Entities & attributes](#2-entities--attributes) or
   copy directly from `examples/proximity-fade-usage.html`. Pick
   `proximity-fade` or `proximity-fade-dither` per entity based on whether
   it overlaps other transparent materials in your scene (see the attribute
   reference for which to choose).

4. **Build and test** — `npm run build` (typechecks + bundles),
   `npm run dev` for a VR/desktop preview. The fade is purely
   distance-from-camera driven, so it's visible in any preview mode without
   needing a real device.

## 2. Entities & attributes

Both `proximity-fade` and `proximity-fade-dither` take the **exact same
schema** — they only differ in how the computed opacity is rendered (see
[3](#3-under-the-hood)):

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `fadeInStart` / `fadeInEnd` | number | `0` / `0` | Two distances from the camera, **in either order**. Whichever is farther is fully transparent, whichever is nearer is fully opaque. `0`/`0` is a true no-op — leave both alone if you only want fade-out. |
| `fadeOutStart` / `fadeOutEnd` | number | `0` / `0` | Two distances from the camera, in either order. Whichever is farther is fully opaque, whichever is nearer (closer to `target`) is fully transparent. `0`/`0` is a no-op — leave both alone if you only want fade-in. |
| `target` | vec3 | `0 0 0` | A **local** offset from this entity's own pivot/origin (converted to world space every frame) — the point distance is actually measured from. `0 0 0` is just this entity's own origin. |

```html
<a-entity
    id="window-effect"
    proximity-fade-dither="fadeInStart: 12; fadeInEnd: 9; fadeOutStart: 7; fadeOutEnd: 4; target: -1 0 -0.3">
  <a-entity gltf-model="#SomeModel" position="0 0 0" shadow></a-entity>
</a-entity>
```

Put it on the transform entity that wraps the model(s) it should apply to —
`model-loaded` bubbles up from each descendant `gltf-model`, so **one**
component instance covers all of them; you don't need one per model. No
singleton/manager entity is required anywhere (unlike the sound feature) —
each `proximity-fade`/`proximity-fade-dither` instance is fully independent
and reads the scene's camera directly.

See `examples/proximity-fade-usage.html` for four worked examples
(fade-in-only, fade-out-only, both combined, and a custom `target`).

## 3. Under the hood

### Why keep three files, not merge into one component with a `method` attribute

Collapsing the three files into one component with a `method` attribute
was considered and rejected:

- `proximity-fade-shared.ts` already **is** the deduplication: it's a
  factory, `createProximityFadeComponent(patcher)`, holding 100% of the
  schema, the ramp math, and the target/distance/material-collection logic
  in one place. `proximity-fade.ts` and `proximity-fade-dither.ts` are each
  ~25–75 lines implementing only a `MaterialPatcher` (`patch`/`restore`/
  `applyOpacity`) — the *rendering-technique-specific* part. There's no
  actual duplication left to remove; merging would mean inlining two
  unrelated shader-patching implementations behind an `if (data.method ===
  ...)` branch inside one file, which is strictly less clear than two small,
  obviously-independent leaf files.
- The two techniques are **not** just parameter differences — they patch
  materials in fundamentally incompatible ways (`proximity-fade` sets
  `material.transparent = true`; `proximity-fade-dither` sets `transparent =
  false`, `depthWrite = true`, and injects a shader `onBeforeCompile`).
  Switching `method` on a live entity would require detecting the change and
  un-patching/re-patching materials — real added complexity with no current
  use case (nothing here switches technique at runtime).
- A distinct component **name** per technique means the markup itself says
  which rendering technique an entity uses (`proximity-fade` vs.
  `proximity-fade-dither`), without needing to read an attribute value.
- This mirrors the sound feature's own generic/specific split (`ar-button` +
  variant-specific behavior layered on top via events) — same shape, same
  reasoning: a shared algorithm, pluggable technique-specific edges.

If a third rendering technique is ever needed, add one more small
`MaterialPatcher` + one more `createProximityFadeComponent(patcher)` call —
that's the whole extension point.

### Fade-in/fade-out order independence

`rampFactor(dist, distAtZero, distAtOne)` maps `distAtZero → 0`,
`distAtOne → 1`. Passing the attributes to it by position would only
produce the intended fade direction if the author always put the
**farther** distance in `fadeInStart` and the **nearer** in `fadeInEnd`
(and the opposite for fade-out) — swapping them would silently **invert**
the ramp (fading in as the camera moves *away*). So the component resolves
each ramp's own far/near anchor from the actual values instead of trusting
attribute position:

```ts
const fadeInFar = Math.max(data.fadeInStart, data.fadeInEnd);
const fadeInNear = Math.min(data.fadeInStart, data.fadeInEnd);
const fadeOutFar = Math.max(data.fadeOutStart, data.fadeOutEnd);
const fadeOutNear = Math.min(data.fadeOutStart, data.fadeOutEnd);

const fadeIn = rampFactor(dist, fadeInFar, fadeInNear);   // far -> 0, near -> 1
const fadeOut = rampFactor(dist, fadeOutNear, fadeOutFar); // near -> 0, far -> 1
```

Now `fadeInStart: 4; fadeInEnd: 6` and `fadeInStart: 6; fadeInEnd: 4` behave
**identically** — both fade in as the camera approaches. Same for
`fadeOutStart`/`fadeOutEnd`. This is what "the distance values determine the
order" means in practice: the ramp direction comes from comparing the two
numbers, never from which attribute name holds which one.

Fade-in and fade-out remain two genuinely different effects (opposite
near/far → opacity mappings by design, not swappable with each other), each
fully independent (defaulting to a true no-op at `0`/`0`), multiplied
together. See the next section for why that multiplication can't glitch
regardless of how the two ranges relate.

<!-- project-specific -->
#### Project context: `Madleen_module`

Order independence was added during the port — the behavior differs from
the original `Madleen_module` source, whose `tick()` computed:

```ts
const fadeIn = rampFactor(dist, data.fadeInStart, data.fadeInEnd);
const fadeOut = rampFactor(dist, data.fadeOutEnd, data.fadeOutStart);
```

Every usage in `Madleen_module`'s own `ArModule.vue` happens to follow the
far-then-near convention, so it never visibly broke there.

<!-- /project-specific -->

### Multiplying ramps: verified glitch-free for any overlap

Both ramps are independently `clamp()`ed to `[0, 1]` before multiplying, so
the product is always in `[0, 1]` too, for **any** relationship between the
two ranges:

- **Plateau** (fade-in's near anchor at or beyond fade-out's far anchor):
  both ramps read exactly `1` in between → the object is simply fully
  opaque for that whole stretch.
- **Gap** (fade-in's near anchor is closer than fade-out's far anchor):
  worked through numerically while re-verifying this feature — the combined
  opacity traces a single smooth, continuous bump that peaks somewhere below
  `1` and comes back down; never NaN, never a discontinuity, never
  oscillates. It just never reaches full opacity in that stretch — a visual
  choice to be aware of when tuning ranges, not a bug.
- **Deep overlap** (fade-out's whole range nested inside fade-in's still-
  transitioning range) — also re-verified numerically: the object rises to a
  small peak then falls back to (and stays at) fully transparent all the way
  to `target`, since this models **one** appear-then-disappear window, not a
  repeating effect. If you need the object to reappear again after fading
  out, that's outside this component's model — it would need a second,
  separately-triggered instance/entity.

A degenerate ramp (its two resolved values equal) is handled as a hard step
(`dist >= that value ? 1 : 0`) rather than dividing by zero — unaffected by
the order independence above, since `Math.max`/`Math.min` of two equal
numbers is just that number.

### `target` and distance tracking

`target` is stored as a local offset and converted to world space every
`tick()` via `object3D.localToWorld()` — so it stays correct regardless of
how the wrapper entity itself is positioned/rotated/scaled, without needing
a hand-maintained world coordinate. Distance is measured from the camera's
world position (`sceneEl.camera.getWorldPosition`) to that resolved target
point — the component never touches the `<a-camera>` element itself, so it
works identically regardless of who owns/drives the camera (relevant since
`CAMERA_PROPS_FORBIDDEN` already restricts what any module can set on the
shared camera anyway).

### Material collection & patch lifecycle

`model-loaded` bubbles from every descendant `gltf-model`, so a single
`proximity-fade`/`proximity-fade-dither` instance on a wrapper entity
collects materials from *all* of its children as each one finishes loading
— no per-model wiring needed. Each material is patched exactly once (guarded
by a `Map` keyed on the material object) even if `model-loaded` fires
multiple times or multiple children happen to share a material instance.
`remove()` restores every patched material to its pre-patch state via the
same map, so dynamically removing a `proximity-fade` entity (or toggling a
scene) doesn't leave materials permanently altered.

## 4. Incompatibilities, risks & troubleshooting

### Grain Shimmer chains, doesn't replace

[`grain-shimmer`](GRAIN-SHIMMER-FEATURE-GUIDE.md) clones the material and
chains an `onBeforeCompile` patch that is already on it. If this component
patches *after* grain-shimmer (replacing `onBeforeCompile`), the grain is
lost — set grain-shimmer last.

### `proximity-fade-dither` vs. `proximity-cutout` on the *same* material

**Read this if a project ever nests both around the same `gltf-model`.**
Both components patch a material's `onBeforeCompile` and
`customProgramCacheKey` directly — neither *composes* with another
component's patch, each just **overwrites** whatever was there. If a
`proximity-cutout` wrapper and a `proximity-fade`/`proximity-fade-dither`
wrapper are both ancestors of the same `gltf-model` (so `model-loaded`
reaches both, and both end up patching the same material object), whichever
one patches **last** wins — the other's shader injection is silently
inactive while both remain mounted. (Removing whichever patched last will
restore the earlier patch, since each component's `remove()` restores to
what it found at patch time — but while both are live, only one effect
actually renders.)

It's a real risk for any scene that intentionally wants both effects on the
same object. If you need both cutout and fade on the same model, they'll
need to be composed deliberately (e.g. one component chaining into the
other's `onBeforeCompile` rather than replacing it) — not supported out of
the box by either component.

### Multiple entities referencing the same model id

Both this feature and `proximity-cutout` mutate `Material` objects directly
(`material.opacity`, `material.transparent`, `material.onBeforeCompile`,
...). Whether two separate `<a-entity gltf-model="#SameId">` entities in
your scene end up sharing the *same* underlying `Material` instance (and
therefore fighting over these mutations) or get independent ones depends on
A-Frame/three.js's glTF loading/caching behavior for the pinned A-Frame
version — not something re-verified against this project's exact dependency
versions while writing this guide. If a project applies **different**
fade/cutout configs to multiple entities that reference the same model id,
**verify directly** that they animate independently rather than in lockstep
before relying on it.

<!-- project-specific -->
#### Project context: `Madleen_module`

`Madleen_module`'s real scene uses the same model ids (e.g. `#Aussen2`,
`#Aussen5`) under several differently-configured
`proximity-fade`/`proximity-cutout` wrappers simultaneously, with no
reported problem; `proximity-cutout` and the `proximity-fade*` variants
there wrap *different* model instances, so the same-material collision
above doesn't occur.

<!-- /project-specific -->

### Interaction with the sound feature already on this branch

`ar-button`/`sound-button` fade their OWN visibility via `object3D.scale`
(see `SOUND-FEATURE-GUIDE.md`), entirely independent of this feature's
`material.opacity` writes — no property collision. But if a button's visible
geometry is (or descends from) a `gltf-model` — see
`examples/ar-button-usage.html`'s "Example 2" — and that same entity or an
ancestor also carries `proximity-fade`/`-dither`, the two fades compound
without either knowing about the other: `ar-button-manager`'s raycast
eligibility (`isEnabled()`) only checks `ar-button`'s own `enabled` flag and
*its own* `near`/`far` fade factor, never material opacity — so a button
made invisible by `proximity-fade` (opacity `0`) but not also faded via
`ar-button`'s own `near`/`far` stays fully tappable/gazable while invisible.
(A-plane-based buttons, like the ones in `examples/sound-gui-panel.html`'s
target scene, never fire `model-loaded` and are untouched by this risk
regardless of nesting — it only applies to `gltf-model`-based buttons.) If
you combine the two, keep `ar-button`'s own `near`/`far` in sync with
whatever `proximity-fade` range governs the same object's visibility, or
disable the button (`enabled: false`) by whatever other signal you're using
to drive the fade.

### Interaction with [Image Tracking](IMAGE-TRACKING-FEATURE-GUIDE.md)

No interaction found. `proximity-fade`/`-dither` only patches materials
reached via a bubbled `model-loaded` event from a `gltf-model` descendant;
that feature's `xrextras-play-video` content is a plane with a video
texture material, not a `gltf-model`, so it never triggers `model-loaded`
and is never touched by this feature regardless of scene nesting.

### Interaction with LOD + Billboard's dithered fade

Same category of risk as the `proximity-cutout` one above (see
`LOD-BILLBOARD-FEATURE-GUIDE.md`): an
`lod-object`'s `data-lod-dither` part also patches `material.onBeforeCompile`
+ `customProgramCacheKey`. Nest `proximity-fade`/`-dither` and a dithered
LOD part around the exact same `gltf-model` and only one of the two
effects renders — neither composes with the other, whichever attaches last
wins. Full mental model in
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.4](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#44-onbeforecompile--program-caching).

### General constraints

- **No document-level listeners, no singleton/manager entity.** Unlike the
  sound feature, there's nothing here that needs exactly-one-per-module or
  that could double-fire across co-mounted modules — every instance is
  fully self-contained. The only shared-across-modules concern is the
  material-mutation risk above, which is about shared *material* state, not
  shared *component* state.
- **Camera-agnostic.** Reads `sceneEl.camera` only; never sets anything on
  `<a-camera>`, so it's unaffected by `CAMERA_PROPS_FORBIDDEN` and by
  whatever any module's own `manifest.camera` settings are.
- **Negative or otherwise unusual distances aren't rejected**, just not
  meaningful — real-world camera distance is never negative, so a ramp whose
  resolved far/near anchors are both negative will simply clamp to `0`
  (transparent) for any real distance. Not a crash, just not useful.
