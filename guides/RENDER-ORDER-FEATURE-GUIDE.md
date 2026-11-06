# Render order feature guide

<!-- overview -->
## Overview

Settles arguments between see-through objects. When a glass pane, a
coloured veil and a glowing shape overlap, the phone has to decide which
one to draw on top — and sometimes it gets it wrong, so things flicker or
seem to jump in front of each other as the visitor moves. With this
feature you give each object a number, and the objects are layered in that
order, like stacking coloured slides on a light table.

<!-- /overview -->

## Technical summary

Sets three.js `renderOrder` on every mesh of a loaded model, so overlapping
transparent surfaces draw in a controlled order. Applicable to any entity —
including a plain A-Frame primitive (`a-box`, `a-plane`, ...), not just a
`gltf-model` — see [3. Under the hood](#3-under-the-hood).

<!-- project-specific -->
### Project context: origin

Ported from `Gyumin_module`; schema and behavior are unchanged, but the
source only worked on `gltf-model` — primitive support was added during the
port (see §3).

<!-- /project-specific -->

Files:

```
src/a-frame-components/render-order.ts
examples/render-order-usage.html   # scene wiring + full attribute reference
examples/random-field-lod-billboard-proximity-wave-scene.html # combined with
                                    # Random Field, LOD + Billboard and
                                    # Proximity Wave
```

No assets. **Read [RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md)
before using this on anything transparent** — it's short, and covers real
edge cases (why render order alone can't fix everything, how this composes
with [LOD + Billboard](LOD-BILLBOARD-FEATURE-GUIDE.md), material-cloning
and `onBeforeCompile`-caching pitfalls shared with other features on this
branch) that this guide only summarizes.

## 1. Step-by-step: adding this to a new project

1. **Copy the file** — `render-order.ts` — into your project's own
   `src/a-frame-components/`. No path changes, no data files.

2. **Nothing to register** — every component file in
   `src/a-frame-components/` is registered automatically under its file
   name as soon as the scene uses it (README, "The manifest"); unused ones
   aren't even bundled. Only a component registered under a different name,
   or one whose name is built at runtime, needs a manual entry in
   `src/manifest.ts`.

3. **Wire it into the scene** — see
   [2. Entities & attributes](#2-entities--attributes) or copy directly
   from `examples/render-order-usage.html`.

4. **Build and test** — `npm run build`, then `npm run dev`. Draw-order
   issues are visual, not functional — you need two overlapping transparent
   objects in view to actually see this doing anything.

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `render-order` | number | `0` | The whole attribute value — not a named sub-property (`render-order="2"`, not `render-order="value: 2"`). Higher draws later (composites on top of lower values), but only relative to other objects in the *same* render queue — see [1](#1-step-by-step-adding-this-to-a-new-project). |

```html
<a-entity gltf-model="#GlassPane" material="transparent: true; opacity: 0.4" render-order="1"></a-entity>
<a-entity gltf-model="#InnerGlow" render-order="0"></a-entity>
```

Nothing to call — it applies once, on `model-loaded`, to every mesh inside
the loaded model.

**Inside an `lod-object` group** (see `LOD-BILLBOARD-FEATURE-GUIDE.md`),
this attribute means something narrower — see [3](#3-under-the-hood).

## 3. Under the hood

Listens for `object3dset` (filtered to `detail.type === "mesh"`) — A-Frame's
generic "a mesh object3D was just set on this entity" event — plus an
immediate check in case the mesh is already present by the time this
component's own `init()` runs. Once the mesh exists, traverses its object3D
graph and sets `node.renderOrder = data` on every mesh node found. That's
the entire component.

**Why `object3dset` and the immediate check.** gltf-model's own
`model-loaded` event never fires for a plain A-Frame primitive (`a-box`,
`a-plane`, `a-sphere`, ...). A primitive's mesh is typically already built
by the time this component initializes (A-Frame loads children before
parents and a primitive's geometry/material setup is synchronous), so the
immediate check covers it; a glTF fetch is still pending at that point, so
the listener path covers that case. `object3dset` fires for both, so one
mechanism covers both asset types.

<!-- project-specific -->
#### Project context: `Gyumin_module`

The source listened for `model-loaded` only. Since "applicable to any
entity" was the explicit requirement for this feature, that was a real gap
fixed during the port — the first time this gap was found; the same fix
was later applied to every other material-touching component.

<!-- /project-specific -->

The one piece of nuance is entirely about *composition* with other
features, not this component's own code:

- **Standalone** (not inside any `lod-object` group): this is the real,
  permanent runtime `renderOrder` value, full stop — nothing else in this
  template touches it afterward.
- **Inside an `lod-object` group**: `lod-object.ts` reads this attribute's
  value back off the DOM (not the live three.js value) at registration
  time, treats it as a *local* order among that one group's own children,
  and `lod-manager.ts` recomputes the actual runtime `renderOrder` every
  frame — offset by a large fixed base plus a camera-distance-ranked
  per-instance band, specifically so it can never numerically collide with
  a standalone value like the one this component sets directly. This
  component's own write still runs in that case, it's just immediately and
  harmlessly superseded the next time `lod-manager` ticks.

Full mental model (why any of this matters, opaque-vs-transparent render
queues, dithering vs. real alpha, material cloning) is in
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md) —
not duplicated here.

## 4. Incompatibilities, risks & troubleshooting

### Portal overwrites renderOrder in its subtree

[`portal`](PORTAL-FEATURE-GUIDE.md) sets `renderOrder` on every mesh inside
its `contents`, `walls`, `portalWall` and `door` (hiders 1, contents 2) and
re-applies it whenever a mesh appears below it. Values set by this
component inside a portal are overwritten — use it outside portals only
(found while adding Portal).

### Can't fix everything — see the cross-feature guide

`renderOrder` only sorts within the opaque or transparent render queue (never
across them), sorts whole mesh objects not individual triangles, and falls
back to camera-distance sorting for two objects with equal values. See
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.1](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#41-renderorder-cannot-fix-everything)
for what to reach for instead (dithering) when this genuinely can't do the
job.

### Interaction with LOD + Billboard — checked, documented, not a conflict

Confirmed this component's own write is never actually lost or corrupted
when used inside an `lod-object` group — see [3](#3-under-the-hood) and
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §2](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#2-how-render-order--lod-objectlod-manager-compose)
for the full explanation, including why a standalone value elsewhere in the
scene can't numerically collide with LOD's own dynamically-computed values
either (`lod-manager`'s `RENDER_ORDER_BASE`).

### No interaction found with any other feature on this branch

Doesn't touch `document` listeners, shared/global state, or camera — only
ever writes `renderOrder` on meshes inside its own entity's loaded model.
Free to combine with `random-field`, `proximity-wave`, `follow-node`,
`wander-in-band`, `ar-button`/`sound-button`, and `mirror-shard`/
`liquid-texture` with no interaction at all. The only features this
composes *meaningfully* with are LOD (above) and, if you also patch the
same material's shader, `proximity-fade`/`proximity-cutout` — see
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.4](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#44-onbeforecompile--program-caching).
