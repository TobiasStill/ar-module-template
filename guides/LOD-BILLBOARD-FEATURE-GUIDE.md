# LOD + Billboard feature guide

<!-- overview -->
## Overview

Saves the phone's strength in scenes with many objects. Up close, a visitor
sees the full, detailed 3D model; as they walk away, it softly blends into
a flat picture of itself that always turns to face them — like a cardboard
cut-out at the back of a theatre stage. From a distance nobody can tell the
difference, but the phone only has to draw a single flat image instead of
a complex model. Walk back, and the detailed version fades in again.
Individual parts, such as a glow, can be set to appear only when the
visitor comes really close.

<!-- /overview -->

## Technical summary

Cross-fades a detailed 3D model into a flat, always-camera-facing billboard
image as the camera moves away, and back again as it approaches — a classic
level-of-detail technique for AR/VR scenes with many similar objects, where
rendering full detail on everything far from the viewer would be wasteful.
Applicable to any object — a `gltf-model` or a plain A-Frame primitive —
optionally split into multiple parts. The components read a
`.lod-mesh`/`.lod-mesh-group`/`.lod-billboard` structure you author in
markup — no naming convention or asset-specific logic involved — see
[3. Under the hood](#3-under-the-hood).

<!-- project-specific -->
### Project context: origin

Ported from `Gyumin_module`. The structure the components read was already
generic there; what changed is *how* that structure gets built, plus a
real primitive-support gap the port found and fixed (see §3).

<!-- /project-specific -->

Files:

```
src/a-frame-components/
  lod-object.ts       # one per LOD instance
  lod-manager.ts       # one per module, drives every lod-object
  billboard.ts          # spins an entity to face the camera
  unlit-material.ts      # flat/shadeless material technique, typically for the billboard
examples/lod-billboard-usage.html   # required structure + full attribute reference
examples/random-field-lod-billboard-proximity-wave-scene.html # combined with
                                    # Random Field and Proximity Wave
```

No assets. **Read [RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md)
before combining this with anything else that touches materials or render
order** — it covers real edge cases (opaque vs. transparent render queues,
dithering vs. real alpha blending, material-cloning, `onBeforeCompile`
caching) this guide only summarizes.

## 1. Step-by-step: adding this to a new project

1. **Copy the files** — `lod-object.ts`, `lod-manager.ts`, `billboard.ts`,
   `unlit-material.ts` — into your project's own `src/a-frame-components/`.
   No path changes, no data files.

2. **Copy `render-order.ts` too**, if you don't already have it (see
   `RENDER-ORDER-FEATURE-GUIDE.md`) — you'll want it to control draw order
   among a multi-part detail group's own children.

3. **Nothing to register** — every component file in
   `src/a-frame-components/` is registered automatically under its file
   name as soon as the scene uses it (README, "The manifest"); unused ones
   aren't even bundled. Only a component registered under a different name,
   or one whose name is built at runtime, needs a manual entry in
   `src/manifest.ts`.

