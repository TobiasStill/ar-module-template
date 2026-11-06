# Image tracking feature guide

<!-- overview -->
## Overview

Makes a printed picture come alive. Point the phone at a specific poster,
postcard or photo, and the app recognises it and places 3D content right
on top of it — a video starts playing on its surface, a model grows out of
it, objects hover above it. When the picture moves, the content moves
along; when it leaves the camera view, the content disappears. The picture
works like a stage floor: everything is laid out on and above it, scaled to
its size.

<!-- /overview -->

## Technical summary

Anchors content to a specific real-world printed/displayed image — detects
a target image in the live camera feed and shows/hides/positions content
to track it, entirely via 8th Wall's own image-target engine. It started as
the template's own baseline demo content, previously wired directly into
`ArModule.vue`; moved here to keep the baseline scene free of example
content, matching how every other feature in this template works.

The two tracking components (`xrextras-named-image-target`,
`xrextras-play-video`) are provided by the 8th Wall `xrextras` library
itself, already loaded in every preview flavour and by the real host. The
one file of ours to copy is `world-origin.ts`: the host mounts every module
`0 1.6 -3` away from the scene origin, which would shift tracked content off
the image, and `world-origin` cancels that (see [3](#3-under-the-hood)).
What's project-specific is the target image data and the content you anchor
to it — see [1](#1-step-by-step-adding-this-to-a-new-project).

Files:

```
examples/image-targets/video-target.json          # demo target descriptor
examples/image-targets/video-target_original.jpg   # \
examples/image-targets/video-target_cropped.jpg     #  the 4 images the
examples/image-targets/video-target_thumbnail.jpg   #  descriptor references
examples/image-targets/video-target_luminance.jpg  # /
src/a-frame-components/world-origin.ts   # cancels the host's module-root offset (shared building block)
examples/image-tracking-usage.html   # scene wiring + full attribute reference
```

**Assets:** [`image-tracking-demo-video.mp4`](../examples/assets/image-tracking-demo-video.mp4)
(the example's video, played once the target is detected) and
[`image-tracking-poster.jpg`](../examples/assets/image-tracking-poster.jpg)
(its poster frame). Copy them into `src/assets/` to try the example.

**Not active by default** — `src/manifest.ts` doesn't register any
`imageTargets`, and `src/image-targets/` is empty. The demo target waits in
`examples/image-targets/`, so it doesn't ship with modules that don't use it;
copying and registering it is an explicit step — see [1](#1-step-by-step-adding-this-to-a-new-project).

## 1. Step-by-step: adding this to a new project

1. **Get a target image descriptor.** To test, copy the five demo files from
   `examples/image-targets/` into `src/image-targets/`; print or show
   `video-target_original.jpg` as the picture to point the camera at. For your
   **own** target image,
   run it through 8th Wall's image-target compiler tool (part of the 8th
   Wall workspace/console — this project doesn't bundle that tool, only its
   output format) and download the resulting bundle: one `<name>.json`
   descriptor plus 4 images (`_original`, `_cropped`, `_thumbnail`,
   `_luminance`). Drop all 5 files into `src/image-targets/` — this folder
   is scanned and copied into every build automatically (see
   [3](#3-under-the-hood)), no manifest entry needed for the files
   themselves.

2. **Register the target's JSON** in your project's `src/manifest.ts`
   (image targets are still listed by hand — only components register
   automatically):

   ```ts
   import videoTarget from "./image-targets/video-target.json";
   // (name it after your own target file instead)

   export const manifest: Manifest = {
     assets: assetManifest.assets,
     components: { ...usedComponents },
     imageTargets: [videoTarget]
     // multiple targets: imageTargets: [videoTarget, anotherTarget]
   };
   ```

3. **Drop in whatever content should be anchored to the target** — e.g. the
   video and poster this example uses (`image-tracking-demo-video.mp4` and
   `image-tracking-poster.jpg` from `examples/assets/`, or your own
   `.mp4`/`.glb`/image) — into `src/assets/` as usual.

4. **Wire it into the scene** — copy `src/a-frame-components/world-origin.ts`
   into your project and wrap every `xrextras-named-image-target` in
   `<a-entity world-origin>` (a direct child of it, nothing in between).
   Without that wrapper the content sits `0 1.6 -3` away from the image in
   the host and in `npm run dev:ar` — see [3](#3-under-the-hood). Then see
   [2. Entities & attributes](#2-entities--attributes) or copy directly
   from `examples/image-tracking-usage.html`.

5. **Build and test with `npm run dev:ar`, not `npm run dev`.** This is
   not optional — see [3](#3-under-the-hood) for why the plain VR/desktop
   preview can never show this working, no matter how correctly it's
   wired. Point your phone's camera at the target image (or its
   `_original`/`_cropped` file, displayed on another screen) to test
   detection.

   **Display the target large and against a plain background.** A
   repeating/patterned background near the target (e.g. patterned
   wallpaper) is a real, observed false-positive risk — the tracker can
   lock onto a stretch of the pattern instead of the actual target,
   showing content in the wrong place with no error. Fill a large
   fraction of the camera frame with the target image itself.

6. **Lay out your content using the footprint convention** — see
   [1a](#1a-the-footprint-convention-the-image-is-the-floor) before
   placing anything. Getting this wrong (an arbitrary fixed offset like
   `position="0 -2 0"`) is the most common way for content to track
   correctly (confirmed by events firing, wrapper visible) while still
   being invisible — placed meters away from where the camera happens to
   be looking.

### 1a. The footprint convention: the image is the floor

Every scene anchored to an image target should treat the tracked image
as the scene's ground plane, not as a poster something else stands in
front of: `xrextras-named-image-target`'s local X/Y axes match the
printed image's own width/depth exactly (its origin is the image's
*centre*, not a corner — confirmed via `xrextrasimagegeometry`'s
`scaledWidth`/`scaledHeight`, which describe the full span centred on
0,0); local Z is height above the image, pointing out of it toward the
camera. Two hard rules follow:

- **Horizontal (X/Y) position must stay within the image's own printed
  bounds.** Only Z (height) is free to extend beyond them.
- **Sizes and offsets should be proportional to the footprint**, not
  fixed units — so a scene keeps its proportions when a placeholder
  target is swapped for the real, differently-sized one.

In code:

```ts
// FOOTPRINT_DEPTH is always 1 — the engine normalizes the target's local Y
// extent to 1. FOOTPRINT_WIDTH follows the target's own aspect ratio.
const targetProps = (manifest.imageTargets?.[0] as any)?.properties;
const FOOTPRINT_DEPTH = 1;
const FOOTPRINT_WIDTH = targetProps ? targetProps.width / targetProps.height : 0.75;

const SPHERE_RADIUS = FOOTPRINT_DEPTH * 0.08;
const CONTENT_HEIGHT = FOOTPRINT_DEPTH * 0.2; // how high above the image content floats
```

```html
<a-entity world-origin> <!-- cancels the host's module-root offset, see §3 -->
<xrextras-named-image-target name="video-target">
  <a-entity> <!-- no position — sits exactly at the target's own anchor -->
    <!-- content positioned as fractions of FOOTPRINT_WIDTH/FOOTPRINT_DEPTH,
         height (Z) proportional to FOOTPRINT_DEPTH, never Y/X beyond ±half
         the footprint -->

    <!-- Ground plane = the image itself: no rotation (a-plane's default
         orientation already matches the image's own plane), sized to the
         image's own bounds, sitting at Z=0. Semi-transparent so the
         footprint is visible for orientation while building/debugging. -->
    <a-plane :width="FOOTPRINT_WIDTH" :height="FOOTPRINT_DEPTH"
        material="color: #3b82f6; opacity: 0.35; side: double" shadow></a-plane>
  </a-entity>
</xrextras-named-image-target>
</a-entity>
```

Rotating content in a circle *above* the image (a "wandering" object, a
spinner, etc.) should rotate around **Z**, not Y — Z is this convention's
up-axis, so `animation="property: rotation; to: 0 0 360; ..."` orbits
horizontally above the image; `to: 0 360 0` (the Y-up default one would
normally reach for) tips the orbit into the image instead.

<!-- project-specific -->
#### Project context: `sound-player`

The code above comes from the `sound-player` branch's `ArModule.vue`, the
first scene built and verified against this convention.

<!-- /project-specific -->

## 2. Entities & attributes

Best-effort — from this project's own usage plus reading the vendored
source (`node_modules/@8thwall/xrextras/dist/xrextras.js`), not authoritative
upstream documentation, since this is vendored code this project doesn't
own (see [3](#3-under-the-hood)).

### `xrextras-named-image-target`

| Attribute | Type | Meaning |
|---|---|---|
| `name` | string | Must exactly match the `name` field inside your target's own JSON file. This is how the engine knows which detected target this wrapper cares about — a scene can have several `xrextras-named-image-target` blocks, one per registered target, each keyed by its own name. |

Its children are shown/hidden and positioned to track the detected target
automatically — you don't drive their position yourself.

### `world-origin` (ours)

No attributes. Sets its entity's position/rotation/scale to the inverse of
its parents' world transform (re-checked every tick, written only when the
parents moved), so the entity sits exactly at the scene's world origin —
whatever offset the host or a preview applies above the module. Wrap each
`xrextras-named-image-target` in one. Because it computes the offset
instead of hard-coding it, it stays correct if the host ever stops applying
it, and with `npm run dev`'s different module root.

### `xrextras-play-video`

| Attribute | Type | Meaning |
|---|---|---|
| `video` | selector | The `<video>` asset to play — reference a manifest asset by id, same as `gltf-model`. |
| `thumb` | selector | Poster-frame image shown before playback starts. |
| `canstop` | boolean (presence) | If present, tapping the video while it's already playing stops it (not just pauses) — a second tap restarts from the beginning. |

```html
<xrextras-named-image-target name="video-target">
  <a-entity
      xrextras-play-video="video: #image-tracking-demo-video; thumb: #image-tracking-poster; canstop: true"
      geometry="primitive: plane; height: 1; width: 0.79;">
  </a-entity>
</xrextras-named-image-target>
```

Both ids are ordinary manifest assets, so both files must be in `src/assets/`:
`image-tracking-poster.jpg` becomes `#image-tracking-poster`. The files in
`src/image-targets/` are not injected as assets and have no ids of their own.

## 3. Under the hood

### The compiled target descriptor

For your own target, the `.json` and its images are 8th Wall's image-target
compiler tool output, not something authored by hand. The demo target is
generated by `scripts/generate-demo-assets.ts` in the same format. The shape (`imagePath`, `resources.{originalImage,
croppedImage, thumbnailImage, luminanceImage}`, `name`, `type: "PLANAR"`,
`properties.{top, left, width, height, isRotated, originalWidth,
originalHeight}`, `created`/`updated`) was cross-checked against 8th Wall's
own official `studio-image-targets-example` reference project (a different
target image, same tool) and matches field-for-field. That reference
project's own exports also include two fields ours doesn't —
`geometryImage` and `loadAutomatically` — both apparently optional/newer;
their absence here doesn't stop this target from loading or working. If a
future export from the tool includes them, there's nothing to change on
this project's side — they just ride along as extra JSON fields.

### `src/image-targets/` — separate from `src/assets/`, same shape of plumbing

Distinct from `src/assets/` (used for manifest `assets`), but handled by
near-identical Vite plugin logic: scanned non-recursively, served at
`/image-targets/*` in dev, copied into `dist-platform/image-targets/` on
build. Registering a target's `.json` in `manifest.ts`'s `imageTargets`
array is what actually activates it — the image *files* ship in every
build either way (same as any unregistered example asset in `src/assets/`),
but nothing configures XR8 to look for a target unless its JSON is in that
array.

### How a target actually reaches the camera engine — and why `npm run dev` can't test this

`manifest.imageTargets` is fed to `XR8.XrController.configure({
imageTargetData })` (`lib/host-runtime.ts`'s `configureImageTargets`) —
which is a **no-op without XR8 present** (`if (!xr?.XrController?.configure
...) return`). The plain VR/desktop preview (`npm run dev`, `lib/preview.ts`)
never loads XR8 or calls this at all — there's no live camera feed for it
to detect anything in regardless. Only the real AR preview (`npm run dev:ar`,
`lib/preview-ar.ts`) and the real production host actually run XR8's image
detection. This means correctly-wired image-tracking content will show
literally nothing in `npm run dev` — not a bug, just the wrong preview for
this feature. Always verify on `npm run dev:ar` (or a real device build).

One extra wrinkle specific to the AR preview harness, not something a
project needs to replicate: `lib/preview-ar.ts` configures image targets
*twice* — once immediately once XR8 boots (`XR8.XrController.configure({
imageTargetData: manifest.imageTargets })`, **before** `<a-scene xrweb>`
starts its session), and again inside `mount()` via the same
`configureImageTargets` the real host's flow uses. The first call exists
only because XR8 rejects image targets passed after a session has already
started ("Image Targets are not supported in the current session") — image
targets are a session capability that must be present in the *first*
`configure()` call. The host doesn't do this: it calls
`XR8.XrController.configure({})` at startup and passes `imageTargetData`
only when a module mounts (`ArScene.vue`/`ArModule.vue` at `0651352`) — and
image tracking works there (the exported example modules track live). So
the restriction was hit with the preview's setup (8frame 1.5.0) and
apparently doesn't apply to the host's (1.3.0); either way it isn't part of
what this guide's step-by-step asks you to set up.

### Required runtime setup — get this wrong and it fails silently or crashes

Three things outside `manifest.ts`/the scene markup have to be correct
for any of the above to actually run:

1. **The 8Frame build must be the one that pairs with
   `@8thwall/engine-binary`, not the one on `cdn.8thwall.com`.** They can
   share a filename (`8frame-1.5.0.min.js`) while being completely
   different, incompatible binaries (375KB CDN vs. 1.4MB vendored —
   confirmed by diffing them byte-for-byte). The mismatched pair throws
   `Error: No valid session manager to handle this session` as soon as
   the AR session tries to start, with camera permission never even
   requested. There's no npm package for the correct build — it ships
   only in the `external/scripts/` folder of 8th Wall's own example
   projects (e.g. `github.com/8thwall/aframe-world-effects-example`,
   `aframe-image-targets-example`, distributed via git LFS). This
   template vendors it at `lib/vendor/8frame-1.5.0.min.js` and copies it
   into `external/scripts/` at build time (see `vite.config.ts`,
   `ar.html`) instead of pinning it via `package.json`.

2. **`xrweb` needs `allowedDevices: any` and must not set
   `disableWorldTracking: true`** (omitting it entirely, as this
   template's `lib/preview-ar.ts` now does, is the correct default —
   `disableWorldTracking: true` is what 8th Wall's own
   `aframe-image-targets-example` uses, but it disables the very SLAM
   pipeline module image tracking depends on when combined with this
   engine binary; confirmed by testing both). Get this wrong and the
   symptom is silent, not an error: `XR8.XrController.configure()`
   accepts the image target data without complaint, the camera feed
   shows up fine (a plain `getusermedia` fallback session starts
   successfully), but the "reality" pipeline module that would actually
   load the target image and fire `xrimagescanning`/`xrimagefound` never
   starts — nothing ever loads, nothing ever tracks, and there is no
   error anywhere to point at why.

3. **Cancel the module-root offset with `world-origin`.** The host
   mounts every module inside an entity at `0 1.6 -3`
   (`AR_MODULE_POSITION`), image-target modules included, and
   `xrextras-named-image-target` sets its own *local* pose from the tracked
   image — so that offset moves the content off the image. Live debugging
   on an-alle.net (02.09.2026) found exactly this shift, and the project
   branches compensated with a fixed `<a-entity position="0 -1.6 3">`.
   `world-origin` does the same without hard-coding the value. `npm run
   dev:ar` applies the host's offset to every module (it used to skip it
   for image-target modules, which made a missing compensation invisible
   until export). Checked headless in `dev:ar` with the `video-target`
   example and a test box: with `world-origin` the box sits on the image
   both with the host's offset and with none; without it the box is off
   the image. Full background, history and the branches still using a
   fixed counter-offset:
   [SCENE-PLACEMENT-GUIDE.md](../cross-feature-reference-docs/SCENE-PLACEMENT-GUIDE.md).
   Don't wrap the target in any *other* offset entity —
   8th Wall's own examples nest `xrextras-named-image-target` directly
   under `<a-scene>`; see
   [1a](#1a-the-footprint-convention-the-image-is-the-floor) for how
   content should be positioned instead.

Re-verify image tracking on a real device after any
8Frame/engine-binary/xrweb config change — each of the three points above
breaks it silently.

<!-- project-specific -->
#### Project context: `sound-player`

##### Verified end-to-end on a real device (2026-08-30)

The three runtime-setup points above were found on the `sound-player`
branch, during the first real on-device end-to-end verification of this
feature. Point-camera-at-target → content tracks and is tappable,
confirmed on iPad. It was **not** working before those three fixes — the
earlier assumption that this was a pre-existing, working baseline feature
was wrong; it had never been tested end-to-end on-device against the
current `@8thwall/engine-binary` dependency.

<!-- /project-specific -->

## 4. Incompatibilities, risks & troubleshooting

### xrextras-play-video vs. Video's video-control

[`video-control`](VIDEO-FEATURE-GUIDE.md) starts/pauses a video on events;
`xrextras-play-video` starts its own on target found and toggles on click.
Don't put both on the same video element.

### `world-origin` is a transform writer

It sets its own entity's position/rotation/scale. Don't put
`place-in-front`, `gesture-control`, `attach-to` or another transform
writer on the same entity, and don't nest the image target inside a placed
group (`place-in-front`'s `scene-root` in the start scene) — keep the
`world-origin` wrapper a sibling of it, directly under the module root.

### Don't place image-anchored content with Placement

[`place-in-front`](PLACEMENT-FEATURE-GUIDE.md) moves its entity to the floor
in front of the camera — inside an image target it would fight the tracked
pose. Use it only for content that isn't anchored to an image.

### Uses the host's shared cursor/raycaster `click`, not this template's own tap systems

`xrextras-play-video` (confirmed by reading the vendored source) tags
itself `class="cantap"` and listens for a plain `click` — i.e. it relies on
**A-Frame's own cursor/raycaster system**, configured by the host on the
shared `<a-camera>` to hit `.cantap` elements, not on
[`ar-button`](SOUND-FEATURE-GUIDE.md)/[`sound-button`](SOUND-FEATURE-GUIDE.md)'s
own `pointerdown`/`pointerup` handling or
[`mirror-shard`](MIRROR-SHARD-FEATURE-GUIDE.md)'s (which uses the same
`.cantap`/`click` mechanism, for the same reason).

### Real, previously-identified iOS click-suppression risk

iOS Safari has been observed to suppress the synthetic `click` A-Frame's
cursor system produces, once anything upstream in the same touch sequence
(e.g. `xrextras-gesture-detector`, used elsewhere for pinch/rotate) already
called `preventDefault()` — the exact reason
[Sound](SOUND-FEATURE-GUIDE.md)'s own tap system deliberately avoids
`click` in favour of raw `pointerdown`/`pointerup`. This hasn't been
independently re-verified against the pinned `xrextras` version (it's
vendored code this project doesn't own) — if a project combines a tappable
`xrextras-play-video` with pinch/rotate gestures, test tapping the video
specifically on iPad/iPhone before shipping.

### Potential double-fire with Sound if trigger zones visually overlap

No direct code conflict — `xrextras-play-video`'s `click`-based tap and
[Sound](SOUND-FEATURE-GUIDE.md)'s `pointerdown`/`pointerup`-based tap are
independent and don't call `preventDefault()`/`stopPropagation()` on each
other. But they observe the same physical touches: if a sound button's
trigger zone visually overlaps a tappable image-target video in screen
space, one tap could satisfy both systems and fire **both** — play a sound
*and* toggle the video — in the same gesture. Keep interactive zones
visually separated, or gate one (`enabled: false` on an `ar-button`) while
the other is relevant.

### No interaction found with `proximity-fade`/`proximity-fade-dither`/`proximity-cutout`

All three only patch materials reached via a bubbled `model-loaded` event
from a `gltf-model` descendant. The image-target's video plane is a plain
`<a-entity geometry="primitive: plane">` with a video texture — never a
`gltf-model` — so it never fires `model-loaded` and is never touched by any
of the three regardless of scene nesting.

### No interaction found with any other feature on this branch

No shared `document` listeners with anything except the click-suppression
risk above (which is about the *host's* shared cursor system, not a
listener this project's own code owns), no `renderOrder`, no
`onBeforeCompile` use. Free to combine with `random-field`, `lod-object`/
`lod-manager`, `render-order`, `wander-in-band`/`proximity-wave`, and
`mirror-shard`/`liquid-texture` with no interaction beyond the shared-tap
risks already noted above.

### Debugging playbook, in the order that actually narrows things down

Built up bisecting the "camera works but nothing tracks" failure this
guide's runtime-setup section above now covers. Each step rules out one
layer; don't skip ahead — a green light at step *N* doesn't mean steps
below it are fine.

1. **`XR8.XrController.configure.bind(...)` doesn't throw** → the engine
   (and its "slam" chunk specifically) loaded. If this throws, it's the
   8Frame/engine-binary pairing (point 1 above).
2. **A camera feed shows up, no console exception** → *some* session
   started, but tells you nothing about which one — a plain
   `getusermedia` fallback with zero tracking capability looks identical
   from the camera view alone.
3. **Wrap `XR8.addCameraPipelineModule`** and confirm a module named
   `"reality"` gets added, then wrap *its* `onStart` — if `onStart` never
   fires, the SLAM pipeline never actually started (point 2 above,
   `allowedDevices`/`disableWorldTracking`) even though nothing threw.
4. **Don't listen for `xrimagefound`/`xrimagescanning`/etc. on `window`.**
   The A-Frame integration dispatches these as events on the **`<a-scene>`
   element** (`sceneEl.emit(...)`), not on `window` — despite most 8th
   Wall vanilla-JS docs/examples showing `window.addEventListener(...)`.
   `window.addEventListener` listeners here will silently never fire even
   when tracking is working perfectly. Patch
   `EventTarget.prototype.dispatchEvent` directly (catches every target)
   if unsure where an event lands.
5. **`xrimagescanning` firing (with your target's name in `imageTargets`)
   confirms detection is actively running.** `xrimageupdated` firing
   continuously afterward confirms the target is currently found and
   tracked — position/rotation/scale updating each frame. If you get this
   far, tracking itself is not the problem; anything still wrong is
   rendering/positioning (steps 6–7).
6. **A test box with zero position offset, direct child of
   `xrextras-named-image-target`** (itself inside `world-origin`) (`<a-box color="red" scale="0.3 0.3 0.3"
   position="0 0 0.1"></a-box>`) renders exactly on the target → rendering
   and anchoring both work; any other content not appearing is a
   positioning bug in *that* content, not the tracking pipeline. This is
   the fastest way to separate "tracking is broken" from "tracking works,
   my layout is wrong" — don't debug the pipeline further once this
   renders correctly.
7. **Still nothing where you expect it, but the test box in step 6 works?**
   Check the [footprint convention](#1a-the-footprint-convention-the-image-is-the-floor)
   and the `world-origin` wrapper (point 3 above) — by far the most common
   causes once the pipeline itself is confirmed working. A test box that
   shows up offset by roughly `0 1.6 -3` (often off-screen) means the
   wrapper is missing or something else sits between it and the target.

Two dead ends, noted so nobody re-walks them: the eruda mobile-console
Network tab reliably misses files loaded via dynamic `import()` (the
engine's own chunk-loading mechanism) — its absence there is not evidence
a chunk failed to load, only that this particular panel can't see how it
loaded. And a single-point-in-time visibility check
(`entity.object3D.visible`) can catch the target mid-lost/re-found cycle
and read `false` even though tracking is working fine seconds later —
poll over a few seconds, don't trust one snapshot.
