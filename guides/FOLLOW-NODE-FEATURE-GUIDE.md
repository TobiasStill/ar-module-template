# Follow-node feature guide

Makes an entity's position continuously track a named node (mesh, empty, or
bone) inside another entity's loaded glTF — so something A-Frame-level (a
`sound` component, a light, a marker) can be attached to a specific moving
part of an animated model, rather than that model's overall static entity
transform. Ported from `Fanyu_module`, essentially unchanged — see
[3. Under the hood](#3-under-the-hood) for the one cosmetic normalization
made and why nothing else needed to change.

Files:

```
src/a-frame-components/follow-node.ts
examples/follow-node-usage.html   # scene wiring + full attribute reference
```

No assets. No dependency on any other feature on this branch, and nothing
here depends on `wander-in-band` either, despite both being ported from the
same source branch in the same batch — they're independent, unrelated
features (see `WANDER-IN-BAND-FEATURE-GUIDE.md`).

## 1. Step-by-step: adding this to a new project

1. **Copy the file** — `follow-node.ts` — into your project's own
   `src/a-frame-components/`. No path changes, no data files.

2. **Register it** in your project's `src/manifest.ts`:

   ```ts
   import followNode from "./a-frame-components/follow-node";

   export const manifest: Manifest = {
     assets: assetManifest.assets,
     components: {
       // ...whatever you already have...
       "follow-node": followNode
     }
   };
   ```

3. **Wire it into the scene** — see
   [2. Entities & attributes](#2-entities--attributes) or copy directly
   from `examples/follow-node-usage.html`.

4. **Build and test** — `npm run build`, then `npm run dev`. You'll need an
   animated glTF with a named node to actually see it track anything —
   without one, it just warns to the console and stays put (see
   [4](#4-incompatibilities-risks--troubleshooting)).

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `target` | selector | — | Required. The entity whose loaded glTF contains the node to track. |
| `node` | string | — | Required. The node's name (`THREE.Object3D#name`) within that glTF — a mesh, empty, or bone name exactly as authored in your DCC tool (e.g. Blender). |

```html
<a-entity gltf-model="#MyAnimatedCharacter" id="mainCharacter"></a-entity>

<a-entity
    follow-node="target: #mainCharacter; node: shapekey_object"
    sound="src: #myClip; positional: true; ...">
</a-entity>
```

Nothing to call or listen for — once both attributes resolve, this
entity's `position` updates every frame automatically. Anything parented
under this entity (a `sound` node, a light, a visible marker) rides along
for free, same as any other A-Frame parent/child transform.

## 3. Under the hood

### What changed from the source

Only one thing, and it's cosmetic: the source accessed three.js via
`declare const AFRAME: any; const THREE = (AFRAME as any).THREE;`; this
port uses the bare `declare const THREE: any;` every other component on
this branch already uses (`window.THREE`, which A-Frame also sets — the
same object `AFRAME.THREE` points at). No behavior change, just matching
this branch's established style. Nothing else was touched — see
[the note on why](#why-no-functional-changes-were-needed) below.

### How the tracking actually works

`init()` finds the target's loaded glTF root (`target.getObject3D("mesh")`
— the same object3D key A-Frame's `gltf-model` component attaches the
loaded scene under; `proximity-fade`/`proximity-cutout` on this same
branch read the identical key for the identical reason) and resolves
`node` on it via `Object3D#getObjectByName`. If the target's model hadn't
loaded yet when this component initialized, it listens for `model-loaded`
on the target and resolves once that fires — and also resolves
immediately if the model turns out to already be loaded (covers whichever
order the two entities happen to initialize in).

`tick()` does three things: force-recomputes the tracked node's
`matrixWorld` (an animation mixer only updates a node's *local*
transform each tick — `matrixWorld` isn't refreshed until the renderer's
own traversal, so reading it immediately after would be a frame stale),
reads the node's resulting world position, and converts that into this
entity's own parent's local space (`parent.worldToLocal`) before writing
it to `position` — so this entity behaves like a normal, correctly-parented
A-Frame child regardless of where in the scene graph it actually sits
relative to the target.

### Why no functional changes were needed

Checked deliberately, not skipped: `target`/`node` are both required,
freely-set attributes with no hardcoded defaults tied to any specific
model or scene — there's no camera-position compensation, no fixed node
name, no assumption about what the target model actually is beyond "an
entity with a loaded glTF." The component was already exactly as generic
as this port needed it to be.

## 4. Incompatibilities, risks & troubleshooting

### No interaction found with any other feature on this branch

Only ever writes this entity's own `position`. No `document`-level
listeners, no shared/global state, no material patches, no camera reads —
so there's nothing for this to conflict with, and no reason it can't be
combined freely with `ar-button`, `sound-button`, `wander-in-band`, or
anything else. (`wander-in-band` also only ever writes its own
`position`/`rotation.y` on its *own* entity, so the two don't collide even
if both happened to end up on entities in the same subtree.)

### Missing `node` degrades gracefully

If `node` doesn't match anything on the target's model (typo, wrong
model, or a name that doesn't survive whatever glTF export pipeline
produced the file), this logs one console warning
(`[follow-node] node "..." not found on target's model.`) and simply never
moves the entity — it stays at whatever static position was authored in
markup. Not a crash, but easy to miss if you're not watching the console;
check there first if something isn't tracking as expected.

### Depends on the target's animation actually moving the node

This only *reads* the target node's transform — it has no opinion about
what's animating that node (a shapekey-driven mesh move, a bone animation,
anything else driving the target's own `AnimationMixer`). If the target
model has no animation actually applied yet (e.g. an animation-driving
component hasn't started), `follow-node` will still track correctly — it'll
just track a node that isn't moving yet.
