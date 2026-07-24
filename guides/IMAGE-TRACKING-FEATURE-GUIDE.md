# Image tracking feature guide

Anchors content to a specific real-world printed/displayed image — detects
a target image in the live camera feed and shows/hides/positions content
to track it, entirely via 8th Wall's own image-target engine. This was
`main`'s own baseline demo content (not ported from a `_module` branch —
see [3. Under the hood](#3-under-the-hood)), previously wired directly into
`ArModule.vue`; moved here to keep the baseline scene free of example
content, matching how every other feature in this template works.

Unlike every other guide in this catalog, this feature has **no
`src/a-frame-components/*.ts` file to copy** — the two components involved
(`xrextras-named-image-target`, `xrextras-play-video`) are provided by the
8th Wall `xrextras` library itself, already loaded in every preview flavour
and by the real host. What's project-specific is the target image data and
the content you anchor to it — see [1](#1-step-by-step-adding-this-to-a-new-project).

Files:

```
src/image-targets/video-target.json          # example target descriptor
src/image-targets/video-target_original.jpg   # \
src/image-targets/video-target_cropped.jpg     #  the 4 images the descriptor
src/image-targets/video-target_thumbnail.jpg   #  references, all from the
src/image-targets/video-target_luminance.jpg  # /  same compiler-tool export
examples/image-tracking-usage.html   # scene wiring + full attribute reference
```

**Assets:** [`jellyfish-video.mp4`](../src/assets/jellyfish-video.mp4) — the
example's video content, played once the target is detected.

**Not active by default** — `src/manifest.ts` doesn't currently register
any `imageTargets`. This template still ships the example target's files
(so there's a ready-to-test target and a worked example to copy from), but
adding it back to `manifest.ts` is an explicit step — see [1](#1-step-by-step-adding-this-to-a-new-project).

## 1. Step-by-step: adding this to a new project

1. **Get a target image descriptor.** This template already ships one
   (`src/image-targets/video-target.*`) — usable as-is for testing, or as a
   reference for the file shapes below. For your **own** target image,
   run it through 8th Wall's image-target compiler tool (part of the 8th
   Wall workspace/console — this project doesn't bundle that tool, only its
   output format) and download the resulting bundle: one `<name>.json`
   descriptor plus 4 images (`_original`, `_cropped`, `_thumbnail`,
   `_luminance`). Drop all 5 files into `src/image-targets/` — this folder
   is scanned and copied into every build automatically (see
   [3](#3-under-the-hood)), no manifest entry needed for the files
   themselves.

2. **Register the target's JSON** in your project's `src/manifest.ts`:

   ```ts
   import videoTarget from "./image-targets/video-target.json";
   // (name it after your own target file instead)

   export const manifest: Manifest = {
     assets: assetManifest.assets,
     components: { /* ...whatever you already have... */ },
     imageTargets: [videoTarget]
     // multiple targets: imageTargets: [videoTarget, anotherTarget]
   };
   ```

3. **Drop in whatever content should be anchored to the target** — e.g. the
   video asset this example uses (`src/assets/jellyfish-video.mp4`, or your
   own `.mp4`/`.glb`/image) — into `src/assets/` as usual.

4. **Wire it into the scene** — see
   [2. Entities & attributes](#2-entities--attributes) or copy directly
   from `examples/image-tracking-usage.html`.

5. **Build and test with `npm run dev:ar`, not `npm run dev`.** This is
   not optional — see [3](#3-under-the-hood) for why the plain VR/desktop
   preview can never show this working, no matter how correctly it's
   wired. Point your phone's camera at the target image (or its
   `_original`/`_cropped` file, displayed on another screen) to test
   detection.

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

### `xrextras-play-video`

| Attribute | Type | Meaning |
|---|---|---|
| `video` | selector | The `<video>` asset to play — reference a manifest asset by id, same as `gltf-model`. |
| `thumb` | selector | Poster-frame image shown before playback starts. |
| `canstop` | boolean (presence) | If present, tapping the video while it's already playing stops it (not just pauses) — a second tap restarts from the beginning. |

```html
<xrextras-named-image-target name="video-target">
  <a-entity
      xrextras-play-video="video: #jellyfish-video; thumb: #video-target; canstop: true"
      geometry="primitive: plane; height: 1; width: 0.79;">
  </a-entity>
</xrextras-named-image-target>
```

`#video-target` as the `thumb` selector works because every manifest asset
*and* every image-target's own image files are auto-injected with the same
filename-without-extension-is-the-id convention — `video-target_thumbnail.jpg`
becomes id `video-target` alongside the target's other files.

## 3. Under the hood

### The compiled target descriptor

`video-target.json` is 8th Wall's own image-target compiler tool output —
not something authored by hand. Its shape (`imagePath`, `resources.{originalImage,
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
`configure()` call. The real host's own bootstrapping presumably already
handles this itself; it isn't part of what this guide's step-by-step asks
you to set up.

### Not verified end-to-end on a real device in this session

Everything above the camera-detection boundary was verified directly: the
target JSON's schema, the manifest wiring, `configureImageTargets`'s
no-op-without-XR8 behaviour, and both vendored components' existence and
`.cantap`/`click` tap mechanism in the actual `xrextras.js` source (see
[4](#4-incompatibilities-risks--troubleshooting)). Actual on-device
detection — does pointing a phone camera at the target image genuinely
trigger the video — was **not** re-tested in this session (no device
available); this was already a pre-existing, working baseline feature
before this guide was written, not new code, so this is a lower-risk gap
than it would be for freshly-written detection logic. Verify on a real
device before relying on this if it's been a while since anyone tested it.

## 4. Incompatibilities, risks & troubleshooting

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
