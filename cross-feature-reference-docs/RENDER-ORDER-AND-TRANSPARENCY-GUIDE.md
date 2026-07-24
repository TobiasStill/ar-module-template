# Render order & transparency guide

A cross-feature reference for how three.js actually resolves overlapping
transparent surfaces, and where the sharp edges are when combining
[Render Order](../guides/RENDER-ORDER-FEATURE-GUIDE.md),
[Mesh Render Order](../guides/MESH-RENDER-ORDER-FEATURE-GUIDE.md),
[LOD + Billboard](../guides/LOD-BILLBOARD-FEATURE-GUIDE.md),
[Material Properties](../guides/MATERIAL-PROPERTIES-FEATURE-GUIDE.md),
[Dither Material](../guides/DITHER-MATERIAL-FEATURE-GUIDE.md),
or any other feature that patches materials (`proximity-fade`,
`proximity-cutout`) in the same scene. Adapted and generalized from an
internal engineering doc written on `Gyumin_production` (source branch:
`Gyumin_module`) — the original was written for one specific "concert
lightstick field" project; this version keeps the technical content and
drops everything specific to that project's assets/naming.

This isn't a feature guide on its own — it exists because several of the
sharp edges below aren't obvious from reading any single component in
isolation, and more than one feature on this branch touches materials or
render order. Read it once if you're combining any of the features listed
above with each other or with anything else that mutates `renderOrder` or
`material.onBeforeCompile`.

## 1. The mental model: two render lists, not one

three.js (like most real-time renderers) does **not** render objects in
arbitrary or purely distance-sorted order. Every frame it builds two
separate lists:

1. **Opaque list** — every mesh whose material has `transparent = false`.
   Rendered **first**, sorted front-to-back (a performance optimization —
   nearer objects can early-out pixels behind them via the depth test).
2. **Transparent list** — every mesh whose material has `transparent = true`.
   Rendered **second**, always, no matter what. Sorted by `renderOrder`
   first, then by camera distance back-to-front (so blending composites
   correctly — what's behind needs to already be drawn before you blend
   over it).

Two things follow that matter a lot when combining features:

- **The opaque/transparent split is a hard, unconditional ordering.** No
  `render-order` value can make a transparent object draw before *any*
  opaque object, or vice versa. This is stronger than anything
  `render-order` or `lod-manager`'s banding (§3) can do.
- **`renderOrder` only sorts within one of those two lists**, and it sorts
  whole *objects* (mesh nodes), not individual triangles. It cannot resolve
  two overlapping faces of the *same* mesh, or a mesh whose front and back
  faces both draw in one pass (§4.2).

### Depth buffer basics

Every drawn pixel writes a *depth* value if `material.depthWrite = true`
(the default for opaque materials). Later draws test their own depth
against what's already there (`depthTest`, default on) and only draw where
they pass. `depthWrite: false` (the glTF default for genuinely
`alphaMode: BLEND` materials) means a transparent surface never occludes
anything drawn after it via the depth buffer — draw order (`renderOrder`)
is the *only* thing keeping it composited correctly.

## 2. How `render-order` + `lod-object`/`lod-manager` compose

Within one [`lod-object`](../guides/LOD-BILLBOARD-FEATURE-GUIDE.md) group, each
`.lod-mesh`/`.lod-billboard` child's [`render-order`](../guides/RENDER-ORDER-FEATURE-GUIDE.md)
attribute gives it a small integer. `lod-object` normalizes these to a
local 0-based range (`_lodRenderOrder - minOrder`). That's only correct
*within* one group, though — if every LOD instance in a scene reused small
numbers like 0–4, instances would interleave with each other's transparent
parts (instance A's glow part could draw after instance B's translucent
shell purely because 0 < 1, regardless of which instance is actually
closer to the camera).

