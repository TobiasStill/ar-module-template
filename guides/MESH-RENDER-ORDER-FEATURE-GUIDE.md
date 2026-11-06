# Mesh render order feature guide

<!-- overview -->
## Overview

Decides which parts of one model are drawn first when they overlap. Many
models consist of see-through layers — flames in front of a figure, a
glass shell around a core, several veils on top of each other. Without
help, the phone sometimes draws them in the wrong order, and parts flicker
or seem to vanish behind each other. This feature lets you put the named
parts of a model into a fixed sequence, like stacking transparent sheets
in a chosen order, so the layering always looks right.

<!-- /overview -->

## Technical summary

Sets three.js `renderOrder` on individual **named** meshes inside a single
loaded model, so one asset's own overlapping/layered internal parts draw in
a controlled order relative to *each other* — a finer granularity than
[Render Order](RENDER-ORDER-FEATURE-GUIDE.md), which sets one uniform value
across a *whole* model for ordering it relative to *other* objects. The
name→order mapping is a runtime attribute, so it works on any glTF whose
named sub-meshes need relative ordering, without editing source code per
project. See [3. Under the hood](#3-under-the-hood) for why this is its own
feature rather than an option on `render-order`, and
[4. Incompatibilities](#4-incompatibilities-risks--troubleshooting) for a
real conflict with [LOD + Billboard](LOD-BILLBOARD-FEATURE-GUIDE.md).

<!-- project-specific -->
### Project context: origin

Ported from `Rosa_module`, where it was hardcoded to one specific asset's
mesh names (`Mesh_1`..`Mesh_8`); the port turned the mapping into the
attribute (details in §3). The example model is generated, not taken from
that project.

<!-- /project-specific -->

Files:

```
src/a-frame-components/mesh-render-order.ts
examples/mesh-render-order-usage.html   # scene wiring + full attribute reference
examples/mesh-render-order-unlit-material-scene.html # combined
                                    # with unlit-material
```

**Assets:** [`mesh-render-order-demo.glb`](../examples/assets/mesh-render-order-demo.glb) —
five overlapping see-through panels with named meshes (`veil_back`,
`veil_middle`, `veil_front`, `halo`, `core`), used only by the combined
example above. Copy it into `src/assets/` to try that; it isn't required to use
this component on your own assets.

**Read [RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md)
before using this on anything transparent** — same underlying render-queue
mental model as [Render Order](RENDER-ORDER-FEATURE-GUIDE.md) applies here
too, just at named-submesh granularity instead of whole-model granularity.

## 1. Step-by-step: adding this to a new project

1. **Copy the file** — `mesh-render-order.ts` — into your project's own
   `src/a-frame-components/`. No path changes, no data files.

2. **Nothing to register** — every component file in
   `src/a-frame-components/` is registered automatically under its file
   name as soon as the scene uses it (README, "The manifest"); unused ones
   aren't even bundled. Only a component registered under a different name,
   or one whose name is built at runtime, needs a manual entry in
   `src/manifest.ts`.

3. **Find your mesh names** — open the glTF in a viewer/inspector (or your
   DCC tool's outliner) and note the exact mesh names as authored. These
   must match `node.name` after `GLTFLoader` parses the file — see
   [3](#3-under-the-hood) for a caveat about asset-compression tools
   stripping names.

4. **Wire it into the scene** — see
   [2. Entities & attributes](#2-entities--attributes) or copy directly
   from `examples/mesh-render-order-usage.html`.

5. **Build and test** — `npm run build`, then `npm run dev`. Like
   `render-order`, this is a visual effect only — you need overlapping
   transparent sub-meshes in view to see it doing anything.

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `mesh-render-order` | string | `""` | Semicolon-separated `MeshName: number` pairs, e.g. `mesh-render-order="Flame_A: 1; Flame_B: 2; Body: 3"`. Every named mesh found inside the loaded model gets `node.renderOrder` set to its listed value; unlisted meshes are left untouched. A-Frame's schema system doesn't support fully dynamic keys, so this is one string attribute parsed by hand, not a multi-property object schema like most other components here. |

```html
<a-entity gltf-model="#Character" mesh-render-order="veil_back: 1; veil_middle: 2; core: 3"></a-entity>
```

A malformed entry (missing colon, non-numeric value) is skipped with a
console warning rather than discarding the whole mapping — one typo won't
blank out every other entry.

Nothing to call — it applies automatically once the mesh loads, and again
any time the `mesh-render-order` attribute itself changes at runtime (e.g.
`el.setAttribute('mesh-render-order', '...')`).

## 3. Under the hood

Listens for `object3dset` (filtered to `detail.type === "mesh"`) — A-Frame's
generic "a mesh object3D was just set" event — plus an immediate check in
case the mesh is already present. Once the mesh exists, traverses its
object3D graph and, for every mesh node whose `name` is a key in the parsed
mapping, sets `node.renderOrder` to the matching value. Also re-applies on
`update()` (skipping the initial call, which `init()` already handles), so
changing the attribute string after the model has loaded takes effect
immediately without needing a reload.

### Why this couldn't just be an option on `render-order`

`render-order` ([its own guide](RENDER-ORDER-FEATURE-GUIDE.md)) sets *one*
number on *every* mesh in a loaded model — the right tool when a whole
object needs ordering relative to *other* objects in the scene. This
feature instead needs *several* numbers, one per named sub-mesh, for
ordering a *single* asset's own parts relative to each other. Those are
different shapes of data (one number vs. a name→number map) driving
different intents (inter-object vs. intra-object ordering) — cramming both
into one component's schema would make the common case (`render-order="2"`)
harder to read for no real benefit, and the two are safe to use
*together* on different entities (an object using `mesh-render-order`
internally can still carry a plain `render-order` on an ancestor, or vice
versa on a sibling) — see [4](#4-incompatibilities-risks--troubleshooting)
for the one case where combining them on the *same* entity's meshes causes
a real conflict.

### Mesh names must really be in the file

The component matches `node.name` exactly, so verify your own glTF's actual
node names first (open it in a viewer, or log `mesh.name` for each
traversed node during development) rather than assuming a name scheme.
Compression tools such as `gltfpack` can strip or relocate mesh names (see
[ASSET-COMPRESSION-GUIDE.md](../cross-feature-reference-docs/ASSET-COMPRESSION-GUIDE.md)) —
compress from an original and check that the names survive.
Three.js' `GLTFLoader` also changes names while loading: a space becomes an
underscore, so a mesh called `left wing` in your 3D tool is `left_wing` here.
`examples/mesh-render-order-unlit-material-scene.html` demonstrates this
component against a real asset's names, working end-to-end.

<!-- project-specific -->
#### Project context: `Rosa_module` / `Rosa`

##### What changed from the source

The source (`Rosa_module`) hardcoded both the mesh names and their order
directly in TypeScript:

```ts
const RENDER_ORDER: Record<string, number> = {
  Mesh_1: 1, Mesh_2: 2, /* ...through Mesh_8 */
};
```

— meaning every new project wanting this behavior on a *different* asset
would need to hand-edit the component's source rather than just author an
attribute. The port replaced the hardcoded map with the `mesh-render-order`
string attribute, parsed the same way the rest of this project's
multi-value attributes are (e.g. compare to how `random-field` or
`proximity-wave`'s schemas are authored) — semicolon-separated `key: value`
pairs, parsed once in `init()`/`update()` rather than on every apply.

**Verified, not assumed, against two versions of the source asset:** both
`Rosa_module`'s copy and the plain `Rosa` branch's own copy of this
character model were inspected directly (their embedded glTF JSON extracted
from the binary container) rather than trusting the hardcoded names at face
value.

- `Rosa_module`'s copy (152 KB, almost certainly run through a compressor
  like `gltfpack`) has every mesh-bearing node's `name` stripped entirely.
- The plain `Rosa` branch's own copy (435 KB, uncompressed)
  still has its original names: `"orange flame"`, `"violet flame"`,
  `"green flame"`, `"lime flame"`, `"person squat"`, `"person stand"`,
  `"person nails"` — seven meshes, not eight.

Neither version has any node named `"Mesh_1"` through `"Mesh_8"`. Since
even the never-recompressed original doesn't have those names, the source's
hardcoded `RENDER_ORDER` map was very plausibly never valid against this
asset at any point in its life — a leftover from an even earlier draft of
the model, not something a later compression step broke. This is a
pre-existing data/source-code mismatch on the original branch, not a bug in
either the source or the ported component — but it means whoever adopts
this on a *new* asset should verify their own glTF's actual node names
first rather than assuming a name scheme. The template doesn't ship that
model: it is the student's work, so the combined example uses a generated one.

<!-- /project-specific -->

## 4. Incompatibilities, risks & troubleshooting

### Portal overwrites renderOrder in its subtree

[`portal`](PORTAL-FEATURE-GUIDE.md) sets `renderOrder` on every mesh inside
its `contents`, `walls`, `portalWall` and `door` (hiders 1, contents 2) and
re-applies it whenever a mesh appears below it. Values set by this
component inside a portal are overwritten — use it outside portals only
(found while adding Portal).

### Can't fix everything — see the cross-feature guide

Same render-queue fundamentals as `render-order`: only sorts within the
opaque or transparent render queue (never across them), sorts whole mesh
nodes not individual triangles, and falls back to camera-distance sorting
for two nodes with equal values. See
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.1](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#41-renderorder-cannot-fix-everything).

### Real conflict with LOD + Billboard — checked, and it does conflict

Unlike plain `render-order` (which composes cleanly with
[`lod-object`](LOD-BILLBOARD-FEATURE-GUIDE.md) — see that component's own
guide §3), **`mesh-render-order` genuinely conflicts** with `lod-object`
when placed on the same `.lod-mesh` child, or on any entity whose mesh
`lod-manager` also drives:

- `lod-object.ts` records exactly *one* `localOrder` value per `.lod-mesh`
  DOM child element (read from that child's own `render-order` attribute),
  and pushes `{ node, localOrder }` for **every** mesh node found while
  traversing that one child — all sharing that single value.
- `lod-manager.updateRenderOrder()` runs every frame and unconditionally
  overwrites `node.renderOrder = base + localOrder` for every recorded
  node, where `base` is the instance's camera-distance-ranked band offset.

Any per-named-mesh distinction `mesh-render-order` set inside that child's
loaded model is a plain, uniform `node.renderOrder` write — `lod-manager`
has no awareness of it and will silently stomp it every single frame the
instance is active, collapsing every named sub-mesh back to one shared
value. This is a real, confirmed conflict (not a "not tested yet" caveat
like [§4.5 below](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#45-unlit-material-replaces-materials--a-different-risk-than-onbeforecompile-collisions)),
found by tracing exactly how `lod-manager` assigns render order rather than
assumed.

**Don't put `mesh-render-order` on a `.lod-mesh`/`.lod-billboard` child, or
on any entity nested under an active `lod-object`.** If an asset needs both
internal named-submesh ordering *and* LOD/billboard crossfading, apply
`mesh-render-order` to a version of the asset used *outside* any
`lod-object` group, or accept that the LOD system's own per-instance
banding is the only ordering that survives while that instance is under
LOD management.

### No interaction found with any other feature on this branch

Doesn't touch `document` listeners, shared/global state, or camera — only
ever writes `renderOrder` on named mesh nodes inside its own entity's
loaded model. Free to combine with `random-field`, `proximity-wave`,
`follow-node`, `wander-in-band`, `ar-button`/`sound-button`,
`mirror-shard`/`liquid-texture`, and a standalone (non-LOD)
`render-order`/`unlit-material` with no interaction at all.
