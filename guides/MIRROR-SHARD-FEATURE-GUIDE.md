# Mirror-shard feature guide

A field of 112 glass "mirror shards" that ripple outward from tapped points
with a gentle idle sway, rendered in three merged draw calls total
regardless of shard count. Salvaged and substantially reworked from
`Zhichang_module`'s `dms-mirror-shards` — an artistic installation piece
authored on another AR platform, redesigned with ChatGPT, then adapted into
this project with Claude. See
[3. Under the hood](#3-under-the-hood) for exactly what was kept, what was
dropped, and why — the short version is: this keeps the tuned impact/idle
motion shader and the shard geometry data, merges what the source left as
112 separate draw calls into one, and drops the source's own SLAM-based AR
placement system, multi-panel layout, and shatter-and-fall "fracture" mode
entirely (none of which this template needs — placement in particular
duplicated functionality this template already gets from 8th Wall + A-Frame
natively, which is exactly what wasn't wanted here).

This is the worked example (alongside `LIQUID-TEXTURE-FEATURE-GUIDE.md`) for
`ADDING-FEATURES-WORKFLOW.md`'s general process, extended with a new kind of
step: *salvaging* a feature from a branch whose overall approach (custom AR
placement, in this case) isn't wanted at all, keeping only one specific
visual effect out of a much larger, tangled prototype.

Files:

```
src/a-frame-components/
  mirror-shard.ts             # the shard field
  mirror-shard-data/shards.json  # bundled shard geometry (112 triangles)
src/manifest.ts                 # registers mirror-shard (+ liquid-texture, see below)
examples/mirror-shard-usage.html # scene wiring + full attribute reference
examples/mirror-shard-liquid-texture-scene.html # both components combined,
                                  # recreating the original Zhichang_module
                                  # scene as closely as this system allows
```

`mirror-shard`'s optional inner illustration layer is powered by a
**separate, generic** component, `liquid-texture` — its own guide is
`LIQUID-TEXTURE-FEATURE-GUIDE.md`. `mirror-shard` only *consumes* it (via a
selector attribute); it has no idea how that texture is produced.

## 1. Step-by-step: adding this to a new project

1. **Copy the component and its data** — `mirror-shard.ts` and the
   `mirror-shard-data/` folder (containing `shards.json`) into your
   project's own `src/a-frame-components/`. No path changes — `shards.json`
   is imported via a relative path from `mirror-shard.ts` itself, so the
   two travel together as a unit.

2. **Copy `liquid-texture.ts` too** if you want the inner illustration
   layer (recommended — see its own guide for why it's worth having even
   without a custom target image). Purely optional: `mirror-shard` works
   without it, falling back to a flat tint.

3. **Register in `src/manifest.ts`**:

   ```ts
   import mirrorShard from "./a-frame-components/mirror-shard";
   import liquidTexture from "./a-frame-components/liquid-texture"; // optional

   export const manifest: Manifest = {
     assets: assetManifest.assets,
     components: {
       // ...whatever you already have...
       "mirror-shard": mirrorShard,
       "liquid-texture": liquidTexture // optional
     }
   };
   ```

4. **Wire it into the scene** — see [2. Entities & attributes](#2-entities--attributes)
   or copy directly from `examples/mirror-shard-usage.html` (attribute-by-
   attribute reference) or `examples/mirror-shard-liquid-texture-scene.html`
   (both components combined into one scene, with every attribute mapped
   back to the original installation's own values). Remember
   `class="cantap"` on the entity if you want the built-in tap-to-pulse —
   see [4](#4-incompatibilities-risks--troubleshooting) for why the
   component can't set that for itself.

5. **Build and test** — `npm run build`, then `npm run dev` for a
   VR/desktop preview (tap-to-pulse works via mouse click in the desktop
   preview too, since it goes through the same A-Frame cursor system).

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `height` | number | `1.86` | Overall physical height (metres) the shard field is scaled to. No separate width — it follows the bundled layout's own aspect ratio. |
| `motionEnabled` | boolean | `true` | `false` freezes the field in its rest pose. |
| `idleRotationEnabled` | boolean | `true` | The gentle idle sway. |
| `idleRotationStrength` | number | `1` | Scales the idle sway's amplitude (~0-2). |
| `shockAfterglow` | number | `1` | Scales the lingering glow/ripple after a pulse's initial impact (~0-2). |
| `liquidTarget` | selector | — | Entity carrying `liquid-texture`; its rendered texture becomes the inner illustration layer. Omit for a flat tint. |

Position/rotate/scale the entity itself like any other A-Frame entity —
there's no separate placement attribute or system.

```html
<a-entity class="cantap" position="0 1 -3" mirror-shard="height: 1.86; liquidTarget: #shard-liquid"></a-entity>
```

Method: `pulse(x?, y?, strength?)` — triggers an impact ripple at local
`(x, y)` (both default `0`, the field's centre); `strength` defaults to a
small random value (~1.16-1.46) if omitted, matching a plain tap. Also
pulses `liquidTarget` if set, so the two stay visually coupled. Call this
from any other component (e.g. an `ar-button`'s tap handler) for tap
sources other than the built-in `click` listener.

Event: `mirror-shard-pulse` (non-bubbling, detail `{x, y, strength}`) —
emitted on every pulse, from any source, for anything else that wants to
react.

## 3. Under the hood

### What was kept, what was dropped, and why

The source file (`dms-mirror-shards.ts`, 4,716 lines) bundled together: the
shard visual effect itself, a separate "liquid ink" marbling effect, a
custom SLAM-based AR placement system (duplicating what this template
already gets from 8th Wall + A-Frame — explicitly not wanted), a
multi-panel layout system, a shatter-and-fall "fracture" mode, and DOM
chrome/status-text/debug tooling for the standalone prototype. Kept:

- **The impact/idle displacement shader** (`dmsApplyMotion` in the source,
  `shardApplyMotion` here) — the tuned math that makes the shards ripple
  outward from a tap and sway gently at idle. Ported near-verbatim. One
  piece was removed: a term that biased shards to physically gather toward
  one of two hardcoded "political choice" directions (`shapePolarity`/
  `shapeFinal`, feeding `blueGather`/`orangeField` in the source), coupled
  to the source's dual-target liquid effect. That mechanic only makes
  sense paired with the two-target "choice" narrative this port
  deliberately dropped (see `LIQUID-TEXTURE-FEATURE-GUIDE.md`); the
  impact-ripple and idle-breathing systems it was layered onto are
  untouched.
- **The shard geometry** — the bundled 112-triangle layout (`shards.json`).
  The source had two files, `shards-data.json`/`shards-impact-star.json`;
  they were byte-for-byte identical, so only one is kept.
- **The glass-optics fresnel rim light** (`attachGlassOpticsToMaterial` in
  the source) — a small fragment-shader injection that makes the glass
  material read as glass at grazing angles. Kept verbatim; it's not
  narrative-specific, just "how do you make three.js physical glass look
  right."

Dropped entirely: the SLAM placement system (`dms-world-room-anchor` and
the duplicate placement schema/handlers inside the shard component itself
— the latter were already dead in the source branch's own real usage,
which set `placeFromCameraOnStart: false; manualPlacementOnStart: false`);
the multi-panel layout (`panelLimit`/panel spacing — the source's own real
usage always used exactly 1 panel); the shatter-and-fall fracture mode
(`enableFracture` and its stress/break/fall/hold/recover state machine —
also `false` in the source's real usage, and a materially different visual
effect from "ripples and sways" in its own right, not attempted here); all
DOM chrome, status text, and debug/diagnostic tooling
(`updateDebugState`/`arStatus`/the performance HUD/the query-string quality
override); the auto-cycle attribute (dead in the source — declared but
never read anywhere).

### Merging the glass layer into one draw call

The source built one `Mesh` + one `.clone()`d `MeshPhysicalMaterial` per
shard (112 of each) even in its default, non-fracture configuration — the
single most expensive part of the original (`MeshPhysicalMaterial` with
`transmission`/`clearcoat` is one of three.js's costlier material types,
and each of the 112 clones needed its own shader compile). This port builds
all 112 shard shapes, bakes each shard's per-shard tint
(`colorForShard(seed)`, unchanged) into a **vertex color** instead of a
separate material instance, and merges all 112 into **one**
`BufferGeometry` + **one** shared `MeshPhysicalMaterial({ vertexColors:
true, ... })`. The glass-optics and motion shader patches
(`onBeforeCompile`) now run once instead of 112 times. The inner
illustration and edge/highlight layers were already merged in the source's
non-fracture mode (`mergeStaticLayers`); this port keeps that approach, now
trivially applying to a single panel instead of N.

One deliberate loss from merging: the source also gave each shard a small
per-shard jitter in *opacity* (`0.20 + noise*0.045`) and *roughness*
(`0.032 + noise*0.032`) — material properties that (unlike color) three.js
can't vary per-vertex without more custom shader work. This port uses a
single shared opacity/roughness (the midpoint of each original range)
instead. The visual difference is subtle — the per-shard color tint (kept)
is what actually reads as "each shard is a little different," not the
opacity/roughness micro-variation.

### Motion attribute plumbing

Each shard's geometry carries two custom vertex attributes,
`shardCenter`/`shardSeed` (the source's `dmsCenter`/`dmsSeed`, renamed —
purely internal shader plumbing, never exposed in the component's schema/
API, so renaming them cost nothing observable). These survive the merge
into one `BufferGeometry` unchanged (each shard's vertices keep their own
`shardCenter`/`shardSeed` values), which is *why* the merge doesn't break
per-shard motion — the displacement shader reads these per-vertex, not from
anything material- or mesh-instance-specific.

### Tap handling

Listens for the plain `click` event A-Frame's cursor/raycaster system
synthesizes for `.cantap`-classed elements (the same mechanism
[Image Tracking](IMAGE-TRACKING-FEATURE-GUIDE.md)'s `xrextras-play-video`
uses, and the same one the source branch's own `dms-installation` entity
already used via `class="cantap"` in its `ArModule.vue`) — **not** the
`ar-button`/`ar-button-manager` system (`pointerdown`/`pointerup`). This
was a deliberate choice to preserve, not a gap: the source already used the
host's standard tap mechanism correctly, so there was nothing to fix here,
and no interference risk from a *second* raycast/tap system being
introduced. See [4](#4-incompatibilities-risks--troubleshooting) for a
caveat on `click` specifically, inherited from the same finding already
documented for Image Tracking.

## 4. Incompatibilities, risks & troubleshooting

### `class="cantap"` is required, and the component can't set it

Unlike `ar-button` (which does its own raycasting and needs no class),
`mirror-shard`'s tap-to-pulse relies entirely on the host's shared camera
cursor/raycaster, which — per `main`'s own manifest-typing comments — is
scoped to elements classed `.cantap`. `mirror-shard.ts` doesn't add that
class itself (a component adding a class to its own host element on `init`
is fragile against a project's own class list on that element), so remember
it in markup. Forgetting it doesn't error — the field just never receives
a `click` and never pulses on its own (you can still drive it via
`pulse()` from other code).

### The same `click`-suppression risk already documented for [Image Tracking](IMAGE-TRACKING-FEATURE-GUIDE.md)

`SOUND-FEATURE-GUIDE.md` documents that iOS Safari has been observed to
suppress the synthetic `click` A-Frame's cursor system produces, once
anything upstream in that touch sequence (e.g. `xrextras-gesture-detector`,
used for pinch/rotate) called `preventDefault()` — which is exactly why the
sound feature's own tap system uses raw `pointerdown`/`pointerup` instead.
`mirror-shard` (like Image Tracking's `xrextras-play-video`) uses `click`, so it's
subject to the same risk: if a project combines pinch/rotate gestures with
a tappable mirror-shard field, tapping it may fail specifically on iPad/
iPhone. Not verified directly here either — same recommendation as the
sound guide: test on an actual device before shipping if you combine the
two.

### No interaction found with `proximity-fade`/`proximity-cutout`

Checked directly: those two features only ever touch materials reached via
a bubbled `model-loaded` event from a `gltf-model` descendant.
`mirror-shard`'s glass/inner/edge/highlight meshes are built directly from
`THREE.ShapeGeometry` — no `gltf-model` component is involved anywhere in
its construction, so `model-loaded` never fires for them and they're never
touched by either proximity feature, regardless of scene nesting.

### No interaction found with `ar-button`/`sound-button`

Different tap mechanism entirely (see above — `click` vs. `pointerdown`/
`pointerup`), different property writes (`mirror-shard` never touches
`object3D.scale`, which is `ar-button`'s own domain). The two can coexist
in the same scene freely. If a project wants an `ar-button` (with its
generic bounding-box trigger zone) to also drive a mirror-shard pulse
instead of relying on `.cantap`/`click`, call `pulse()` directly from an
`ar-button-tap` listener on a co-located or nearby entity — see
`examples/mirror-shard-usage.html`'s method reference.

### Performance is much improved but not free

Three merged draw calls (down from 112+) is the headline win, but the
glass material is still a `MeshPhysicalMaterial` with `transmission`/
`clearcoat` — an inherently more expensive material type than a basic/
standard material, run across the whole merged mesh every frame regardless
of shard count. This is expected and matches how glass is meant to look;
if a project needs to go further, the next lever would be dropping
`transmission` for a cheaper fake-glass approximation (fresnel + alpha
blend only) — not attempted here since it would change the look, not just
the cost.

### Bundle size

`mirror-shard-data/shards.json` is ~62KB, bundled directly into
`ar-module.js` via a static import (not a `src/assets/` file — it's
geometry data the component needs synchronously at build time, not a
runtime-loaded asset). Expect `ar-module.js` to grow by roughly that much
plus the component code itself once this feature is included.