`lod-manager.updateRenderOrder()` fixes this every frame: it ranks every
registered `lod-object` by camera distance (farthest first) and gives each
one an exclusive **band** —
`renderOrder = RENDER_ORDER_BASE + rank * band + localOrder` — wide enough
(`band = widest single-instance span + 1`) that no two instances' bands can
overlap. The *relative* order authored via `render-order` is preserved
inside each instance, while whole instances still sort correctly
back-to-front between each other. This is recomputed every frame (not
once) because camera distance changes continuously — cheap, one sort plus
one loop over mesh nodes.

`RENDER_ORDER_BASE` (100000 in `lod-manager.ts`) exists specifically so
these dynamically-computed bands can never numerically collide with a
**standalone** `render-order` value set on some unrelated transparent
object elsewhere in the scene (which would realistically stay small —
single or low-double-digit). Without that base, a standalone object with,
say, `render-order="3"` could end up sorting inconsistently against nearby
LOD instances as the camera moves and their bands shift — sometimes
correctly, sometimes not, depending on exactly where the bands happened to
land that frame. With the base, a manually-tagged non-LOD object never
needs to be coordinated against LOD's own numbers at all.

**Practical takeaway:** `render-order` means something different depending
on where you use it. Outside any `lod-object` group, it's the real,
permanent runtime value. Inside one, it's a *local* order among that one
group's own children — the real runtime value is always `lod-manager`'s to
decide, every frame.

### `mesh-render-order` does *not* compose the same way — real conflict, not just a nuance

[`mesh-render-order`](../guides/MESH-RENDER-ORDER-FEATURE-GUIDE.md) sets `renderOrder`
per **named sub-mesh** within one loaded model, a finer granularity than
`render-order`'s one-value-per-whole-model. Unlike `render-order` above,
this one does **not** survive being placed inside an `lod-object` group:
`lod-object.ts` records exactly one `localOrder` per `.lod-mesh` child and
`lod-manager.updateRenderOrder()` overwrites `node.renderOrder` uniformly
for *every* mesh node under that child, every frame. Any per-name
distinction `mesh-render-order` set is silently collapsed back to one
shared value on the very next tick. This is confirmed by tracing
`lod-manager`'s render-order assignment directly, not a "might" — don't put
`mesh-render-order` on a `.lod-mesh`/`.lod-billboard` child or anywhere
under an active `lod-object`. Full writeup in
[MESH-RENDER-ORDER-FEATURE-GUIDE.md §4](../guides/MESH-RENDER-ORDER-FEATURE-GUIDE.md#4-incompatibilities-risks--troubleshooting).

## 3. Real alpha blending vs. dithering: pick correctly

A part that's **opaque-authored** in its glTF (`alphaMode: OPAQUE`,
`depthWrite: true`) can still be forced translucent via `lod-object`'s
`data-opacity-override` (e.g. so something behind it shows through). That
combination — real alpha blending *and* `depthWrite: true` on the same
mesh — only reads correctly if:

- draw order guarantees whatever it should reveal drew **first**, and
- nothing else in that instance's own render-order band depends on the
  depth value this mesh just wrote.

That's a strictly weaker guarantee than "opaque objects always draw before
transparent ones" (§1) — it depends entirely on `render-order`/banding
being exactly right, every frame, for every instance. Easy to get right for
a single mesh pair, easy to silently break when a third part or a future
render-order change shifts the relative order.

**The fix, when you need a part to reliably show through a translucent
neighbour regardless of render-order:** `lod-object.ts`'s
`setupDitherMaterial()` (wired up via the `data-lod-dither` attribute — see
[LOD-BILLBOARD-FEATURE-GUIDE.md](../guides/LOD-BILLBOARD-FEATURE-GUIDE.md)) converts
that part's own near/far fade from real opacity into a **dithered
discard** (screen-door transparency: a per-pixel `discard` driven by an
interleaved-gradient-noise threshold). This lets the part stay
`transparent = false` / `depthWrite = true` — i.e. it goes in the
**opaque** list, unconditionally drawn (and depth-written) before *any*
transparent object, full stop. Every translucent mesh drawn afterwards then
depth-tests against its real geometry and reveals it through ordinary
blending, with zero dependency on render-order or banding. The trade-off:
the part's distance fade now reads as a stipple/dither density change
rather than a smooth opacity fade — a visual style choice, not a bug, and
not appropriate for every part (a soft radial glow, for instance, generally
reads better with a real blended edge than a hard dithered one).

