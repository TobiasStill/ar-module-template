# Placement & Recenter feature guide

<!-- overview -->
## Overview

Makes sure a scene shows up in a good spot: as soon as the phone knows
where the floor is, the scene appears standing on it a few steps in front
of the visitor, facing them. If they wander off or the scene ends up
behind them, one tap (or a button) brings it back in front of them. A
scene can also adapt to the visitor's eye height so it looks the same
for tall and short people. A second tool works like a pointer on the
floor: a ring follows the middle of the screen across the ground, and a
tap drops a model right where the ring is.

<!-- /overview -->

## Technical summary

Puts a scene on the floor in front of the viewer, facing the way the
camera looks — once the camera has a usable pose, and again whenever the
viewer recenters (a button, an event, or a tap on the scene). Optionally
scales the scene to the viewer's height. A second component places a
model where the viewer taps on the ground, via a cursor that follows the
centre of the screen. Applicable to any entity — see
[3. Under the hood](#3-under-the-hood).

<!-- project-specific -->
### Project context: origin

Generalised from the Augmented Bahnhofsviertel ports
(`augmented-bahnhofsviertel`: `legacy-space` for placement/recenter, #5
Unwetter am Steg's `tap-place-cursor`). The old 8th Wall projects of that
series used a global XR8 `recenter` and the click-based
`xrextras-tap-recenter`; §3 explains why neither works for a module.

<!-- /project-specific -->

Files:

```
src/a-frame-components/place-in-front.ts
src/a-frame-components/tap-place-cursor.ts
src/a-frame-components/scene-tap-shared.ts   # helper, not a component
examples/placement-usage.html                # scene wiring + attribute reference
```

No assets. A recenter **button** is part of the [AR Overlay](AR-OVERLAY-FEATURE-GUIDE.md)
feature (`placeTarget`). Read
[4. Incompatibilities](#4-incompatibilities-risks--troubleshooting) before
combining with anything else that writes an entity's transform.

**Already in the start scene.** The template's `src/ArModule.vue` wraps
its content in `<a-entity id="scene-root" place-in-front="referenceHeight: 1.5; distance: 2">` — units inside
roughly metres, about 2 m in front of the viewer — because a fixed
position can't put anything on the floor: the host mounts the module 1.6
units above 8th Wall's floor (README "Where a module sits"). A project
built on the template has the files already; steps 1–2 below are only for
projects that don't. Why fixed positions fail, units vs. metres, and how
this relates to image targets:
[SCENE-PLACEMENT-GUIDE.md](../cross-feature-reference-docs/SCENE-PLACEMENT-GUIDE.md).

## 1. Step-by-step: adding this to a new project

1. **Copy the files** — `place-in-front.ts`, `tap-place-cursor.ts` and
   `scene-tap-shared.ts` — into your project's `src/a-frame-components/`.
   (`scene-tap-shared.ts` is imported by both; copy it even if you only use
   one of them.)

2. **Nothing to register** — every component file in
   `src/a-frame-components/` is registered automatically under its file
   name as soon as the scene uses it (README, "The manifest"); unused ones
   aren't even bundled. Only a component registered under a different name,
   or one whose name is built at runtime, needs a manual entry in
   `src/manifest.ts`.

3. **Wire the scene** — put your whole scene in one group entity with
   `place-in-front` (examples 1–2 in `examples/placement-usage.html`), and/or
   a cursor + target pair (example 3).

4. **Build and test** — `npm run build`, then `npm run dev:ar` on a phone:
   the scene appears in front of you; walk a few steps, turn, tap the scene
   (with `tapRecenter`) or send `place-in-front-place` — it reappears in
   front of you. In `npm run dev` (no camera engine) it places after 3 s.

## 2. Entities & attributes

### `place-in-front`

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `distance` | number | `2` | Content units from the camera's floor point to the entity's origin, along the camera's flattened view direction. Scales with `referenceHeight`. |
| `referenceHeight` | number | `0` | `0` = keep the authored scale. `> 0` = scale by camera height / this — for scenes authored "as seen from a camera this high above the floor". |
| `floorHeight` | number | `0` | World y of the floor. |
| `auto` | boolean | `true` | Place automatically once the camera has a usable pose. `false` = only on `place-in-front-place`. |
| `hideUntilPlaced` | boolean | `true` | Invisible until the first placement (no flash at the wrong spot). |
| `tapRecenter` | boolean | `false` | Re-place on every tap on the scene. |
| `fallbackAfter` / `xrFallbackAfter` | number | `3` / `15` | Seconds to wait for a camera height (without / with XR8) before placing anyway. |
| `fallbackScale` | number | `0.2` | Scale used then (only with `referenceHeight`). |
| `scaleShadows` / `scaleSounds` / `scaleLights` | boolean | `true` | When scaled, scale directional shadow cameras, positional sound distances, and point/spot light ranges along (see §3). |

Events: **in** `place-in-front-place` (re-place now); **out**
`place-in-front-placed` `{ scale }` after every placement, and
`place-in-front-tap` `{ clientX, clientY }` for every scene tap once placed
(whether or not `tapRecenter` is on — usable by other components that want
an iOS-safe tap).

```html
<a-entity id="my-scene" place-in-front="distance: 2; tapRecenter: true">
  <a-entity gltf-model="#Sculpture"></a-entity>
</a-entity>
```

### `tap-place-cursor`

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `target` | selector | — | Entity moved to the cursor on every tap (same parent as the cursor). |
| `ground` | selector | — | Entity whose meshes are the ground. Empty = the parent's y = 0 plane. |
| `lift` | number | `0.01` | Cursor height above the ground (parent units). |
| `followYaw` | boolean | `true` | Turn the cursor with the camera's heading. |
| `hideTargetUntilPlaced` | boolean | `true` | Target invisible until the first tap. |
| `smoothing` | number | `0.4` | Per-frame lerp of the cursor towards the hit point. |

Event **out**: `tap-place-cursor-placed` `{ position }`.

```html
<a-entity tap-place-cursor="target: #placed-model">
  <a-ring rotation="-90 0 0" radius-inner="0.15" radius-outer="0.2"></a-ring>
</a-entity>
<a-entity id="placed-model" gltf-model="#Sculpture"></a-entity>
```

Keep the visible ring a **child**: the cursor's own `rotation.y` is driven
by `followYaw`, which would tilt a ring rotated on the same entity.

## 3. Under the hood

**Why a module places itself.** A module never owns the camera or the 8th
Wall world origin — the host does (and shows other content and its own UI
in the same scene). A global XR8 `recenter` would move everything. `place-in-front` instead moves only its own
entity.

**World pose, converted to local.** The target pose is computed in world
space — floor at `floorHeight`, rotation only around the vertical axis —
and converted into the parent's local space through the parent's inverse
world matrix. The host mounts every module under an offset root
(`AR_MODULE_POSITION`, `0 1.6 -3`) and starts its camera at `0 0.35 0.8`;
`lib/preview-ar.ts` mirrors both (README "Where a module sits"), `npm run
dev` doesn't, and the fork's root entity may add its own offset; a fixed
correction would be right for only one of them. Heading: the camera's view direction flattened
onto the floor; when the phone is held (almost) straight down or up, the
screen's top edge is used instead — the direction it "points" while flat.

**Scaling to the viewer (`referenceHeight`).** 8th Wall's `responsive`
scale mode keeps the camera's start height as the real device height. A
scene authored for a camera `referenceHeight` units above the floor
therefore matches the real world when scaled by
`cameraHeight / referenceHeight` — independent of which start height the
host's camera uses. Three things live in world units in three.js regardless of the parent's
scale and are scaled along so the scene keeps its proportions: directional
shadow cameras (bounds **and** near/far — unscaled, the shadow map covers a
huge area at low resolution and the depth precision degrades into shadow
acne), positional sounds (`refDistance`/`maxDistance`, applied to the
pooled `PositionalAudio` objects so a playing sound isn't restarted, and
again when a sound finishes loading), point/spot light `distance`.

**Tap detection (`scene-tap-shared.ts`).** iOS Safari suppresses the
synthetic `click` once `xrextras-gesture-detector` (on the host's scene)
called `preventDefault()` on the touch, so a click-based tap (such as
`xrextras-tap-recenter`) never fires on an iPhone. A tap
is detected from pointer events instead: exactly one pointer, on the
scene's canvas (not on DOM UI — a module's Vue overlay is mounted inside
`<a-scene>` too), released within 350 ms and moved less than 12 px. Window
capture-phase listeners, so nothing on the canvas can swallow it.

**Cursor ground.** Without a `ground` entity the cursor intersects the
parent's own y = 0 plane — inside a placed scene that is the floor, with
no invisible ground mesh needed. Hit points are converted into the
parent's space before they're written (writing world coordinates into the
local position would only work at the scene root).

<!-- project-specific -->
#### Project context: Augmented Bahnhofsviertel

The old Augmented Bahnhofsviertel projects (camera at `0 8 8`) are placed
with `referenceHeight: 8; distance: 8`. Their original tap-place cursor
wrote world coordinates into the local position, which only worked at the
scene root.

<!-- /project-specific -->

## 4. Incompatibilities, risks & troubleshooting

- **Transform writers on the same entity.** `place-in-front` writes the
  entity's position, rotation and scale on every placement. Don't put
  `attach-to`, `wander-in-band`, `proximity-wave`, `gesture-control` or
  `hold-drag` on the **same** entity — put them on children (gestures on
  the model inside the placed group, see `examples/gestures-usage.html`).
- **One tap, several reactions.** The tap detector fires for every tap on
  the canvas. `tapRecenter` together with a `tap-place-cursor` in the same
  scene means one tap both re-places the scene and moves the target — use
  one or the other. The same tap can also hit a tappable entity through
  the host's cursor (`.cantap` `click`) or an [`ar-button`](SOUND-FEATURE-GUIDE.md)
  (own pointer handling): keep tap-to-recenter scenes free of tap targets,
  or use a recenter button instead.
- **Image tracking.** Don't use `place-in-front` on content anchored to an
  [image target](IMAGE-TRACKING-FEATURE-GUIDE.md) — the target drives that
  pose. Keep the image target (in its `world-origin` wrapper) outside the
  placed `scene-root`, as a sibling under the module root.
- **Camera not ready.** Placement waits for the camera to leave the floor
  (XR8 sets its height). If nothing appears for 15 s in `dev:ar`, the
  engine didn't start — check the console; the fallback then places at
  `fallbackScale`.
- **Pinch and placement scale.** Scaling done by pinch (`gesture-control`
  on a child) is independent of `referenceHeight` scaling on the parent;
  they multiply.
- Shared listeners: three window capture-phase pointer listeners per
  `place-in-front`/`tap-place-cursor` instance, removed on `remove()`.
  They never call `preventDefault()`/`stopPropagation()`, so they don't
  interfere with `ar-button`, the host's cursor or `xrextras-gesture-detector`.
