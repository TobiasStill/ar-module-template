# Feature catalog

A quick-lookup index of every feature universalized into this branch: what
it does, which components implement it, and which assets it uses. Kept
up to date as part of the workflow in `ADDING-FEATURES-WORKFLOW.md` (step
10) — every new feature gets an entry here when its guide is written.

For the full story on any one feature (setup steps, attribute reference,
internals, known risks), follow the link in its **Guide** column to the
matching `<FEATURE>-FEATURE-GUIDE.md`. This document is intentionally just
the index — descriptions here are one line on purpose.

## Index

Each feature carries one or more **tags** (see the full
[Tags](#tags) list at the end of this document, which each one links to) —
the table's row order is also driven by those tags, clustering related
features together; see `ADDING-FEATURES-WORKFLOW.md` (step 10) for that
convention.

| Feature | What it does | Tags | Source branch | Guide |
|---|---|---|---|---|
| [Sound](#sound) | Tap a 3D button to play/pause/stop a sound; optional 2D GUI panel and ambient-audio unlock overlay | [`sound`](#tag-sound), [`interaction`](#tag-interaction) | `Jakob_module` | [SOUND-FEATURE-GUIDE.md](guides/SOUND-FEATURE-GUIDE.md) |
| [AR Overlay](#ar-overlay) | 2D UI over the camera image: hint/Start/Play controls and a recenter button, waits for placement | [`ui`](#tag-ui), [`interaction`](#tag-interaction) | `augmented-bahnhofsviertel` | [AR-OVERLAY-FEATURE-GUIDE.md](guides/AR-OVERLAY-FEATURE-GUIDE.md) |
| [Placement & Recenter](#placement--recenter) | Places a scene on the floor in front of the viewer, re-places it on recenter/tap; tap-to-place ground cursor | [`placement`](#tag-placement), [`interaction`](#tag-interaction) | `augmented-bahnhofsviertel` | [PLACEMENT-FEATURE-GUIDE.md](guides/PLACEMENT-FEATURE-GUIDE.md) |
| [Gestures](#gestures) | Hold-and-drag along the ground, rotate, pinch to scale — in one attribute | [`interaction`](#tag-interaction), [`placement`](#tag-placement) | `augmented-bahnhofsviertel` | [GESTURES-FEATURE-GUIDE.md](guides/GESTURES-FEATURE-GUIDE.md) |
| [Image Tracking](#image-tracking) | Anchors content to a detected real-world image, via 8th Wall's own image-target engine | [`image-tracking`](#tag-image-tracking), [`interaction`](#tag-interaction) | `main` | [IMAGE-TRACKING-FEATURE-GUIDE.md](guides/IMAGE-TRACKING-FEATURE-GUIDE.md) |
| [Video](#video) | Starts/pauses/unmutes video assets from one tap event, pauses in the background | [`video`](#tag-video), [`interaction`](#tag-interaction) | `augmented-bahnhofsviertel` | [VIDEO-FEATURE-GUIDE.md](guides/VIDEO-FEATURE-GUIDE.md) |
| [Tap Animation](#tap-animation) | Tap a model to play its glTF animation (once or every tap) plus its sound | [`animation`](#tag-animation), [`interaction`](#tag-interaction) | `augmented-bahnhofsviertel` | [TAP-ANIMATION-FEATURE-GUIDE.md](guides/TAP-ANIMATION-FEATURE-GUIDE.md) |
| [Proximity Fade](#proximity-fade) | Fades a model's opacity in/out by camera distance to a target point | [`proximity`](#tag-proximity), [`transparency`](#tag-transparency) | `Madleen_module` | [PROXIMITY-FADE-FEATURE-GUIDE.md](guides/PROXIMITY-FADE-FEATURE-GUIDE.md) |
| [Proximity Cutout](#proximity-cutout) | Dithers away a hole in a model centred on the camera as it approaches | [`proximity`](#tag-proximity), [`dither`](#tag-dither), [`transparency`](#tag-transparency) | `Madleen_module` | [PROXIMITY-CUTOUT-FEATURE-GUIDE.md](guides/PROXIMITY-CUTOUT-FEATURE-GUIDE.md) |
| [Proximity Wave](#proximity-wave) | Proximity-triggered wave + idle motion, single entity or a whole group | [`proximity`](#tag-proximity), [`motion`](#tag-motion) | `Gyumin_module` | [PROXIMITY-WAVE-FEATURE-GUIDE.md](guides/PROXIMITY-WAVE-FEATURE-GUIDE.md) |
| [Wander In Band](#wander-in-band) | Orbits an entity within a band around a center entity | [`motion`](#tag-motion), [`random`](#tag-random) | `Fanyu_module` | [WANDER-IN-BAND-FEATURE-GUIDE.md](guides/WANDER-IN-BAND-FEATURE-GUIDE.md) |
| [Follow Node](#follow-node) | Tracks a named node inside another entity's animated glTF | [`motion`](#tag-motion), [`utility`](#tag-utility) | `Fanyu_module` | [FOLLOW-NODE-FEATURE-GUIDE.md](guides/FOLLOW-NODE-FEATURE-GUIDE.md) |
| [Trim Loop Clip](#trim-loop-clip) | Trims a glTF animation's dead lead-in and loops it, syncing multiple clips; optional loop crossfade | [`animation`](#tag-animation), [`utility`](#tag-utility) | `Fanyu_module` | [TRIM-LOOP-CLIP-FEATURE-GUIDE.md](guides/TRIM-LOOP-CLIP-FEATURE-GUIDE.md) |
| [Attach To](#attach-to) | Makes an entity follow another entity's world position every frame (offset in world or parent space) | [`motion`](#tag-motion), [`utility`](#tag-utility) | `Gyumin_module` | [ATTACH-TO-FEATURE-GUIDE.md](guides/ATTACH-TO-FEATURE-GUIDE.md) |
| [Ground Decal](#ground-decal) | Pins a decal flat on the ground under a (possibly tilted) parent, excluded from fog | [`utility`](#tag-utility), [`visual-effect`](#tag-visual-effect) | `Gyumin_module` | [GROUND-DECAL-FEATURE-GUIDE.md](guides/GROUND-DECAL-FEATURE-GUIDE.md) |
| [Random Field](#random-field) | Scatters clones of referenced entities across an area, spacing/copies configurable | [`random`](#tag-random), [`distribution`](#tag-distribution) | `Gyumin_module` | [RANDOM-FIELD-FEATURE-GUIDE.md](guides/RANDOM-FIELD-FEATURE-GUIDE.md) |
| [Spawn Sequence](#spawn-sequence) | Models spring up one after another (interval or timeline), in front of the viewer or at random spots, optional sound each | [`distribution`](#tag-distribution), [`random`](#tag-random), [`animation`](#tag-animation) | `augmented-bahnhofsviertel` | [SPAWN-SEQUENCE-FEATURE-GUIDE.md](guides/SPAWN-SEQUENCE-FEATURE-GUIDE.md) |
| [LOD + Billboard](#lod--billboard) | Cross-fades a detailed model into a flat camera-facing billboard by distance | [`LOD`](#tag-lod), [`render-order`](#tag-render-order), [`transparency`](#tag-transparency) | `Gyumin_module` | [LOD-BILLBOARD-FEATURE-GUIDE.md](guides/LOD-BILLBOARD-FEATURE-GUIDE.md) |
| [Portal](#portal) | Walk-through door into another world, masked by hider walls, with an opening animation | [`render-order`](#tag-render-order), [`visual-effect`](#tag-visual-effect) | `augmented-bahnhofsviertel` | [PORTAL-FEATURE-GUIDE.md](guides/PORTAL-FEATURE-GUIDE.md) |
| [Render Order](#render-order) | Sets per-mesh draw order for overlapping transparent surfaces | [`render-order`](#tag-render-order), [`transparency`](#tag-transparency) | `Gyumin_module` | [RENDER-ORDER-FEATURE-GUIDE.md](guides/RENDER-ORDER-FEATURE-GUIDE.md) |
| [Mesh Render Order](#mesh-render-order) | Sets per-NAMED-submesh draw order within a single glTF asset | [`render-order`](#tag-render-order), [`transparency`](#tag-transparency) | `Rosa_module` | [MESH-RENDER-ORDER-FEATURE-GUIDE.md](guides/MESH-RENDER-ORDER-FEATURE-GUIDE.md) |
| [Light & Reflections](#light--reflections) | Live camera reflections, static cube-map reflections, lights following the real brightness | [`lighting`](#tag-lighting), [`material-properties`](#tag-material-properties) | `augmented-bahnhofsviertel` | [LIGHT-REFLECTIONS-FEATURE-GUIDE.md](guides/LIGHT-REFLECTIONS-FEATURE-GUIDE.md) |
| [Material Properties](#material-properties) | Manually tunes roughness/metalness/opacity/emissive on a loaded model | [`material-properties`](#tag-material-properties) | `Gyumin_module` | [MATERIAL-PROPERTIES-FEATURE-GUIDE.md](guides/MATERIAL-PROPERTIES-FEATURE-GUIDE.md) |
| [Dither Material](#dither-material) | Manual (non-distance-driven) dithered transparency for a loaded model | [`dither`](#tag-dither), [`transparency`](#tag-transparency), [`material-properties`](#tag-material-properties) | `Fanyu_module` | [DITHER-MATERIAL-FEATURE-GUIDE.md](guides/DITHER-MATERIAL-FEATURE-GUIDE.md) |
| [Grain Shimmer](#grain-shimmer) | A grainy surface that sparkles with movement: textures without mipmaps, optional shader grain | [`visual-effect`](#tag-visual-effect), [`procedural`](#tag-procedural), [`material-properties`](#tag-material-properties) | `augmented-bahnhofsviertel` (#20 analysis, original) | [GRAIN-SHIMMER-FEATURE-GUIDE.md](guides/GRAIN-SHIMMER-FEATURE-GUIDE.md) |
| [Mirror Shard](#mirror-shard) | A field of 112 glass shards that ripple outward when tapped | [`visual-effect`](#tag-visual-effect), [`interaction`](#tag-interaction), [`procedural`](#tag-procedural) | `Zhichang_module` | [MIRROR-SHARD-FEATURE-GUIDE.md](guides/MIRROR-SHARD-FEATURE-GUIDE.md) |
| [Liquid Texture](#liquid-texture) | Generic procedural "liquid ink" texture, optionally reveals a target image | [`procedural`](#tag-procedural), [`visual-effect`](#tag-visual-effect) | `Zhichang_module` | [LIQUID-TEXTURE-FEATURE-GUIDE.md](guides/LIQUID-TEXTURE-FEATURE-GUIDE.md) |

Asset links below lead to `examples/assets/` and `examples/image-targets/`:
generated demo files that only reach a module when you copy them into
`src/assets/` or `src/image-targets/`.

Not covered here: [Template infrastructure](#template-infrastructure)
below — not a pick-and-choose feature, its own category instead.

**Cross-feature reference docs** — not tied to one feature, so not listed
above: [RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md](cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md)
(how draw order and material patching interact across Render Order,
Mesh Render Order, LOD + Billboard, Material Properties, Dither Material,
Proximity Fade, and Proximity Cutout — read before combining any of those)
and [ASSET-COMPRESSION-GUIDE.md](cross-feature-reference-docs/ASSET-COMPRESSION-GUIDE.md)
(mesh/texture compression tooling and the MeshOpt decoder patch above —
read before compressing anything in `src/assets/`),
[SCENE-PLACEMENT-GUIDE.md](cross-feature-reference-docs/SCENE-PLACEMENT-GUIDE.md)
(where content ends up: the host's camera and module root, 8th Wall's floor
and units, `place-in-front` and `world-origin` — read before positioning
anything), [BUILD-AND-EXPORT-GUIDE.md](cross-feature-reference-docs/BUILD-AND-EXPORT-GUIDE.md)
(the four builds, what the host does with a module, uploading and
registering it) and [HEADLESS-AR-TESTING-GUIDE.md](cross-feature-reference-docs/HEADLESS-AR-TESTING-GUIDE.md)
(checking `dev:ar` without a phone). Introductions to the tools
themselves, matched to what this project uses:
[ARCHITECTURE-GUIDE.md](cross-feature-reference-docs/ARCHITECTURE-GUIDE.md)
(layers, formats, languages, conventions),
[AFRAME-INTRODUCTION.md](cross-feature-reference-docs/AFRAME-INTRODUCTION.md),
[8THWALL-INTRODUCTION.md](cross-feature-reference-docs/8THWALL-INTRODUCTION.md),
[VUE-INTRODUCTION.md](cross-feature-reference-docs/VUE-INTRODUCTION.md) and
[WRITING-A-COMPONENT-GUIDE.md](cross-feature-reference-docs/WRITING-A-COMPONENT-GUIDE.md).

## Shared building blocks

Components not owned by any one feature — generic/reusable by design, kept
unprefixed per the naming convention in `src/manifest.ts`. Listed once
here rather than repeated under every feature that uses them.

| Component | File | What it does | Introduced by | Used by |
|---|---|---|---|---|
| `no-frustum-cull` | [`src/a-frame-components/no-frustum-cull.ts`](src/a-frame-components/no-frustum-cull.ts) | Keeps an animated glTF mesh from being frustum-culled once it moves outside its bind-pose bounding sphere | `main` template baseline | Template baseline (`main`); any feature with animated models |
| `ar-button` | [`src/a-frame-components/ar-button.ts`](src/a-frame-components/ar-button.ts) | Declares an entity as a tappable/gazable button with a bounding-box trigger zone, gaze pulse, and optional distance fade | Written fresh while porting [Sound](#sound) from `Jakob_module` — generalized out of that source's tap/gaze code, not copied verbatim | [Sound](#sound) |
| `ar-button-manager` | [`src/a-frame-components/ar-button-manager.ts`](src/a-frame-components/ar-button-manager.ts) | One per module; owns the gaze raycast and tap routing for every `ar-button` | Same as `ar-button` | [Sound](#sound) |
| `world-origin` | [`src/a-frame-components/world-origin.ts`](src/a-frame-components/world-origin.ts) | Puts its entity at the scene's world origin by inverting its parents' transform — cancels the host's `0 1.6 -3` module-root offset for content whose pose 8th Wall writes directly | Written for [Image Tracking](#image-tracking), replacing the fixed `0 -1.6 3` counter-offset of `animationssystem-wanderer`/`material-shader-showcase`/`zufallsverteilung-lod` | [Image Tracking](#image-tracking) |
| `unlit-material` | [`src/a-frame-components/unlit-material.ts`](src/a-frame-components/unlit-material.ts) | Replaces a loaded model's PBR materials with flat, fully-lit MeshBasicMaterials — typically the LOD billboard's flat/shadeless look, but also usable standalone on a full model (`examples/unlit-material-usage.html`) | Written while porting [LOD + Billboard](#lod--billboard) from `Gyumin_module`; extended (`alphaTest`, `keepShadowBehavior` attributes) while comparing against `Rosa_module`'s own, separate `unlit-materials` component — confirmed this shared one already covers that use case once extended, so no duplicate was created | [LOD + Billboard](#lod--billboard); usable standalone by any feature |

## Template infrastructure

Not pick-and-choose features and not A-Frame components — baseline
plumbing built directly into `ArModule.vue`/`src/`, present whether or not
your scene uses any feature above. Listed here (rather than under "Shared
building blocks", which is specifically components registered via
`manifest.ts`) so they're not missed by anyone scanning this catalog.

| Item | File(s) | What it does |
|---|---|---|
| Loading bar + spinner | [`src/asset-loading-overlay.ts`](src/asset-loading-overlay.ts) + the `<script>`/`<template>` blocks at the top/bottom of [`src/ArModule.vue`](src/ArModule.vue) | A thin top-of-screen progress bar and a centre-screen spinner, shown while this module's manifest assets are still loading; the 3D content stays hidden (`:visible="assetsLoaded"`) until everything's ready, then appears all at once instead of popping in piecemeal. Part of the template baseline because practically every module needs it. Deliberately **not** an A-Frame component — 2D screen-space UI that has to exist and be visible *before* any 3D entity is ready, driven by Vue's `onMounted`/`onUnmounted` rather than any entity's lifecycle (see the comment at the top of `ArModule.vue`'s `<script>` block for the full reasoning). Works automatically for whatever assets your scene adds — nothing to copy in, nothing to register in `manifest.ts`. Also mentioned in [QUICK_START_GUIDE.md](QUICK_START_GUIDE.md). |
| Automatic component registration | [`scripts/used-components.ts`](scripts/used-components.ts) + `autoComponents()` in [`vite.config.ts`](vite.config.ts) → `virtual:used-components`, spread into `components` in [`src/manifest.ts`](src/manifest.ts) | Every file in `src/a-frame-components/` with a default export is a component named after its file; exactly the ones the module uses (by name in `ArModule.vue` and the files it imports, plus transitively) are bundled and registered — in `dev`, `dev:ar` (live-updated) and `build`. Nothing to list in `manifest.ts` when copying a feature in; unused components neither ship nor claim names in the shared host scene. See README "Components register automatically". |
| Demo asset generator | [`scripts/generate-demo-assets.ts`](scripts/generate-demo-assets.ts) | Generates everything in `examples/assets/` and `examples/image-targets/`, plus `shards.json`, from code, so the template carries no third-party material |
| MeshOpt decoder patch | [`lib/gltf-meshopt-setup.ts`](lib/gltf-meshopt-setup.ts) + vendored [`lib/vendor/meshopt_decoder.module.js`](lib/vendor/meshopt_decoder.module.js), called once from [`src/manifest.ts`](src/manifest.ts) | Patches every `THREE.GLTFLoader` instance so `gltfpack -c`-compressed `.glb` files (produced by [`scripts/compress-assets.ts`](scripts/compress-assets.ts), `npm run compress-assets`) actually load — A-Frame/8th Wall never wire this up themselves, so without it a meshopt-compressed asset fails to load at all. Idempotent, near-zero cost even if a project never compresses anything. Full picture, including the compression tool itself and real pitfalls of producing compressed assets, in [ASSET-COMPRESSION-GUIDE.md](cross-feature-reference-docs/ASSET-COMPRESSION-GUIDE.md). |

<!-- project-specific -->
### Project context: origin

The loading bar + spinner was found identically re-implemented across
every `_module` branch, so it was brought into the template baseline
itself.

<!-- /project-specific -->

## Sound

Guide: [SOUND-FEATURE-GUIDE.md](guides/SOUND-FEATURE-GUIDE.md) · Source: `Jakob_module`

Tap a 3D button to play/pause/stop a sound (only one plays module-wide at
a time), with an optional 2D screen-space GUI panel (restart/stop/
play-pause) that mirrors the same state. Built on the generic `ar-button`
system above rather than its own raycast/tap code. Also includes an
optional, decoupled "tap to enable sound" overlay for ambient/autoplaying
audio instead of (or alongside) the tap-driven model.

**Components**

| Component | File | What it does |
|---|---|---|
| `sound-controller` | [`sound-controller.ts`](src/a-frame-components/sound-controller.ts) | One per module; single-active-sound play/pause/stop state machine, drives the 2D GUI |
| `sound-button` | [`sound-button.ts`](src/a-frame-components/sound-button.ts) | Plays/pauses/stops a `sound` entity on tap (place alongside `ar-button`) |
| — *(not a component)* | [`sound-scene-audio.ts`](src/a-frame-components/sound-scene-audio.ts) | Optional helpers: start all `sound` entities from one tap, pause them in the background, scale positional distances |
| — *(not a component)* | [`sound-unlock-audio.ts`](src/a-frame-components/sound-unlock-audio.ts) | Shared iOS/Web Audio unlock helper, imported by `sound-controller.ts` and the tap-to-enable-sound overlay |

Also depends on the shared `ar-button` / `ar-button-manager` (see
[Shared building blocks](#shared-building-blocks)).

**Assets**

| Asset | Used by | Function |
|---|---|---|
| [`sound-start.webp`](examples/assets/sound-start.webp) | `examples/sound-gui-panel.html` | Restart icon on the 2D GUI panel |
| [`sound-stop.webp`](examples/assets/sound-stop.webp) | `examples/sound-gui-panel.html` | Stop icon |
| [`sound-play.webp`](examples/assets/sound-play.webp) | `examples/sound-gui-panel.html` | Play icon |
| [`sound-pause.webp`](examples/assets/sound-pause.webp) | `examples/sound-gui-panel.html` | Pause icon |

Examples: [`ar-button-usage.html`](examples/ar-button-usage.html),
[`sound-gui-panel.html`](examples/sound-gui-panel.html),
[`sound-unlock-overlay-usage.html`](examples/sound-unlock-overlay-usage.html)

## AR Overlay

Guide: [AR-OVERLAY-FEATURE-GUIDE.md](guides/AR-OVERLAY-FEATURE-GUIDE.md) · Source: `augmented-bahnhofsviertel`

A Vue component for a module's 2D UI over the camera image: a centre
column of controls (hint text, Start/Play/unlock buttons, dismissed on tap)
and an optional recenter button below the host's own UI. With
`placeTarget` it waits for a [Placement & Recenter](#placement--recenter)
scene and re-places it. Inline styles only (works in the host).

**Components**

| Component | File | What it does |
|---|---|---|
| — *(Vue component, not registered)* | [`ArOverlay.vue`](src/ArOverlay.vue) | The overlay: controls, recenter button, waits for placement |
| — *(not a component)* | [`ar-overlay-icons.ts`](src/ar-overlay-icons.ts) | Inline SVG icons (recenter, close, tap-on-cursor) and `actionButtonHtml()` |

**Assets** — none (icons are inline SVG strings).

Examples: [`ar-overlay-usage.html`](examples/ar-overlay-usage.html)

## Placement & Recenter

Guide: [PLACEMENT-FEATURE-GUIDE.md](guides/PLACEMENT-FEATURE-GUIDE.md) · Source: `augmented-bahnhofsviertel`

Puts a scene on the floor in front of the viewer, facing the camera's
heading, module-locally (never the shared camera/XR8 origin) — again on a
recenter event or a tap; optionally scaled to the viewer's height. Plus a
ground cursor that places a model where you tap. iOS-safe tap detection.
Recenter button: [AR Overlay](#ar-overlay); gestures on the placed model:
[Gestures](#gestures). The template's start scene (`src/ArModule.vue`)
already uses it: its content sits in `<a-entity id="scene-root"
place-in-front="referenceHeight: 1.5; distance: 2">`, which stands it on
the real floor about 2 m in front of the viewer, with units roughly metres
(README "Where a module sits").

**Components**

| Component | File | What it does |
|---|---|---|
| `place-in-front` | [`place-in-front.ts`](src/a-frame-components/place-in-front.ts) | Places/re-places its entity in front of the camera; optional scale to viewer height, tap-recenter |
| `tap-place-cursor` | [`tap-place-cursor.ts`](src/a-frame-components/tap-place-cursor.ts) | Ground cursor following the screen centre; a tap moves its target there |
| — *(not a component)* | [`scene-tap-shared.ts`](src/a-frame-components/scene-tap-shared.ts) | iOS-safe tap-on-the-scene detection (pointer events), used by both |

**Assets** — none.

Examples: [`placement-usage.html`](examples/placement-usage.html)

## Gestures

Guide: [GESTURES-FEATURE-GUIDE.md](guides/GESTURES-FEATURE-GUIDE.md) · Source: `augmented-bahnhofsviertel`

Hold-and-drag along the ground, rotate (one or two fingers), pinch to scale
— configured in one attribute. Drag works inside transformed parents
(unlike `xrextras-hold-drag`); rotate/pinch are xrextras' own. Usually on
the model inside a [Placement & Recenter](#placement--recenter) scene.

**Components**

| Component | File | What it does |
|---|---|---|
| `gesture-control` | [`gesture-control.ts`](src/a-frame-components/gesture-control.ts) | Sets/removes hold-drag + xrextras rotate/pinch on its entity from one attribute |
| `hold-drag` | [`hold-drag.ts`](src/a-frame-components/hold-drag.ts) | Hold, then drag along the ground; parent-space aware, xrextras-hold-drag schema compatible |

**Assets** — none.

Examples: [`gestures-usage.html`](examples/gestures-usage.html)

## Image Tracking

Guide: [IMAGE-TRACKING-FEATURE-GUIDE.md](guides/IMAGE-TRACKING-FEATURE-GUIDE.md) · Source: `main` (template baseline)

Anchors content to a detected real-world printed/displayed image, via 8th
Wall's own image-target engine. The two tracking components are provided by
the 8th Wall `xrextras` library itself, not this project; the one file of
ours is the shared [`world-origin`](#shared-building-blocks), which wraps
each target so the host's module-root offset doesn't shift it off the image.
Previously wired directly into `ArModule.vue`; moved out into an example +
guide, matching how every other feature works, and no longer registered in
`manifest.ts` by default. Only works in the real AR preview (`npm run
dev:ar`) or the real host — the plain VR/desktop preview never configures
XR8 at all, so this can never be seen working there.

**Components** (external — not ours, nothing to copy into `src/a-frame-components/`)

| Component | Source | What it does |
|---|---|---|
| `xrextras-named-image-target` | 8th Wall `xrextras` library | Shows/hides/positions its children to track one named detected target |
| `xrextras-play-video` | 8th Wall `xrextras` library | Tap-to-play/stop a video texture, with a poster-frame `thumb` |
| `world-origin` | ours — [`world-origin.ts`](src/a-frame-components/world-origin.ts) (shared building block) | Wraps each `xrextras-named-image-target`; cancels the host's module-root offset |

**Assets**

| Asset | Used by | Function |
|---|---|---|
| [`video-target.json`](examples/image-targets/video-target.json) + 4 images | `examples/image-tracking-usage.html` | Generated demo target in the 8th Wall target tool's format |
| [`image-tracking-demo-video.mp4`](examples/assets/image-tracking-demo-video.mp4) | `examples/image-tracking-usage.html` | The example's video content, played once the target is detected |
| [`image-tracking-poster.jpg`](examples/assets/image-tracking-poster.jpg) | `examples/image-tracking-usage.html` | Poster frame shown before the video plays |

Examples: [`image-tracking-usage.html`](examples/image-tracking-usage.html)

## Video

Guide: [VIDEO-FEATURE-GUIDE.md](guides/VIDEO-FEATURE-GUIDE.md) · Source: `augmented-bahnhofsviertel`

Starts, pauses and unmutes `<video>` assets from events (on the entity or
the scene), so one tap starts every video — with sound — inside the gesture
iOS needs; pauses them while the page is hidden. For video on a tracked
image see [Image Tracking](#image-tracking).

**Components**

| Component | File | What it does |
|---|---|---|
| `video-control` | [`video-control.ts`](src/a-frame-components/video-control.ts) | Event-driven play/pause/unmute of a video asset, background pause |

**Assets** — none (videos are project content).

Examples: [`video-usage.html`](examples/video-usage.html)

## Tap Animation

Guide: [TAP-ANIMATION-FEATURE-GUIDE.md](guides/TAP-ANIMATION-FEATURE-GUIDE.md) · Source: `augmented-bahnhofsviertel`

Tap a model to play one of its glTF animations — once (staying at the last
frame) or on every tap — and (re)start its `sound`; taps can be gated
(`enabled`) until audio is unlocked. Uses aframe-extras' `animation-mixer`.

**Components**

| Component | File | What it does |
|---|---|---|
| `tap-animation` | [`tap-animation.ts`](src/a-frame-components/tap-animation.ts) | Plays a clip + the entity's sound on tap, once or every time |

**Assets** — none.

Examples: [`tap-animation-usage.html`](examples/tap-animation-usage.html)

## Proximity Fade

Guide: [PROXIMITY-FADE-FEATURE-GUIDE.md](guides/PROXIMITY-FADE-FEATURE-GUIDE.md) · Source: `Madleen_module`

Fades a wrapped model's opacity in and/or out as the camera moves toward a
configurable target point — two independent, order-independent distance
ramps that combine into one appear-then-disappear window. Two
interchangeable rendering techniques share one implementation.

**Components**

| Component | File | What it does |
|---|---|---|
| — *(not a component)* | [`proximity-fade-shared.ts`](src/a-frame-components/proximity-fade-shared.ts) | Shared schema/ramp/target logic both variants below are built from |
| `proximity-fade` | [`proximity-fade.ts`](src/a-frame-components/proximity-fade.ts) | Real alpha-blended transparency variant |
| `proximity-fade-dither` | [`proximity-fade-dither.ts`](src/a-frame-components/proximity-fade-dither.ts) | Dithered opaque-pass transparency variant (for objects overlapping other transparent materials) |

**Assets:** none.

Examples: [`proximity-fade-usage.html`](examples/proximity-fade-usage.html)

## Proximity Cutout

Guide: [PROXIMITY-CUTOUT-FEATURE-GUIDE.md](guides/PROXIMITY-CUTOUT-FEATURE-GUIDE.md) · Source: `Madleen_module`

Dithers away fragments of a wrapped model within a radius of the camera,
opening a hole that lets the camera "cut into" the model as it approaches.

**Components**

| Component | File | What it does |
|---|---|---|
| `proximity-cutout` | [`proximity-cutout.ts`](src/a-frame-components/proximity-cutout.ts) | The whole feature — one file |

**Assets:** none.

Examples: [`proximity-cutout-usage.html`](examples/proximity-cutout-usage.html)

## Proximity Wave

Guide: [PROXIMITY-WAVE-FEATURE-GUIDE.md](guides/PROXIMITY-WAVE-FEATURE-GUIDE.md) · Source: `Gyumin_module`

Proximity-gated wave (fades in as the camera approaches) plus a subtle
always-on idle float. `proximity-wave` works standalone on one entity;
`proximity-wave-group` broadcasts one shared parameter set to every direct
child of a group (a plain hand-authored group, or a
[Random Field](#random-field) entity — same component either way).

**Components**

| Component | File | What it does |
|---|---|---|
| `proximity-wave` | [`proximity-wave.ts`](src/a-frame-components/proximity-wave.ts) | Per-entity motion — works standalone |
| `proximity-wave-group` | [`proximity-wave-group.ts`](src/a-frame-components/proximity-wave-group.ts) | Applies one shared config to every direct child |

**Assets:** none.

Examples: [`proximity-wave-usage.html`](examples/proximity-wave-usage.html),
[`random-field-lod-billboard-proximity-wave-scene.html`](examples/random-field-lod-billboard-proximity-wave-scene.html)

## Wander In Band

Guide: [WANDER-IN-BAND-FEATURE-GUIDE.md](guides/WANDER-IN-BAND-FEATURE-GUIDE.md) · Source: `Fanyu_module`

Makes an entity continuously orbit within an annulus ("band") around a
center entity — steady baseline orbit, a chaos-driven angular deviation,
subtle floating, soft edge spiral-back, and gentle mutual avoidance of
sibling `wander-in-band` entities sharing the same DOM parent. Independent
of [Follow Node](#follow-node).

<!-- project-specific -->
### Project context: origin

Ported from `Fanyu_module` essentially unchanged (only a cosmetic
THREE-access normalization) — already fully generic in the source. Ported
in the same batch as Follow Node.

<!-- /project-specific -->

**Components**

| Component | File | What it does |
|---|---|---|
| `wander-in-band` | [`wander-in-band.ts`](src/a-frame-components/wander-in-band.ts) | The whole feature — one file |

**Assets:** none.

Examples: [`wander-in-band-usage.html`](examples/wander-in-band-usage.html)

## Follow Node

Guide: [FOLLOW-NODE-FEATURE-GUIDE.md](guides/FOLLOW-NODE-FEATURE-GUIDE.md) · Source: `Fanyu_module`

Makes an entity's position continuously track a named node (mesh, empty, or
bone) inside another entity's loaded glTF — e.g. attaching a positional
`sound` to a specific animated part of a model rather than its overall
static transform.

<!-- project-specific -->
### Project context: origin

Ported from `Fanyu_module` essentially unchanged (only a cosmetic
THREE-access normalization) — already fully generic in the source.

<!-- /project-specific -->

**Components**

| Component | File | What it does |
|---|---|---|
| `follow-node` | [`follow-node.ts`](src/a-frame-components/follow-node.ts) | The whole feature — one file |

**Assets:** none.

Examples: [`follow-node-usage.html`](examples/follow-node-usage.html)

## Trim Loop Clip

Guide: [TRIM-LOOP-CLIP-FEATURE-GUIDE.md](guides/TRIM-LOOP-CLIP-FEATURE-GUIDE.md) · Source: `Fanyu_module`

Trims a glTF animation's dead lead-in (from a Blender export whose preview
range didn't start at frame 0) and loops it; when a model has multiple
clips, keeps them all driven off one shared clock so they don't gradually
drift out of phase with each other. Use instead of A-Frame's stock
`animation-mixer` on the same entity.

<!-- project-specific -->
### Project context: origin

Ported from `Fanyu_module` essentially unchanged — only an added
immediate-check for a model that finished loading before this component's
own `init()` ran.

<!-- /project-specific -->

**Components**

| Component | File | What it does |
|---|---|---|
| `trim-loop-clip` | [`trim-loop-clip.ts`](src/a-frame-components/trim-loop-clip.ts) | The whole feature — one file |

**Assets:** none.

Examples: [`trim-loop-clip-usage.html`](examples/trim-loop-clip-usage.html)

## Attach To

Guide: [ATTACH-TO-FEATURE-GUIDE.md](guides/ATTACH-TO-FEATURE-GUIDE.md) · Source: `Gyumin_module`

Makes an entity follow another entity's world position (plus a fixed
world-space offset) every frame, even if it isn't that entity's DOM child —
e.g. a light tracking the host-provided camera. Position only. Writes
`position` every tick with no composition — don't combine with
`wander-in-band`/`proximity-wave` on the same entity, see the guide's
incompatibilities section.

<!-- project-specific -->
### Project context: origin

Ported from `Gyumin_module` unchanged — already fully generic in the
source.

<!-- /project-specific -->

**Components**

| Component | File | What it does |
|---|---|---|
| `attach-to` | [`attach-to.ts`](src/a-frame-components/attach-to.ts) | The whole feature — one file |

**Assets:** none.

Examples: [`attach-to-usage.html`](examples/attach-to-usage.html)

## Ground Decal

Guide: [GROUND-DECAL-FEATURE-GUIDE.md](guides/GROUND-DECAL-FEATURE-GUIDE.md) · Source: `Gyumin_module`

Keeps a decal plane flat on the ground directly under its parent entity's
pivot, regardless of how the parent is rotated/tilted, and excludes it from
scene fog. Requires a parent entity. Works on primitives too, and clones
materials before excluding them from fog — see the guide's §3.

<!-- project-specific -->
### Project context: origin

Ported from `Gyumin_module`, with two fixes made during the port:
primitive support (`object3dset` instead of `model-loaded`) for the fog
exclusion, and a previously-latent shared-material bug (the source set
`fog = false` on each material in place rather than cloning first).

<!-- /project-specific -->

**Components**

| Component | File | What it does |
|---|---|---|
| `ground-decal` | [`ground-decal.ts`](src/a-frame-components/ground-decal.ts) | The whole feature — one file |

**Assets:** none.

Examples: [`ground-decal-usage.html`](examples/ground-decal-usage.html)

## Random Field

Guide: [RANDOM-FIELD-FEATURE-GUIDE.md](guides/RANDOM-FIELD-FEATURE-GUIDE.md) · Source: `Gyumin_module`

Scatters clones of one or more referenced entities (by id) across a
fixed-width strip, using Poisson-disk sampling so a min/max spacing and a
per-entity copy count are honoured exactly. Reworked from the source's
`glowstick-field`, which bundled this together with auto-discovering assets
by naming convention and building LOD structure from scratch — this version
only places; what it clones is entirely up to what you author and
reference by id (see [LOD + Billboard](#lod--billboard)).

**Components**

| Component | File | What it does |
|---|---|---|
| `random-field` | [`random-field.ts`](src/a-frame-components/random-field.ts) | The whole feature — one file |

**Assets:** none.

Examples: [`random-field-usage.html`](examples/random-field-usage.html),
[`random-field-lod-billboard-proximity-wave-scene.html`](examples/random-field-lod-billboard-proximity-wave-scene.html)

## Spawn Sequence

Guide: [SPAWN-SEQUENCE-FEATURE-GUIDE.md](guides/SPAWN-SEQUENCE-FEATURE-GUIDE.md) · Source: `augmented-bahnhofsviertel`

Models spring up one after another — every `interval` ms or at listed
`times` — in front of the viewer (along the view direction) or at random
spots around the entity, turned to the viewer or randomly, with a random
scale range and an elastic grow; optionally a one-shot positional sound
each. Compare [Random Field](#random-field) (all at once, static).

<!-- project-specific -->
### Project context: origin

Merged from two Augmented Bahnhofsviertel works: #4 Europaplatz II's
interval spawner and #6 Birdkin(d)'s timeline spawner.

<!-- /project-specific -->

**Components**

| Component | File | What it does |
|---|---|---|
| `spawn-sequence` | [`spawn-sequence.ts`](src/a-frame-components/spawn-sequence.ts) | Spawns models over time with bounce, facing, scale range and sound |

**Assets** — none (models/sounds are project content).

Examples: [`spawn-sequence-usage.html`](examples/spawn-sequence-usage.html)

## LOD + Billboard

Guide: [LOD-BILLBOARD-FEATURE-GUIDE.md](guides/LOD-BILLBOARD-FEATURE-GUIDE.md) · Source: `Gyumin_module`

Cross-fades a detailed 3D model (optionally split into several parts) into
a flat, always-camera-facing billboard image by distance. The
`.lod-mesh`/`.lod-mesh-group`/`.lod-billboard` structure `lod-object` reads
was already fully generic in the source (driven by CSS class, not any
naming convention) — the only change is that the source's field-population
component used to build this structure programmatically; here it's
authored directly in the scene (see
[RANDOM-FIELD-FEATURE-GUIDE.md](guides/RANDOM-FIELD-FEATURE-GUIDE.md) for how the
two combine). Composes closely with
[Render Order](#render-order) — see
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md](cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md).

**Components**

| Component | File | What it does |
|---|---|---|
| `lod-object` | [`lod-object.ts`](src/a-frame-components/lod-object.ts) | One per LOD instance — gathers materials, registers with the manager |
| `lod-manager` | [`lod-manager.ts`](src/a-frame-components/lod-manager.ts) | One per module; ticks every `lod-object`, drives the crossfade + render-order banding |
| `billboard` | [`billboard.ts`](src/a-frame-components/billboard.ts) | Spins an entity about Y to face the camera |
| `unlit-material` | [`unlit-material.ts`](src/a-frame-components/unlit-material.ts) | Flat/shadeless material technique, typically used on the billboard — a [shared building block](#shared-building-blocks), not owned by this feature |

**Assets:** none.

Examples: [`lod-billboard-usage.html`](examples/lod-billboard-usage.html),
[`random-field-lod-billboard-proximity-wave-scene.html`](examples/random-field-lod-billboard-proximity-wave-scene.html)

## Portal

Guide: [PORTAL-FEATURE-GUIDE.md](guides/PORTAL-FEATURE-GUIDE.md) · Source: `augmented-bahnhofsviertel`

A walk-through portal: hider walls mask another world except through a
doorway; crossing the door plane puts you inside, optionally with a window
back out and a door ring that springs open on an event. Pins the hiders'
draw order with renderOrder (stable under three r137 and r158).

**Components**

| Component | File | What it does |
|---|---|---|
| `portal` | [`portal.ts`](src/a-frame-components/portal.ts) | Inside/outside switching, renderOrder of hiders/contents, door animation |

**Assets** — none.

Examples: [`portal-usage.html`](examples/portal-usage.html)

## Render Order

Guide: [RENDER-ORDER-FEATURE-GUIDE.md](guides/RENDER-ORDER-FEATURE-GUIDE.md) · Source: `Gyumin_module`

Sets three.js `renderOrder` on every mesh of a loaded model, for
controlling draw order among overlapping transparent surfaces. Applicable
to any entity. See
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md](cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md)
for how this composes with [LOD + Billboard](#lod--billboard) (inside an
`lod-object` group, this value means local order within that one group,
not the final runtime value) and with Proximity Fade/Cutout's own material
patching.

**Components**

| Component | File | What it does |
|---|---|---|
| `render-order` | [`render-order.ts`](src/a-frame-components/render-order.ts) | The whole feature — one file |

**Assets:** none.

Examples: [`render-order-usage.html`](examples/render-order-usage.html),
[`random-field-lod-billboard-proximity-wave-scene.html`](examples/random-field-lod-billboard-proximity-wave-scene.html)

## Mesh Render Order

Guide: [MESH-RENDER-ORDER-FEATURE-GUIDE.md](guides/MESH-RENDER-ORDER-FEATURE-GUIDE.md) · Source: `Rosa_module`

Sets three.js `renderOrder` on individual **named** meshes inside a single
loaded model, for controlling draw order among one asset's own
overlapping/layered internal parts, relative to each other — finer
granularity than [Render Order](#render-order), which sets one value
across a whole model. The source hardcoded both the mesh names and their
order in TypeScript for one specific asset; this version takes the
name→order mapping as a runtime attribute. **Real, confirmed conflict**
with [LOD + Billboard](#lod--billboard) — see
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md](cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md)
and the guide's own incompatibilities section.

**Components**

| Component | File | What it does |
|---|---|---|
| `mesh-render-order` | [`mesh-render-order.ts`](src/a-frame-components/mesh-render-order.ts) | The whole feature — one file |

**Assets**

| Asset | Used by | Function |
|---|---|---|
| [`mesh-render-order-demo.glb`](examples/assets/mesh-render-order-demo.glb) | `examples/mesh-render-order-unlit-material-scene.html` | Generated demo: five overlapping see-through panels with named meshes |

<!-- project-specific -->
### Project context: `Rosa_module` / `Rosa`

`mesh-render-order` was ported from `Rosa_module`; its model isn't part of the
template.

<!-- /project-specific -->

Examples: [`mesh-render-order-usage.html`](examples/mesh-render-order-usage.html),
[`mesh-render-order-unlit-material-scene.html`](examples/mesh-render-order-unlit-material-scene.html)

## Light & Reflections

Guide: [LIGHT-REFLECTIONS-FEATURE-GUIDE.md](guides/LIGHT-REFLECTIONS-FEATURE-GUIDE.md) · Source: `augmented-bahnhofsviertel`

Ties virtual objects to the real place: live reflections of the camera
image, designed reflections from six images, and lights whose intensity
follows 8th Wall's measured real-world brightness. Three independent
components sharing the env-map plumbing; schema-compatible with the old
8th Wall components. Works with three r137 (host) and r158.

**Components**

| Component | File | What it does |
|---|---|---|
| `cubemap-realtime` | [`cubemap-realtime.ts`](src/a-frame-components/cubemap-realtime.ts) | Live env map from the camera image, updated every frame |
| `cubemap-static` | [`cubemap-static.ts`](src/a-frame-components/cubemap-static.ts) | Env map from six face images, per material, linear or sRGB |
| `xr-light` | [`xr-light.ts`](src/a-frame-components/xr-light.ts) | Light intensity = clamp(1 + measured exposure, min, max) |
| — *(not a component)* | [`env-map-shared.ts`](src/a-frame-components/env-map-shared.ts) | Clones materials and writes envMap/intensity |

**Assets** — none (a project adds its own six cube images).

Examples: [`light-reflections-usage.html`](examples/light-reflections-usage.html)

## Material Properties

Guide: [MATERIAL-PROPERTIES-FEATURE-GUIDE.md](guides/MATERIAL-PROPERTIES-FEATURE-GUIDE.md) · Source: `Gyumin_module`

Manually tunes a loaded model's PBR material properties — roughness,
metalness, opacity, and emissive intensity/tint — directly on whatever
material is already there, without discarding it the way
[LOD + Billboard](#lod--billboard)'s `unlit-material` does. Combines two
needs into one component: manual roughness/metalness/opacity control and
emissive glow tuning. See the guide for why these were merged rather than
kept separate, and why `disableShadow` defaults to off.

<!-- project-specific -->
### Project context: origin

Manual roughness/metalness/opacity control had no equivalent in any source
branch; emissive tuning comes from `Gyumin_module`'s `emissive-material`,
which always switched shadows off.

<!-- /project-specific -->

**Components**

| Component | File | What it does |
|---|---|---|
| `material-properties` | [`material-properties.ts`](src/a-frame-components/material-properties.ts) | The whole feature — one file |

**Assets:** none.

Examples: [`material-properties-usage.html`](examples/material-properties-usage.html)

## Dither Material

Guide: [DITHER-MATERIAL-FEATURE-GUIDE.md](guides/DITHER-MATERIAL-FEATURE-GUIDE.md) · Source: `Fanyu_module`

Ordered-dithering ("screen-door") transparency for a loaded model — a
**manual, fixed-opacity** dither, unlike the two distance-driven dither
variants already in this template ([Proximity Cutout](#proximity-cutout),
[Proximity Fade](#proximity-fade)'s dither variant). Named to fit the
template's `[x]-material` naming. Works on primitives too and clones
materials before patching them — see the guide's §3.

<!-- project-specific -->
### Project context: origin

Ported from `Fanyu_module`'s `dither-transparency.ts` (found registered but
unused in that branch's own scene) and renamed. Two real fixes made during
the port: primitive support (`object3dset` instead of `model-loaded`) and a
previously-latent shared-material bug (the source mutated materials in
place rather than cloning them first).

<!-- /project-specific -->

**Components**

| Component | File | What it does |
|---|---|---|
| `dither-material` | [`dither-material.ts`](src/a-frame-components/dither-material.ts) | The whole feature — one file |

**Assets:** none.

Examples: [`dither-material-usage.html`](examples/dither-material-usage.html)

## Grain Shimmer

Guide: [GRAIN-SHIMMER-FEATURE-GUIDE.md](guides/GRAIN-SHIMMER-FEATURE-GUIDE.md) · Source: `augmented-bahnhofsviertel` (#20 analysis, original)

A grainy, sparkling surface for any model: its textures sampled without
mipmaps (fine grain then sparkles with every movement) and optional grain
added in the shader, fixed to the surface or animated like film grain.
Clones materials/textures, chains other shader patches.

<!-- project-specific -->
### Project context: origin

An original feature built from an analysis of #20 Solid Dream Level
(`augmented-bahnhofsviertel`), whose look it reproduces.

<!-- /project-specific -->

**Components**

| Component | File | What it does |
|---|---|---|
| `grain-shimmer` | [`grain-shimmer.ts`](src/a-frame-components/grain-shimmer.ts) | Mipmap-free texture sampling + object-space shader grain |

**Assets** — none.

Examples: [`grain-shimmer-usage.html`](examples/grain-shimmer-usage.html)

## Mirror Shard

Guide: [MIRROR-SHARD-FEATURE-GUIDE.md](guides/MIRROR-SHARD-FEATURE-GUIDE.md) · Source: `Zhichang_module`

A field of 112 glass shards (three merged draw calls total) that ripple
outward from tapped points with a gentle idle sway. Optionally shows an
inner illustration layer powered by [Liquid Texture](#liquid-texture).

**Components**

| Component | File | What it does |
|---|---|---|
| `mirror-shard` | [`mirror-shard.ts`](src/a-frame-components/mirror-shard.ts) | The shard field: geometry, impact/idle motion shader, tap-to-pulse |

**Assets**

| Asset | Used by | Function |
|---|---|---|
| [`mirror-shard-data/shards.json`](src/a-frame-components/mirror-shard-data/shards.json) | `mirror-shard.ts` (static import, not `src/assets/` — build-time geometry, not a runtime-loaded asset) | Generated shard geometry: 112 triangles + per-shard seed/depth |

Related feature: [Liquid Texture](#liquid-texture) (optional inner
illustration layer, wired via the `liquidTarget` selector attribute).

Examples: [`mirror-shard-usage.html`](examples/mirror-shard-usage.html),
[`mirror-shard-liquid-texture-scene.html`](examples/mirror-shard-liquid-texture-scene.html)

## Liquid Texture

Guide: [LIQUID-TEXTURE-FEATURE-GUIDE.md](guides/LIQUID-TEXTURE-FEATURE-GUIDE.md) · Source: `Zhichang_module`

Generic, reusable procedural "liquid ink" texture generator — fbm marbling
that optionally reveals a target image, with a swirl/cellular-bubble look.
Renders to an offscreen texture any material can sample; not specific to
Mirror Shard (no feature prefix — see the naming-convention comment in
`src/manifest.ts`).

<!-- project-specific -->
### Project context: origin

Salvaged from `Zhichang_module`, the same source branch as Mirror Shard.

<!-- /project-specific -->

**Components**

| Component | File | What it does |
|---|---|---|
| `liquid-texture` | [`liquid-texture.ts`](src/a-frame-components/liquid-texture.ts) | The whole feature — generic, standalone |

**Assets**

| Asset | Used by | Function |
|---|---|---|
| [`liquid-texture-target-1.webp`](examples/assets/liquid-texture-target-1.webp) | `examples/liquid-texture-usage.html`, `examples/mirror-shard-liquid-texture-scene.html` | Generated abstract `target` image (blue circles) showing the ink revealing an image |
| [`liquid-texture-target-2.webp`](examples/assets/liquid-texture-target-2.webp) | `examples/liquid-texture-usage.html`, `examples/mirror-shard-usage.html` | Second generated `target` image (orange bars), paired with a different palette |

Related feature: [Mirror Shard](#mirror-shard) (consumes this component's
rendered texture for its inner illustration layer).

Examples: [`liquid-texture-usage.html`](examples/liquid-texture-usage.html),
[`mirror-shard-liquid-texture-scene.html`](examples/mirror-shard-liquid-texture-scene.html)

## Tags

Every tag used in the [Index](#index) above, alphabetical, with every
feature that carries it.

### Tag: `animation`

- [Tap Animation](#tap-animation)
- [Trim Loop Clip](#trim-loop-clip)
- [Spawn Sequence](#spawn-sequence)

### Tag: `distribution`

- [Random Field](#random-field)
- [Spawn Sequence](#spawn-sequence)

### Tag: `dither`

- [Proximity Cutout](#proximity-cutout)
- [Dither Material](#dither-material)

### Tag: `image-tracking`

- [Image Tracking](#image-tracking)

### Tag: `interaction`

- [Sound](#sound)
- [AR Overlay](#ar-overlay)
- [Placement & Recenter](#placement--recenter)
- [Gestures](#gestures)
- [Image Tracking](#image-tracking)
- [Video](#video)
- [Tap Animation](#tap-animation)
- [Mirror Shard](#mirror-shard)

### Tag: `lighting`

- [Light & Reflections](#light--reflections)

### Tag: `LOD`

- [LOD + Billboard](#lod--billboard)

### Tag: `material-properties`

- [Light & Reflections](#light--reflections)
- [Material Properties](#material-properties)
- [Dither Material](#dither-material)
- [Grain Shimmer](#grain-shimmer)

### Tag: `motion`

- [Proximity Wave](#proximity-wave)
- [Wander In Band](#wander-in-band)
- [Follow Node](#follow-node)
- [Attach To](#attach-to)

### Tag: `placement`

- [Placement & Recenter](#placement--recenter)
- [Gestures](#gestures)

### Tag: `procedural`

- [Grain Shimmer](#grain-shimmer)
- [Mirror Shard](#mirror-shard)
- [Liquid Texture](#liquid-texture)

### Tag: `proximity`

- [Proximity Fade](#proximity-fade)
- [Proximity Cutout](#proximity-cutout)
- [Proximity Wave](#proximity-wave)

### Tag: `random`

- [Wander In Band](#wander-in-band)
- [Random Field](#random-field)
- [Spawn Sequence](#spawn-sequence)

### Tag: `render-order`

- [LOD + Billboard](#lod--billboard)
- [Portal](#portal)
- [Render Order](#render-order)
- [Mesh Render Order](#mesh-render-order)

### Tag: `sound`

- [Sound](#sound)

### Tag: `transparency`

- [Proximity Fade](#proximity-fade)
- [Proximity Cutout](#proximity-cutout)
- [LOD + Billboard](#lod--billboard)
- [Render Order](#render-order)
- [Mesh Render Order](#mesh-render-order)
- [Dither Material](#dither-material)

### Tag: `ui`

- [AR Overlay](#ar-overlay)

### Tag: `utility`

- [Follow Node](#follow-node)
- [Trim Loop Clip](#trim-loop-clip)
- [Attach To](#attach-to)
- [Ground Decal](#ground-decal)

### Tag: `video`

- [Video](#video)

### Tag: `visual-effect`

- [Ground Decal](#ground-decal)
- [Portal](#portal)
- [Grain Shimmer](#grain-shimmer)
- [Mirror Shard](#mirror-shard)
- [Liquid Texture](#liquid-texture)