## 4. Pitfalls

### 4.1 `renderOrder` cannot fix everything

Because sorting only happens *within* a render list, and only at the
object (not triangle) granularity:

- Two transparent meshes with the *same* `renderOrder` fall back to
  camera-distance sorting — usually fine, but can flicker/pop right at the
  crossover point if their bounding centres are nearly equidistant.
- A single mesh with both front- and back-facing translucent geometry (e.g.
  a hollow shell) can self-overlap incorrectly — `renderOrder` can't
  reorder its own triangles. Dithering (§3), or splitting into separate
  front/back-face materials, sidesteps this; real alpha blending on a
  concave translucent shape generally can't be made fully correct without
  one of those.

### 4.2 Materials must be cloned before mutating

Any component that mutates a loaded model's material (opacity,
`transparent`, `depthWrite`, tint, ...) must clone it first
(`material.clone()`). **Why it matters:** glTF assets loaded via
`gltf-model` share one underlying material object across every instance of
that asset — every clone of the same source entity (e.g. via
[`random-field`](../guides/RANDOM-FIELD-FEATURE-GUIDE.md)) reuses the same loaded
resource unless something clones it. Mutating in place would leak one
instance's fade/tint state onto every other copy. `lod-object.ts` already
does this correctly; if you write a new material-mutating component, follow
the same pattern.

### 4.3 `trueOpacity` vs. `.opacity`

`lod-manager.applyBlend()` never *sets* `opacity` to the raw blend value —
it multiplies by `m.userData.trueOpacity` (captured once, before any fade
ever touches it: the glTF-authored alpha, or a `data-opacity-override`
value if one was set). Without this, every mesh — including a genuinely
translucent one — would get forced fully opaque the moment its LOD group
reaches full detail (`blend = 1`), silently hiding anything meant to show
through it. If you add a new fade path anywhere, route it through
`trueOpacity` the same way, or a translucent part will stop looking
translucent at close range.

### 4.4 `onBeforeCompile` + program caching

`setupDitherMaterial()` sets `material.customProgramCacheKey` explicitly.
three.js's default program cache key is derived from ordinary material
properties and does **not** account for `onBeforeCompile` edits. Without a
custom key, a dithered material could silently share a compiled shader
program with — or have one shared onto it by — a materially different
`onBeforeCompile` callback that happens to produce the same default cache
key.

**This isn't just an LOD concern** — `proximity-fade`/`proximity-fade-dither`,
`proximity-cutout`, and [`dither-material`](../guides/DITHER-MATERIAL-FEATURE-GUIDE.md)
(see their own guides) all already use `onBeforeCompile` + a pinned
`customProgramCacheKey` for the same reason — four independent writers in
total, counting LOD's own `setupDitherMaterial()`. If a project combines
any two of these four on overlapping materials, follow the same rule those
guides already document for combining *with each other*: whichever one
patches a given material's `onBeforeCompile` **last wins** — they don't
compose, each just overwrites what was there. Don't nest an `lod-object`
dithered part, a `proximity-fade`/`proximity-cutout` wrapper, and/or a
`dither-material` entity around the exact same `gltf-model` unless you're
prepared for only one of the effects to actually render. Any future
`onBeforeCompile` use on this branch should follow the same pattern: pin a
distinguishing `customProgramCacheKey` if the injected GLSL differs from
the material's stock shader.

### 4.5 `unlit-material` *replaces* materials — a different risk than `onBeforeCompile` collisions

