# Scene placement guide (where a module's content ends up)

<!-- overview -->
## Introduction

An AR module is a scene inside someone else's scene. The platform decides
where the camera starts and where it hangs each module, and the AR engine
decides where the real floor is and how big one unit is. None of that is
visible from inside the module's own file — so a model put "at height 0"
does not stand on the floor, it floats above the visitor's head.

The template therefore never places content with fixed numbers. Content
that should stand on the floor goes into a group that finds the floor by
itself, in front of the visitor. Content that sits on a recognised picture
goes into a wrapper that cancels the platform's shift, so the picture alone
decides where it appears. This guide explains the spaces involved, how the
platform and the previews set them up, the two tools, what went wrong
before they existed, and how to check a scene.

<!-- /overview -->

## About this guide

Not tied to one feature: it applies to every scene, and to
[Placement & Recenter](../guides/PLACEMENT-FEATURE-GUIDE.md) and
[Image Tracking](../guides/IMAGE-TRACKING-FEATURE-GUIDE.md) in particular.
Read it before positioning anything in `src/ArModule.vue`, before
"correcting" a scene that sits in the wrong place, and when a scene that
looks right in a preview is off in the app. Host facts are from
`TobiasStill/ar-demo-backend` at `727ea7a` (`frontend/src/components/ArScene.vue`,
`ArModule.vue`); measurements are from headless `dev:ar` sessions
([HEADLESS-AR-TESTING-GUIDE.md](HEADLESS-AR-TESTING-GUIDE.md)), not from a
phone, unless said otherwise.

## 1. The three spaces

| Space | Origin | Set by |
|---|---|---|
| **World** | 8th Wall's session origin; the **floor is world y = 0** | the AR engine (`xrweb`) |
| **Host** | the camera starts at `0 0.35 0.8`; every module is mounted inside an entity at `0 1.6 -3` (`AR_MODULE_POSITION`) | the host app (`ArScene.vue`) |
| **Module** | that mount entity: everything in `ArModule.vue` is relative to it | your scene |

So local `0 0 0` in `ArModule.vue` is world `0 1.6 -3`: 1.25 units above
and 3.8 in front of where the camera starts, and 1.6 units above the floor.

