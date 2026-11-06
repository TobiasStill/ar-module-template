# Video feature guide

<!-- overview -->
## Overview

Brings videos into an AR scene — on a floating screen, wrapped around a
sphere the visitor stands inside, or on any object — and starts them all
together, with sound, the moment the visitor taps "Start". Phones only
allow sound after such a tap, and this feature makes sure the tap really
counts. When the visitor switches to another app, the videos pause, and
continue where they stopped when they come back.

<!-- /overview -->

## Technical summary

Starts, pauses and unmutes video assets from events — so one tap can start
every video of a scene, with sound, inside the gesture iOS requires — and
pauses them while the page is in the background. Applicable to any entity
(usually the plane, sphere or model showing the video) — see
[3. Under the hood](#3-under-the-hood).

<!-- project-specific -->
### Project context: origin

Generalised from the Augmented Bahnhofsviertel ports
(`augmented-bahnhofsviertel`: #7, #22, #23, #24 started their videos from a
Start/PLAY tap).

<!-- /project-specific -->

Files:

```
src/a-frame-components/video-control.ts
examples/video-usage.html   # scene wiring + attribute reference
```

No shipped assets (videos are project content). For video on a tracked
image, [Image Tracking](IMAGE-TRACKING-FEATURE-GUIDE.md) uses xrextras'
own `xrextras-play-video`.

## 1. Step-by-step: adding this to a new project

1. **Copy** `video-control.ts` into `src/a-frame-components/`.

2. **Nothing to register** — every component file in
   `src/a-frame-components/` is registered automatically under its file
   name as soon as the scene uses it (README, "The manifest"); unused ones
   aren't even bundled. Only a component registered under a different name,
   or one whose name is built at runtime, needs a manual entry in
   `src/manifest.ts`.

3. **Add the video** (`.mp4`) to `src/assets/`; show it with
   `material="src: #id; shader: flat"` or an `<a-videosphere src="#id">`, and
   put `video-control="video: #id"` on the same entity.

4. **Start it from a tap** — e.g. an [AR Overlay](AR-OVERLAY-FEATURE-GUIDE.md)
   control whose `onClick` emits `video-play` on the scene.

5. **Build and test** — on an iPhone (`npm run dev:ar`): the video starts
   on the tap, with sound if `muted: false`.

## 2. Entities & attributes

`multiple` — several per entity as `video-control__name`.

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `video` | selector | — | The `<video>` asset. |
| `muted` | boolean | `true` | Applied before `play()`; `false` = with sound (needs a tap). |
| `loop` | boolean | `true` | |
| `autoplay` | boolean | `false` | Start on init (works only muted). |
| `playOn` | string | `video-play` | Event, on the entity **or the scene**, that starts it. |
| `pauseOn` | string | `video-pause` | Event that pauses it. |
| `pauseWhenHidden` | boolean | `true` | Pause while the page is hidden, resume after if it was playing. |

Events **out**: `video-started` `{ video }` once playback runs,
`video-blocked` `{ video }` if the browser refused.

```js
// in a tap handler:
document.querySelector("a-scene").emit("video-play");
```

## 3. Under the hood

**Why events.** iOS only allows `play()` with sound synchronously inside
a user gesture. An A-Frame event emitted from a tap handler runs its
listeners synchronously, so `video-control`'s `play()` call still counts as
part of the gesture — one dispatch starts every video in the scene (it
listens on its entity and on the scene).

**Muted by the host.** The host (and both previews) inject every video
asset as `<video muted loop playsinline>`. `video-control` sets the element's
`muted` property from its attribute right before `play()` — the property,
not the attribute, is what the autoplay policy checks.

**Background.** On `visibilitychange` to hidden it pauses a playing video
and remembers it; when the page is visible again it resumes.

**Not `play()`.** A-Frame calls a component's `play()` method as a
lifecycle hook when the entity starts playing; the start method is named
`startVideo()` so videos don't start by themselves on scene start (found
while testing this feature).

## 4. Incompatibilities, risks & troubleshooting

- **A video texture may already play.** A-Frame's `material` system can
  start a `<video>` used as `src` by itself; `video-control` doesn't prevent
  that. For a video that must wait for the tap, keep it paused until then
  (or use `autoplay: false` and check in `dev:ar` on a phone).
- **Sound without a tap is blocked** — `video-blocked` fires; start from a
  tap.
- **Several entities, one `<video>`.** All `video-control`s pointing at the
  same asset control the same element — the last `muted` setting wins.
- **Event names are scene-wide.** The default `video-play` on the scene
  starts every `video-control` in the module; use custom `playOn` names to
  start videos separately.
- **Shared with Image Tracking.** `xrextras-play-video` (Image Tracking)
  starts its video on target found and listens for clicks itself; don't put
  both on the same video.
