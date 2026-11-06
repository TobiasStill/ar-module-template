# Gestures feature guide

<!-- overview -->
## Overview

Lets visitors handle a virtual object with their fingers, the way they
would push a real one around a table: press and hold it for a moment, and
it lifts up and follows the finger across the floor; let go, and it settles
down where they dropped it. Twisting with two fingers turns it, pinching
makes it bigger or smaller (within sensible limits). One attribute switches
each of these on or off.

<!-- /overview -->

## Technical summary

Touch gestures for a model: hold and drag it along the ground, rotate it,
pinch to scale — configured in one attribute. Applicable to any entity —
see [3. Under the hood](#3-under-the-hood).

<!-- project-specific -->
### Project context: origin

Generalised from the Augmented Bahnhofsviertel ports
(`augmented-bahnhofsviertel`: `hold-drag`, plus the xrextras rotate/pinch
gestures the works #1–3, #8–10, #14, #21 use).

<!-- /project-specific -->

Files:

```
src/a-frame-components/gesture-control.ts
src/a-frame-components/hold-drag.ts
examples/gestures-usage.html   # scene wiring + attribute reference
```

No assets. Rotate and pinch come from xrextras, which the host and both
previews load — nothing to copy for them.

## 1. Step-by-step: adding this to a new project

1. **Copy the files** — `gesture-control.ts` and `hold-drag.ts` — into
   `src/a-frame-components/`.

2. **Nothing to register** — every component file in
   `src/a-frame-components/` is registered automatically under its file
   name as soon as the scene uses it (README, "The manifest"); unused ones
   aren't even bundled. Only a component registered under a different name,
   or one whose name is built at runtime, needs a manual entry in
   `src/manifest.ts`.

3. **Wire the scene** — `gesture-control` on the model
   (`examples/gestures-usage.html`). Requirements are met by the host and
   `lib/preview-ar.ts` already: `xrextras-gesture-detector` on `<a-scene>`,
   and the camera's cursor/raycaster hitting `.cantap`.

4. **Build and test** — `npm run dev:ar` on a phone (`npm run dev` has no
   touch gestures): hold the model ~0.3 s, then drag; two fingers rotate
   and pinch.

## 2. Entities & attributes

### `gesture-control`

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `drag` | boolean | `true` | Hold, then drag along the ground (sets `hold-drag`). |
| `rotate` | string | `two-finger` | `none`, `one-finger` or `two-finger` (sets `xrextras-*-finger-rotate`). |
| `scale` | boolean | `true` | Pinch to scale (sets `xrextras-pinch-scale`). |
| `ground` | string | `""` | Selector of the ground entity for dragging. Empty = the parent's y = 0 plane. |
| `riseHeight` | number | `1` | Height while dragged, parent units. |
| `dragDelay` | number | `300` | ms to hold before the drag starts. |
| `rotateFactor` | number | `5` | Rotation per finger travel. |
| `minScale` / `maxScale` | number | `0.33` / `3` | Pinch limits, relative to the scale the entity had when `gesture-control` was set. |

### `hold-drag` (also usable on its own)

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `ground` | selector | — | Ground entity; empty = the parent's y = 0 plane. |
| `groundId` | string | `""` | `xrextras-hold-drag` compatibility: ground by id (used when `ground` isn't set). |
| `cameraId` | string | `""` | `xrextras-hold-drag` compatibility: ignored — the scene's active camera is used. |
| `dragDelay` | number | `300` | ms to hold before dragging. |
| `riseHeight` | number | `1` | Height while dragged, parent units. |

Neither emits events.

```html
<a-entity place-in-front="distance: 2">
  <a-entity gltf-model="#Sculpture" gesture-control="rotate: one-finger; maxScale: 2"></a-entity>
</a-entity>
```

## 3. Under the hood

**Thin layer, not a re-implementation.** `gesture-control` only sets
(and, on change or removal, removes) `hold-drag`,
`xrextras-one/two-finger-rotate` and `xrextras-pinch-scale` on its own
entity, so the three gestures, their defaults and their pitfalls are
configured in one place. Pinch is only re-created when its own settings
change: `xrextras-pinch-scale` takes the entity's scale once, at init, as
its base — re-creating it on every update would make the already-pinched
size the new base.

**Why our own `hold-drag`.** `xrextras-hold-drag` writes the ground hit
point (world space) and a world-space `riseHeight` straight into the
entity's **local** position, and measures the drag distance between that
local position and the camera — verified in `@8thwall/xrextras`' source.
That is only right for an entity whose parent sits untransformed at the
scene origin; a module always sits under the host's offset root, so the
model jumps. `hold-drag` converts every point into the parent's space. The
press arrives as `mousedown` from the host's cursor (hence the `.cantap`
class it adds); finger movement and release come from
`xrextras-gesture-detector`'s `onefingermove`/`onefingerend` on the scene.
Without a ground entity it intersects the parent's y = 0 plane. The
original schema (`groundId`, `cameraId`) is still accepted, so markup
written for `xrextras-hold-drag` carries over.

## 4. Incompatibilities, risks & troubleshooting

- **Two-finger gestures are scene-wide.** `xrextras-two-finger-rotate` and
  `xrextras-pinch-scale` listen to `twofingermove` on the whole scene (not
  on the touched entity) — every entity with them turns/scales together.
  Use one `gesture-control` per scene, or on one group.
- **Pinch on the model, not a far-away group.** Pinch scales around the
  entity's own origin. On a group whose origin lies far from the model,
  the model drifts away while scaling and the size barely follows the
  fingers.
- **Transform writers.** All three gestures write the entity's
  position/rotation/scale. Don't combine with `place-in-front`,
  `attach-to`, `wander-in-band` or `proximity-wave` on the same entity —
  put `gesture-control` on a child of a placed group.
- **iOS click suppression.** `xrextras-gesture-detector` calls
  `preventDefault()` on touches, after which iOS Safari drops the synthetic
  `click`. Tap features that rely on the host's cursor `click`
  (`xrextras-play-video`, [Mirror Shard](MIRROR-SHARD-FEATURE-GUIDE.md))
  are affected by the detector being on the scene in general, not by this
  feature specifically; [Sound](SOUND-FEATURE-GUIDE.md)'s `ar-button` and
  [Placement](PLACEMENT-FEATURE-GUIDE.md)'s tap detection use pointer
  events and are not.
- **One finger, two meanings.** With `rotate: one-finger`, a quick swipe
  rotates and hold-then-move drags. If that's confusing for a scene, use
  `two-finger` (default) or `drag: false`.
- **Draw/other host modes.** The host switches its raycaster off in its
  drawing mode (`.__none__`) — dragging pauses then, rotate/pinch don't.

<!-- project-specific -->
### Project context: Augmented Bahnhofsviertel

The "pinch on the model, not a far-away group" pitfall above was found on
an Augmented Bahnhofsviertel work, whose pinch target was a group with its
origin far from the visible model.

<!-- /project-specific -->
