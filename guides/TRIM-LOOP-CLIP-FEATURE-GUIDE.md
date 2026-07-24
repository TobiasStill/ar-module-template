# Trim-loop-clip feature guide

Trims a glTF animation's dead lead-in (and tail) and plays it on a loop,
keeping multiple clips on one model in sync so they don't gradually drift
out of phase with each other. Applicable to any `gltf-model` that carries
one or more animation clips. Ported from `Fanyu_module`, essentially
unchanged — see [3. Under the hood](#3-under-the-hood) for the one addition
made and why nothing else needed to change.

Files:

```
src/a-frame-components/trim-loop-clip.ts
examples/trim-loop-clip-usage.html   # scene wiring + full attribute reference
```

No assets. Use this **instead of** A-Frame's stock `animation-mixer` on the
same entity — the two would fight over driving the same model's pose (see
[4](#4-incompatibilities-risks--troubleshooting)).

## 1. Step-by-step: adding this to a new project

1. **Copy the file** — `trim-loop-clip.ts` — into your project's own
   `src/a-frame-components/`. No path changes, no data files.

2. **Register it** in your project's `src/manifest.ts`:

   ```ts
   import trimLoopClip from "./a-frame-components/trim-loop-clip";

   export const manifest: Manifest = {
     assets: assetManifest.assets,
     components: {
       // ...whatever you already have...
       "trim-loop-clip": trimLoopClip
     }
   };
   ```

3. **Wire it into the scene** — see
   [2. Entities & attributes](#2-entities--attributes) or copy directly
   from `examples/trim-loop-clip-usage.html`.

4. **Build and test** — `npm run build`, then `npm run dev`. The fix is
   most visible on a model exported from a Blender scene whose preview
   range didn't start at frame 0 — look for a "big pause" before the
   animation starts with a plain `animation-mixer`, gone with this instead.

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `clip` | string | `"*"` | Which clip(s) to play, by name. `"*"` plays every clip found on the model. |
| `timeScale` | number | `1` | Playback speed multiplier, same meaning as `animation-mixer`'s `timeScale`. |
| `loop` | string | `"pingpong"` | `"once"` \| `"repeat"` \| `"pingpong"`. Ping-pong plays forward then reverse, back and forth. |
| `clampWhenFinished` | boolean | `false` | Hold the final frame when a non-looping (`"once"`) clip finishes, instead of snapping back. |

```html
<a-entity gltf-model="#AnimatedCharacter" trim-loop-clip="timeScale: 0.4"></a-entity>
<a-entity gltf-model="#AnimatedProp" trim-loop-clip="loop: repeat"></a-entity>
```

Nothing to call — starts automatically once the model's clips are
available. Changing any attribute at runtime rebuilds and restarts
playback with the new settings.

## 3. Under the hood

### The lead-in problem

Blender's glTF exporter bakes keyframe *times* from the scene timeline: if
you export only a preview range that starts at, say, frame 100, the first
keyframe lands at ~100/fps seconds, not at 0. A plain `animation-mixer`
then plays from `t=0` and just holds that first frame for those seconds —
the "big pause before the animation starts". There's no trim knob on
`animation-mixer` for this. This component takes the loaded clips and
shifts every track so the earliest keyframe sits at `t=0`, then clamps the
clip's duration to the span that actually contains keyframes — what's left
is only the moving part.

Shifting is done by giving each track a **fresh** `times` array rather than
subtracting in place: glTF samplers that share one input accessor (e.g.
every bone in a rig keyed on the same frames) end up sharing *one* `times`
array, because `GLTFLoader` caches accessors. Subtracting in place would
shift that shared array once per track referencing it, pushing keyframes
far out of range and freezing those tracks after the second shift.

### Keeping multiple clips in sync

When a model has more than one clip (e.g. a rig animation plus a
separately-keyed submesh), each clip's own trimmed duration is rarely
identical. Looping them independently via the mixer's normal per-action
bookkeeping, each bounces/wraps at its own length and drifts out of phase
a little more every cycle, even though they start in sync. three.js's
built-in `AnimationAction.syncWith()` looks like the fix for exactly this,
but in practice its synced relationship resets at every loop boundary when
the clip lengths differ, producing a step-drift once per master cycle
instead of none.

So with more than one clip, this component takes over time advancement
itself: every action is driven directly off **one shared clock** — the
*longest* clip's duration sets the loop period, and every action's `.time`
is that same raw elapsed value, clamped to its own (possibly shorter)
duration. This plays each clip at its natural authored rate rather than
stretching it to fit the master's length (stretching a slightly-shorter
clip to always finish exactly when the master does makes it play a little
slower than 1:1, which reads as "lagging behind" for the whole cycle). A
clip that finishes early just holds its final pose until the shared clock
(and the master with it) also completes and reflects.

### What changed from the source

One addition: an immediate check, in `init()`, for a model that finished
loading *before* this component's own `init()` ran — the source only
listened for a future `model-loaded` event, which misses a model that's
already cached/preloaded by the time this component mounts. This is the
same "don't miss an event that already fired" pattern every other
`model-loaded`/`object3dset`-driven component on this branch already
follows (see
[RENDER-ORDER-FEATURE-GUIDE.md §3](RENDER-ORDER-FEATURE-GUIDE.md#3-under-the-hood)
for the original finding). Nothing else needed to change — every
tunable (clip selection, speed, loop mode, clamping) was already a freely-set
schema attribute with no naming-convention or asset-specific assumptions.

## 4. Incompatibilities, risks & troubleshooting

### Don't combine with `animation-mixer` on the same entity

Both drive the same model's pose via a `THREE.AnimationMixer` on the same
root object — using both on one entity means two mixers independently
calling `.clipAction()` on the same clips and fighting over which one's
`.update()` call actually wins each frame (whichever runs its `tick()`
last). Use `trim-loop-clip` in place of `animation-mixer`, not alongside
it, on any one entity.

### `clip` name mismatches

If `clip` doesn't match any clip name on the model (typo, or the model
genuinely has no clip by that name), `wanted` resolves to an empty array —
no console warning, no crash, just nothing plays. Check the model's actual
clip names (e.g. log `model.animations.map(c => c.name)`) if nothing
animates.

### No interaction found with any other feature on this branch

Only ever touches this entity's animation mixer/actions — no `document`
listeners, no shared/global state, no material patches, no camera reads,
no `renderOrder`. Free to combine with `ar-button`/`sound-button`,
`follow-node` (e.g. tracking a node inside the same animated model),
`wander-in-band`, `random-field`, or any material-touching component with
no interaction at all.