4. **Prepare your assets**, per [2](#2-entities--attributes)'s "required
   structure" — a detailed model (one or more parts) *and* a separate flat
   billboard glb (typically a plane + a baked texture image, exported from
   whatever 3D tool made the detailed model). The billboard is not a live
   render of the detail parts; it's a separate, cheap stand-in asset you
   author once.

5. **Assemble the structure in your scene** — see
   [2](#2-entities--attributes) or copy directly from
   `examples/lod-billboard-usage.html`. Exactly one `lod-manager` for the
   whole module (on an ancestor of everything, e.g. the module root); one
   `lod-object` per instance you want cross-fading.

6. **Build and test** — `npm run build`, then `npm run dev:ar` on a phone —
   the crossfade is inherently about real-world walking distance, so a
   VR/desktop preview (WASD movement) is the fastest way to see it, but
   test on-device before shipping.

## 2. Entities & attributes

### Required structure

`lod-object` finds its parts by **CSS class**, not by any naming
convention on your assets — assemble exactly this shape under the entity
that carries `lod-object`:

```html
<a-entity lod-object="nearDistance: 15; farDistance: 25">
  <a-entity class="lod-mesh-group">
    <a-entity class="lod-mesh" gltf-model="#PartA" render-order="1"></a-entity>
    <a-entity class="lod-mesh" gltf-model="#PartB" render-order="2"></a-entity>
    <!-- as many .lod-mesh children as your detailed model needs -->
  </a-entity>
  <a-entity class="lod-billboard" gltf-model="#MyPropBillboard" render-order="3" billboard unlit-material></a-entity>
</a-entity>
```

- `gltf-model` is one option for a `.lod-mesh`/`.lod-billboard` child, not a
  requirement — a plain A-Frame primitive (`a-box`, `a-plane`, `a-sphere`,
  ...) works identically; see
  `examples/random-field-lod-billboard-proximity-wave-scene.html` for a
  fully primitive-based worked example (no `.glb` assets needed at all).
- `.lod-mesh-group` wraps the full-detail representation — one or more
  `.lod-mesh` children.
- `.lod-billboard` is the separate billboard glb, typically also carrying
  `billboard` (face the camera) and `unlit-material` (flat, shadeless look
  — a baked billboard texture usually shouldn't be re-lit by scene
  lighting).
- `render-order` on each child controls draw order *within this one
  instance only* — see `RENDER-ORDER-FEATURE-GUIDE.md`.
- Build this structure in markup exactly as shown (children before the
  parent's own `lod-object` attribute takes effect) — A-Frame loads
  children before parents, so plain authored markup already gets this
  right automatically; see
  [RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §5.1](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#51-a-frame-loads-children-before-parents)
  if you ever build it with a script instead.

### `lod-manager` (once per module)

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `chunksPerCycle` | number | `6` | Each tick, only this fraction of registered `lod-object`s is recomputed (round-robin) — spreads the cost across frames instead of paying for every instance every frame. |

### `lod-object` (once per instance)

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `nearDistance` | number | `15` | Metres. ≤ this ⇒ the `.lod-mesh-group` is fully shown, billboard fully hidden. |
| `farDistance` | number | `25` | Metres. ≥ this ⇒ the reverse. Between the two, both cross-fade smoothly. |
| `fadeSpeed` | number | `3` | How quickly the crossfade catches up to its target as distance changes. |

Per-`.lod-mesh` child data attributes (all optional, authored directly on
that child, not on the `lod-object` entity):

| Attribute | Meaning |
|---|---|
| `data-lod-near` / `data-lod-far` | A tighter fade band for just this one part, layered on top of (multiplied with) the group fade above — e.g. a glow part that should only appear once the camera is genuinely close, even though the rest of the object is already "detailed" from farther out. Both must be set together. |
| `data-opacity-override` | Replaces this part's own glTF-authored alpha outright (not a further dim) — for a part that's technically `alphaMode: BLEND` but barely translucent as modelled. |
| `data-lod-dither` | Presence-only flag. Fades this part via a dithered discard instead of real alpha blending — use on a part that must reliably show through a translucent neighbour regardless of render-order. See [RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §3](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#3-real-alpha-blending-vs-dithering-pick-correctly). |

### `billboard` — no attributes, always spins to face the camera.

### `unlit-material`

Not owned by this feature — a generic shared building block (see
`FEATURE-CATALOG.md`'s "Shared building blocks" table) that also has a
genuinely standalone, non-LOD use case: flattening a full model's own
materials to always-lit/toon-style shading regardless of scene lighting.
See `examples/unlit-material-usage.html` for that standalone case.

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `keepEmissive` | boolean | `true` | Fold any emissive glow into the flat colour so it survives flattening. |
| `brightness` | number | `1` | Uniform dim on the flat colour (the only way to dim an unlit material) — `0.5` = half, `0` = black. |
| `tint` | color | `""` (none) | Multiplied into the flat colour. |
| `alphaTest` | number | `-1` (don't override) | Forces a specific alphaTest cutout on the converted material, instead of preserving whatever alphaTest the original material had. Added while verifying this component against a standalone, non-LOD use case: a full unlit-shaded model with `alphaMode: BLEND` materials that still wanted a hard cutout once converted (e.g. to discard very-transparent fringes on flame/foliage-style parts). Not typically needed for the billboard use case above. |
| `keepShadowBehavior` | boolean | `false` | If `true`, leaves this mesh's `castShadow`/`receiveShadow` exactly as already set (e.g. by an A-Frame `shadow` component on the same entity) instead of forcing both off. `false` (default) matches the original billboard behaviour here — correct for a flat glow-style surface, which shouldn't cast or receive shadows — but a full unlit-shaded character model generally wants `true`, so it can still ground itself with a cast shadow. |

See `examples/lod-billboard-usage.html` for three worked examples (single
part, multi-part with fade overrides and dithering, and combined with
`random-field`), and `examples/unlit-material-usage.html` for the
standalone (non-LOD) `alphaTest`/`keepShadowBehavior` case.

## 3. Under the hood

### Structure authored in markup, primitives supported

You author the `.lod-mesh-group`/`.lod-mesh`/`.lod-billboard` structure
directly in markup (per [2](#2-entities--attributes)); nothing assembles it
programmatically or discovers parts by asset names.
[`random-field`](RANDOM-FIELD-FEATURE-GUIDE.md) (if you use it) just clones
whatever structure you've already built, LOD included, since it's plain DOM.

`lod-object.ts` (like `unlit-material.ts` and `render-order.ts`) listens for
`object3dset` (A-Frame's generic "a mesh object3D was just set" event) plus
an immediate check for an already-present mesh, rather than only
`gltf-model`'s own `model-loaded` — which never fires for a primitive
(`a-box`, `a-plane`, ...). So parts can be glTF models or primitives.

<!-- project-specific -->
#### Project context: `Gyumin_module`

##### What changed from the source

The source branch's field-population component (see
`RANDOM-FIELD-FEATURE-GUIDE.md`) used to *build* this whole structure
programmatically via `document.createElement`, discovering which assets
belonged together by a `PREFIX_01`/`PREFIX_LICHT`/`PREFIX_PNG` naming
convention. The port removed the programmatic assembly entirely. Comments
referencing the source project's specific glow-part naming were
generalized; nothing about their meaning changed.

The primitive gap was found while testing against plain A-Frame
primitives: `lod-object.ts`, `unlit-material.ts` and `render-order.ts`
originally only listened for `model-loaded`. No behavior change for
existing glTF-based usage; the fix only added the missing primitive
support.

<!-- /project-specific -->

### The two independent fades

`lod-object` drives two fades against camera distance, multiplied
together:

- **Group fade** (`nearDistance`/`farDistance`) — the whole detailed mesh
  group ↔ billboard crossfade.
- **Per-part override fade** (`data-lod-near`/`data-lod-far`) — a *tighter*,
  closer-in fade layered on top, for one specific part (e.g. a glow effect
  that should only activate once genuinely close, even after the rest of
  the object is already "detailed").

### `lod-manager` is the single tick driver

Every registered `lod-object` resolves its nearest `[lod-manager]`
ancestor and registers with it (gated on the manager's own `initialized`
flag — see
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §5.3](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#53-ancestor-component-registration-should-gate-on-initialized-not-presence)
for why presence alone isn't enough to check). `lod-manager` processes a
rotating fraction of the registered set each frame (`chunksPerCycle`),
computes each one's camera distance, and calls back into the blend math —
plus re-ranks every instance by distance each frame to keep render-order
bands correct (see [RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §2](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#2-how-render-order--lod-objectlod-manager-compose)).

### `trueOpacity`, material cloning, dithering

All covered in depth in
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §3–4](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#3-real-alpha-blending-vs-dithering-pick-correctly) —
not duplicated here.

## 4. Incompatibilities, risks & troubleshooting

### Portal overwrites renderOrder in its subtree

[`portal`](PORTAL-FEATURE-GUIDE.md) sets `renderOrder` on every mesh inside
its `contents`, `walls`, `portalWall` and `door` (hiders 1, contents 2) and
re-applies it whenever a mesh appears below it. Values set by this
component inside a portal are overwritten — use it outside portals only
(found while adding Portal).

### Env maps from Light & Reflections

[`cubemap-static`/`cubemap-realtime`](LIGHT-REFLECTIONS-FEATURE-GUIDE.md) write
`envMap` onto (cloned) materials. `unlit-material` swaps in new MeshBasicMaterials (an env map then shows
unlit): an env map applied *before* is carried along by `clone()`, one
applied after works on the new materials. Re-set the cubemap attribute
after a swap if the reflection disappears (found while adding Light &
Reflections).

### Does not interfere with manually-set `render-order` — verified, see the cross-feature guide

A natural concern: does tagging an entity with `render-order` conflict with LOD's own render-order
management? Checked directly — no. Full explanation in
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §2](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#2-how-render-order--lod-objectlod-manager-compose).
Short version: inside an `lod-object` group, `render-order`'s value is read
as *local* order and the real runtime value is always `lod-manager`'s to
compute; outside one, it's untouched by LOD at all, and `lod-manager`
reserves a numeric range (`RENDER_ORDER_BASE`) its own dynamic bands never
enter, so a standalone value can never collide with them either.

### Real conflict with `mesh-render-order` — do not combine on the same child

[`mesh-render-order`](MESH-RENDER-ORDER-FEATURE-GUIDE.md) (per-named-submesh
draw order within one asset) does not survive being placed on a
`.lod-mesh`/`.lod-billboard` child, or anywhere under an active
`lod-object` — `lod-manager` assigns exactly one `renderOrder` per
`.lod-mesh` child and overwrites it uniformly across every mesh node in
that child every frame, silently erasing any per-name distinction. Unlike
the `render-order` case above, this is a confirmed conflict, not a checked
non-issue — see
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#mesh-render-order-does-not-compose-the-same-way--real-conflict-not-just-a-nuance)
and [MESH-RENDER-ORDER-FEATURE-GUIDE.md §4](MESH-RENDER-ORDER-FEATURE-GUIDE.md#4-incompatibilities-risks--troubleshooting).

### Interaction with `proximity-fade`/`proximity-cutout` — same-material patch collision

If a project nests an LOD instance's dithered part (`data-lod-dither`)
*and* a `proximity-fade`/`proximity-cutout` wrapper around the exact same
`gltf-model`, only one of the two effects actually renders — both patch
`material.onBeforeCompile` and neither composes with the other, whichever
attaches last wins. See
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.4](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#44-onbeforecompile--program-caching).
Not a new kind of risk — the same category of collision
already exists between `proximity-fade` and `proximity-cutout` themselves
(see their own guides) — just now with a third component that can also be
one side of it.

### `.lod-mesh-group`/`.lod-billboard` structure is required, not optional

If `lod-object` can't find a `.lod-mesh-group` child (or any `.lod-mesh`
children, or a `.lod-billboard`), its `init()` will throw trying to read
`.object3D` off `null` — this is a hard requirement, not a graceful
degradation, since the structure genuinely can't be inferred any other way.
Double-check the class names if an LOD entity doesn't render at all.

### No ancestor `lod-manager`

If `lod-object` can't find an ancestor `[lod-manager]`, it logs one console
warning (`[lod-object] no ancestor [lod-manager] found; LOD blending
disabled`) and simply never registers — the detailed mesh group stays as
whatever its initial `visible` state was (not a crash, but LOD won't
function). Make sure exactly one `lod-manager` wraps every `lod-object` you
add.

### No interaction found with `random-field`, `proximity-wave`, `follow-node`, `wander-in-band`, `ar-button`/`sound-button`, or `mirror-shard`/`liquid-texture`

None of those touch `renderOrder` or patch materials via `onBeforeCompile`,
so there's nothing for LOD to conflict with there. `random-field` in
particular composes cleanly by design — see
[RANDOM-FIELD-FEATURE-GUIDE.md](RANDOM-FIELD-FEATURE-GUIDE.md).