**Units are not metres.** The host's `xrweb` uses 8th Wall's default
`responsive` scale: the camera's start height in the scene stands for the
phone's real height above the floor. With a start height of 0.35 and a
phone held at about 1.4 m, one unit is about 4 m. (Derived from 8th Wall's
scale mode and [Placement §3](../guides/PLACEMENT-FEATURE-GUIDE.md#3-under-the-hood),
not measured on a device.) `place-in-front`'s `referenceHeight` scales a
scene to the viewer for exactly this reason — the start scene's
`scene-root` uses `referenceHeight: 1.5`, so inside it units are roughly
metres.

**The camera's start position matters.** 8th Wall keeps a non-zero start
position as the camera's starting pose (`0 0.35 0.8` stays `0 0.35 0.8`).
A start position of `0 0 0` is replaced by its own height of about 2 —
measured, see §6.

**Image-target sessions move the camera.** While an image target is
tracked, the camera's world pose is driven by it; its coordinates in the
measurements below jump around and are not comparable to the
world-tracking case. What matters there is whether content sits on the
image.

## 2. How each environment sets it up

| Environment | Camera start | Module root | 8th Wall | Notes |
|---|---|---|---|---|
| Host (an-alle.net) | `0 0.35 0.8` | `0 1.6 -3`, for every module, image targets included | yes, world tracking | one module shown at a time |
| `npm run dev:ar` / `build:ar` (`lib/preview-ar.ts`) | `0 0.35 0.8` | `0 1.6 -3`, for every module | yes | mirrors the host since 2026-10-06 |
| `npm run dev` (`lib/preview.ts`) | `0 0 0` | `0 1.5 0` | no — stock A-Frame | **not** matched; check placement in `dev:ar` |

`dev:ar` deliberately applies the host's offset to image-target modules
too. It used to skip it for them (2026-08-30), which made a module look
right in the preview and wrong in the app — see §5.

## 3. Content on the floor: `place-in-front`

The template's start scene wraps its content in

```html
<a-entity id="scene-root" place-in-front="referenceHeight: 1.5; distance: 2">
  … your scene; y = 0 is the floor, units ≈ metres …
</a-entity>
```

[`place-in-front`](../guides/PLACEMENT-FEATURE-GUIDE.md) computes a pose
in **world** space — on the floor (`floorHeight`, default 0), `distance`
units in front of the camera, facing it — and converts it into its parent's
space through the parent's inverse world matrix. Whatever the module root
is, the entity ends up on the real floor, and its children's `y = 0` is
the floor. It waits for a usable camera pose first (and falls back after
`xrFallbackAfter`/`fallbackAfter` seconds), can re-place on a button or tap
(recenter), and with `referenceHeight` scales the scene to the viewer's
height: the scale is camera height ÷ `referenceHeight`, so with `1.5` a
unit inside is what a metre is for a phone held at 1.5 m, and
`distance: 2` is about 2 m. Without it, raw units apply (~4 m each).

Measured: `scene-root` and the start scene's ground plane at world
`y = 0`, 0.47 units in front of the camera (2 × 0.35 / 1.5) in `dev:ar`;
in `dev` (no camera height) it uses `fallbackScale`.

Other components that already convert between world and local space —
`tap-place-cursor`, `spawn-sequence`, `portal`, `attach-to`, `billboard`
— work under any root the same way.

**Don't** place floor content with fixed offsets (`position="0 -1.6 0"`,
the old start scene's `0 -2 0`): a fixed value is right for one module root
only. `0 -2 0` put the old start scene's ground plane at world `-0.4`,
below the floor; in `npm run dev` the same value lands elsewhere again.

## 4. Content on an image: `world-origin`

`xrextras-named-image-target` (8th Wall `xrextras`) writes its own *local*
position/rotation from the tracked image's pose. Under the module root
that pose is shifted by `0 1.6 -3` — the content appears off the image,
usually off-screen. Wrap each target:

```html
<a-entity world-origin>
  <xrextras-named-image-target name="my-target">…</xrextras-named-image-target>
</a-entity>
```

[`world-origin`](../src/a-frame-components/world-origin.ts) sets its
entity's transform to the inverse of its parents' world matrix, so its
world matrix is the identity: the target behaves as if it were directly
under `<a-scene>`, as in 8th Wall's own examples. It computes the offset
instead of hard-coding it, so it is right with the host's offset, with
none (if the host ever drops it), and with `dev`'s different root.

Rules:

- `xrextras-named-image-target` is a **direct** child of the
  `world-origin` entity — nothing in between.
- The `world-origin` entity sits directly under the module root, **not**
  inside `scene-root` (a placed group would move the target again).
- Lay out content on the image with the
  [footprint convention](../guides/IMAGE-TRACKING-FEATURE-GUIDE.md#1a-the-footprint-convention-the-image-is-the-floor)
  (the image is the floor, Z is up), not with fixed offsets.
- `world-origin` writes its entity's transform: no other transform writer
  (`place-in-front`, gestures, `attach-to`, …) on the same entity.

## 5. History — how the offset was found and handled

| Date | Where | What |
|---|---|---|
| 2026-07-06 | `feature_template` (`f260034`) | Lights and camera position removed from the previews; the preview camera starts at `0 0 0` from then on. |
| 2026-07-11 | `Gyumin_module`, `Madleen_module`, `Zhichang_module` | Preview camera set back to the host's `0 0.35 0.8`, scenes compensated per project. Never reached `feature_template`. |
| 2026-08-30 | `feature_template` (`28cdd38`) | `dev:ar` stops applying the module-root offset to image-target modules — correct for tracked content, but only in the preview; the host kept applying it. |
| 2026-09-02 | `zufallsverteilung-lod` (`900cd7c`), `material-shader-showcase` (`4a5670c`), `animationssystem-wanderer` (`e9a9d86`) | Live debugging on an-alle.net: image-target content offset from the image by almost exactly `0 1.6 -3`. Fixed with a hard-coded counter-offset `<a-entity position="0 -1.6 3">` around the target, and `dev:ar` applying the offset again. Marked temporary — it double-cancels if the host drops the offset. |
| 2026-10-05 | Augmented Bahnhofsviertel branches | Preview camera at `0 0.35 0.8` as part of a full host alignment (`augmented-bahnhofsviertel/PORTING-GUIDE.md` §9). |
| 2026-10-06 | `feature_template` (`890f6bc` and the follow-up) | Preview camera `0 0.35 0.8`; `world-origin`; `dev:ar` applies the offset to every module; start scene placed with `place-in-front`. |

Branches still on an older state:

- **Fixed counter-offset** (`zufallsverteilung-lod`,
  `material-shader-showcase`, `animationssystem-wanderer` — the three
  example scenes exported as modules: `randomfield`, `shadershowcase`,
  `soundwanderer`): right for the current host. Replace with `world-origin` when the branch is touched
  again — then it also survives a host change.
- **No compensation, preview skips the offset** (e.g. `proximity-effekte`,
  never exported as a module): right in its own preview and as a
  standalone build, **shifted if it were loaded as a module in the host**. Add `world-origin` and take `lib/preview-ar.ts`
  from `feature_template` before exporting it as a module.
- **Preview camera at `0 0 0`** (any branch forked before 2026-10-06 that
  didn't fix it itself): the preview shows world-tracked content ~1.65
  units lower relative to the viewer than the app. Take
  `lib/preview-ar.ts` from `feature_template` and remove any offsets tuned
  by eye in that preview.

## 6. Measurements

Headless `dev:ar` (Chromium, emulated iPhone, generated camera video —
no device motion, so world-tracked content was compared by positions, not
by what's on screen). Image-target cases use the `video-target` example and
a red test box at `0 0 0.1` inside the target.

| Case | Result |
|---|---|
| Camera start `0 0 0` (old preview) | camera at ≈ `0 2.0 0`; module root relative to camera `0 -0.4 -3` |
| Camera start `0 0.35 0.8` | camera stays at `0 0.35 0.8`; module root relative to camera `0 1.25 -3.8` — as in the host |
| Start scene, `place-in-front="referenceHeight: 1.5; distance: 2"` (`dev:ar`) | `scene-root` and ground plane at world `y = 0`, 0.47 units in front of the camera — 2 m-equivalent at a 1.5 m phone height |
| Image target, root `0 0 0`, no wrapper (old preview) | box on the image |
| Image target, root `0 1.6 -3` (host), no wrapper | box off the image |
| Image target, root `0 1.6 -3`, `world-origin` | box on the image; `world-origin` at world `0 0 0` |
| Image target, root `0 0 0`, `world-origin` | box on the image |

**On a phone (2026-10-06):** a test scene — a 0.4 cube with a shadow, in
`scene-root` with `place-in-front="referenceHeight: 1.5; distance: 1.5"` —
deployed both as a module (loaded by the host, mounted at `0 1.6 -3`) and
as a standalone. Both looked the same: the cube stood on the real floor,
roughly a phone height in front of the viewer (the camera had to be tilted
down to see it, as expected at that distance), its shadow falling away
from the light. So `place-in-front` cancels the host's offset on a device
too.

Still to confirm on a phone: `world-origin` with an image target in the
host itself.

## 7. Checklist and symptoms

Before exporting a module:

- Floor content inside `scene-root` (`place-in-front`), no fixed offsets to
  reach the floor.
- Every `xrextras-named-image-target` directly inside
  `<a-entity world-origin>`, which sits directly under the module root.
- `lib/preview-ar.ts` from current `feature_template` (camera
  `0 0.35 0.8`, root `0 1.6 -3` for every module).
- Placement checked in `npm run dev:ar` (or headless), not only in
  `npm run dev`.

| Symptom | Likely cause |
|---|---|
| Scene floats above the visitor / ground plane in the air | content placed at fixed local heights instead of inside `scene-root` |
| Scene below the floor | an old fixed offset (`0 -2 0`, `0 -1.6 0`) under a root that already compensates |
| Image content right in the preview, off the image in the app | no `world-origin`; preview from before 2026-10-06 that skipped the offset |
| Image content off the image in the preview too, test box ~`0 1.6 -3` away | `world-origin` missing, or something between it and the target |
| Image content off by `0 -1.6 3` | fixed counter-offset **and** `world-origin`, or a host that dropped the offset under a fixed counter-offset |
| Preview and app differ in height by ~1.65 units | old preview camera at `0 0 0` |
| Scene huge or tiny compared to the room | units vs. metres (§1) — use `referenceHeight` |