`unlit-material` doesn't patch a material in place — it builds a whole new
`MeshBasicMaterial` and assigns it to `node.material`, discarding whatever
was there. If it runs on the *same* element as `proximity-fade`/
`proximity-cutout` (both of which patch `onBeforeCompile` on whatever
material they find at their own `model-loaded` time — see §5.2), whichever
one's `model-loaded` listener fires first decides the outcome:

- `unlit-material` first, proximity feature second: the proximity feature
  ends up patching the *new* `MeshBasicMaterial`, not the original PBR one
  — its `onBeforeCompile` injection targets shader chunks
  (`#include <alphatest_fragment>` for `proximity-fade-dither`,
  `#include <dithering_fragment>` for `proximity-cutout`) that may not
  exist in `MeshBasicMaterial`'s simpler shader template, in which case the
  `.replace()` silently no-ops and that effect never actually shows.
- Proximity feature first, `unlit-material` second: `unlit-material`
  replaces the already-patched material outright — the proximity effect's
  patch is discarded along with the rest of the material, silently.

Either order loses one effect. This hasn't been checked against the exact
shader chunk list `MeshBasicMaterial` compiles at the three.js revision
this project pins — don't combine `unlit-material` with `proximity-fade`/
`proximity-cutout` on the same entity without testing directly.

The same replace-vs-tune conflict applies to
[`material-properties`](../guides/MATERIAL-PROPERTIES-FEATURE-GUIDE.md) and
[`dither-material`](../guides/DITHER-MATERIAL-FEATURE-GUIDE.md) — both clone and
*mutate* whatever material is already there rather than patching shader
code, so the mechanism differs slightly from the proximity features above,
but the outcome is the same: `MeshBasicMaterial` has no
`roughness`/`metalness`/`emissive` for `material-properties` to tune (a
silent no-op, guarded rather than a crash — see that component's own
`"roughness" in owned` checks), and whichever of `unlit-material`/
`dither-material` runs second either discards the other's clone or clones
a `MeshBasicMaterial` that has nothing worth dithering into visually.
Don't combine either with `unlit-material` on the same entity.

### 4.6 The billboard's `alphaTest`/`depthWrite` toggle is deliberately rare

`lod-manager.applyBlend()` only flips the billboard's `alphaTest` (0 ↔ 0.5)
and `depthWrite` on an actual settle/unsettle transition (`currentBlend`
crossing the 0.01 threshold), not every frame. `alphaTest` changes force a
shader recompile (`needsUpdate`); toggling it continuously would be both
expensive and would fight the smooth crossfade (a cutout discard mid-fade
looks like popping, not blending). This is why a settled billboard has no
visible depth-occlusion glitches against other billboards despite writing
depth once fully faded in — depth writing only turns on once it's already
fully opaque.

## 5. Execution order — where components can silently interfere

Most subtle bugs in this area come from **when** code runs relative to
other code, not what the code itself does.

### 5.1 A-Frame loads children before parents

`ANode.load()` waits for every child's `loaded` event before running the
parent's own component updates. This is why an `lod-object`'s required
`.lod-mesh-group`/`.lod-billboard` structure must be fully present in
markup *before* the entity carrying `lod-object` — `lod-object.init()`
does `querySelectorAll('.lod-mesh')` and needs every child already in the
DOM. In plain authored markup this is automatic; if you ever build this
structure programmatically (the way the source branch's field-population
component used to), the outer `lod-object` attribute must be set *last*,
after every child is appended, or the query returns an empty list.

### 5.2 Multiple components mutating `node.material` on the same element — order matters

If more than one component reacts to `model-loaded` on the same entity and
each mutates `node.material`, listeners fire in **registration order** —
whoever calls `addEventListener('model-loaded', ...)` first runs first, and
each subsequent one operates on whatever the previous one left behind, not
the original glTF-parsed material. This isn't about ancestor-vs-descendant
ordering (§5.1) — it's purely same-element registration order. If you add a
new material-mutating component to an entity that already has one (e.g.
combining `unlit-material` or a proximity-fade/cutout feature with
`lod-object`'s own per-`.lod-mesh` material clone), check which one's
`model-loaded` listener actually gets attached first, and make that
assumption explicit in a comment the way `lod-object.ts` already does.

### 5.3 Ancestor-component registration should gate on `initialized`, not presence

`lod-object.ts` walks up to the nearest `[lod-manager]` ancestor and checks
`managerComp.initialized` before calling `register()`. A component
instance can exist in `el.components` before its own `init()` has run
(which is what actually creates the manager's internal registry) —
registering too early would push onto `undefined` and crash node loading.
If `lod-manager` isn't ready yet, `lod-object` waits for its
`componentinitialized` event instead. Any new code that needs to talk to an
ancestor component during its own `init()` should use the same
`initialized`-check-plus-event-wait pattern rather than assuming presence
in `el.components` means "ready."

## 6. Quick interference checklist

| If you touch… | Watch out for… |
|---|---|
| A standalone [`render-order`](../guides/RENDER-ORDER-FEATURE-GUIDE.md) value | Nothing, as long as it's outside any `lod-object` group — `RENDER_ORDER_BASE` guarantees LOD's own dynamic bands can't collide with it (§2). |
| `render-order` inside an `lod-object` group | Only affects ordering *within* that one instance's own transparent-list members (§2) — not a substitute for `data-lod-dither` (§3) when something MUST reliably show through a translucent neighbour. |
| [`mesh-render-order`](../guides/MESH-RENDER-ORDER-FEATURE-GUIDE.md) alongside LOD + Billboard | Real conflict, not just a nuance — never place on a `.lod-mesh`/`.lod-billboard` child or anywhere under an active `lod-object` (§2). `lod-manager` overwrites every mesh in that child with one shared `renderOrder` value every frame. |
| `lod-object.ts`'s material clone/mutate block | Registration order relative to any other material-mutating component on the same element (§5.2). Also: a new override flag (like `dither`) needs a matching branch in `lod-manager.ts`'s `applyBlend()`, or the fade will silently do nothing. |
| `lod-manager.ts`'s `applyBlend`/`updateRenderOrder` | Runs for *every* registered instance every frame — a per-object branch here is a per-frame cost multiplied by field size; keep new logic cheap. |
| `proximity-fade`/`proximity-fade-dither`/`proximity-cutout` alongside LOD | Don't target the exact same material with both an LOD dithered part and a proximity effect (§4.4) — last `onBeforeCompile` patch wins, the other goes silently inert. |
| `unlit-material` alongside `proximity-fade`/`proximity-cutout` | Don't put both on the same entity (§4.5) — `unlit-material` replaces the material object outright, not just patches it, so whichever runs first silently discards the other's effect. Not fully verified against this project's pinned three.js shader chunks; test directly if combined. |
| [`dither-material`](../guides/DITHER-MATERIAL-FEATURE-GUIDE.md) alongside LOD, `proximity-fade-dither`, or `proximity-cutout` | A fourth `onBeforeCompile` writer (§4.4) — don't target the same material with two of these four at once, last patch wins. |
| [`material-properties`](../guides/MATERIAL-PROPERTIES-FEATURE-GUIDE.md) or `dither-material` alongside `unlit-material` | Don't put either on the same entity as `unlit-material` (§4.5) — same replace-vs-tune conflict as the proximity features above. |
| `material-properties` alongside `dither-material` | Both clone-then-mutate (not replace), so combining is supported — but same-element registration order decides who tunes whose output (§5.2). Author `material-properties` first if you want its values to be what gets dithered. |
| Adding any new material-mutating component | Ask: does it run on the same element as another material-mutating component? If yes, registration order decides who sees whose output (§5.2) — make that explicit in a comment. |
