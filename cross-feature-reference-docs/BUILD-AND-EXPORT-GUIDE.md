# Build and export guide

<!-- overview -->
## Introduction

A module is made in one place and shown in another. While working on it,
the template runs it in a preview on the computer or the phone; for the
visitors, the AN ALLE! platform loads it into its own AR view, next to its
own camera, lights and menus. There are several ways to build the same
scene — a quick preview without camera, a camera preview on the phone, a
stand-alone web page, and the actual module file the platform loads — and
each of them behaves a little differently.

This guide explains what each build is for, what the platform does with a
module when it loads it, how the previews imitate that, and how a finished
module gets onto the platform: which folder to upload, where, and how to
register it so it appears at its location.

<!-- /overview -->

## About this guide

Not tied to one feature. Read before the first export, when a module
behaves differently in the app than in a preview, and before changing
anything in `lib/` or `vite.config.ts`. Host facts are from
`TobiasStill/ar-demo-backend` at `727ea7a`; check the host for changes
before relying on them (README "Keeping up with the host"). Where a scene's
content ends up in space is its own topic:
[SCENE-PLACEMENT-GUIDE.md](SCENE-PLACEMENT-GUIDE.md).

## 1. The four builds

| Command | Output | Runtime | Camera / 8th Wall | Use it for |
|---|---|---|---|---|
| `npm run dev` | dev server, `index.html` (`lib/preview.ts`) | stock A-Frame 1.3.0 + aframe-extras + xrextras from CDN | no camera, no 8th Wall; WASD + mouse, "Enter VR" | quick look while editing; anything not camera-dependent |
| `npm run dev:ar` | dev server over https, `ar.html` (`lib/preview-ar.ts`) | 8frame 1.5.0 (`lib/vendor/`), aframe-extras, xrextras, 8th Wall engine | yes — open the LAN URL on a phone | everything camera-related: placement, image targets, light estimation, live reflections, taps on iOS |
| `npm run build:ar` | `dist-ar/` — standalone web page | same as `dev:ar`, bundled (Vue included), relative paths | yes | a deployable test page for a phone, or a stand-alone version of a work |
| `npm run build` | `dist-platform/` — `ar-module.js`, `manifest.json`, `assets/`, `image-targets/` | none of its own: runs inside the host | the host's | **the module the platform loads** |

`npm run build` runs `vue-tsc --noEmit` first; `build:ar` doesn't. Run
`npm run build` before any release even if you only deploy the standalone.

Headless checking of `dev:ar` without a phone:
[HEADLESS-AR-TESTING-GUIDE.md](HEADLESS-AR-TESTING-GUIDE.md).

### What's different between them

- **Engine version.** The host runs 8frame 1.3.0 (three.js r137);
  `dev:ar`/`build:ar` run 8frame 1.5.0 (three.js r158). Colour space
  (`colorSpace` vs. `encoding`), the sorting of opaque objects and PMREM
  updates differ — check such details in the host.
- **Vue.** The module build leaves `vue` external — the host provides one
  shared Vue through its import map. The standalone bundles Vue. Never add
  Vue to `dependencies`.
- **CSS.** The module build writes SFC `<style>` into a separate CSS file
  the host never loads. The standalone does load it. Style scene entities,
  not CSS.
- **Placement.** `dev:ar`/`build:ar` start the camera and mount the module
  exactly like the host (§2); `dev` doesn't. Placement only counts in
  `dev:ar` — see [SCENE-PLACEMENT-GUIDE.md](SCENE-PLACEMENT-GUIDE.md).
- **Standalone extras.** The standalone page shows the developer hint
  "AR Module Preview · 8th Wall …" and the page title of `ar.html`; remove
  or replace them for a public stand-alone version.

## 2. What the host does with a module

The host (`frontend/src/components/ArModule.vue`, `ArScene.vue`):

1. **Finds modules by location.** A module record has `text`, `url`,
   `author`, `category`, `enabled` and `location` (`lat`/`lng`). The app
   lists the enabled modules near the visitor (`NEARBY_RADIUS_M`, default
   50 m) in its module menu. **Only one module is shown at a time**; picking
   another unmounts the first.
2. **Loads it.** `url` may point at the folder (preferred, e.g.
   `…/ar-modules/my-module/`) or at `ar-module.js`; the host normalises it
   to a base folder and `import()`s `ar-module.js`. It reads
   `mod.manifest`.
3. **Registers the components** in `manifest.components` — skipping any
   name already registered (A-Frame can't unregister; the first module to
   register a name keeps it for the session).
4. **Applies `manifest.camera`** to the shared `<a-camera>` (never `id`,
   `position`, `cursor`, `raycaster` — blocked by type), remembering the old
   values.
5. **Configures image targets** (`manifest.imageTargets` →
   `XR8.XrController.configure`).
6. **Switches its two lights off** if `hostLights: false`.
7. **Injects the assets** into `<a-assets>`, resolving each `src` against
   the module's base folder — skipping an id that already exists.
8. **Mounts the component** inside `<a-entity id="ar-module-<id>"
   position="0 1.6 -3">`, with the camera having started at `0 0.35 0.8`.
   This offset is why floor content goes in `place-in-front` and image
   targets in `world-origin` — in detail in
   [SCENE-PLACEMENT-GUIDE.md](SCENE-PLACEMENT-GUIDE.md).

On unmount it restores the camera, clears the image targets, turns its
lights back on and removes the injected assets.

**How the previews imitate it.** `lib/host-runtime.ts` does steps 3–7 the
same way in both previews. `lib/preview-ar.ts` builds the host's base scene
around it: `#host-lights` (ambient `#BBB` + directional 0.6), the camera at
`0 0.35 0.8` with the same raycaster/cursor, and a `module-root` at
`0 1.6 -3` for every module. `lib/preview.ts` (`npm run dev`) only
imitates steps 3–7: camera at `0 0 0`, module at `0 1.5 0`.

Other host facts that matter for a module:

- **Shared UI.** The module menu (top left), GPS hint (top centre) and
  recalibrate button (top right) sit over the AR view — keep a module's 2D
  controls clear of them ([AR Overlay](../guides/AR-OVERLAY-FEATURE-GUIDE.md)).
- **Drawing mode.** In the host's drawing mode the raycaster is off:
  `.cantap` taps and dragging pause.
- **Base scene.** `xrextras-gesture-detector` is always on the scene
  (iOS `click` suppression — see the [Sound](../guides/SOUND-FEATURE-GUIDE.md)
  guide), plus linear fog and `renderer="colorManagement: true;
  maxCanvasWidth/Height: 1280"`.

## 3. Exporting a module

### Before building

- Commit the state you want to ship — build from it, not from an
  uncommitted working copy.
- `npm run build` without errors; check the scene in `npm run dev:ar` on a
  phone (or headless), including placement
  ([checklist](SCENE-PLACEMENT-GUIDE.md#7-checklist-and-symptoms)).
- Asset ids don't clash with the host's: it skips an asset whose id
  already exists in its scene, and its own `<a-assets>` already has
  `bubble` — a module asset `bubble.glb` would silently show the host's
  file instead. Prefix ids with the work's name to be safe.
- Don't change a shared component's behaviour under its template name
  (`ar-button`, …): the first module to register a name keeps it for the
  session.
- `hostLights: false` only with lights of your own.
- Large assets compressed (`npm run compress-assets`,
  [ASSET-COMPRESSION-GUIDE.md](ASSET-COMPRESSION-GUIDE.md)).

### Uploading

Host the **whole `dist-platform/` folder** — `ar-module.js` loads its
`assets/` and `image-targets/` relative to itself. The server must allow
cross-origin requests (CORS), serve `.js` as `text/javascript`, and should
support HTTP range requests (iOS needs them for video/audio).

Most authors have no access to the server. In that case, hand the finished
`dist-platform/` folder to the people running the platform (or your workshop)
together with a title, your name and the location where the work should appear.
They upload and register it and send you the direct link to check it. If you
have your own web space that meets the requirements above, you can host the
folder yourself and only ask them to register the URL.

With server access, the folders are:

| Build | Server folder | URL |
|---|---|---|
| `dist-platform/` | `html/ar-modules/ar-<slug>-module/` | `https://an-alle.net/ar-modules/ar-<slug>-module/` — no page of its own; this is the `url` for the admin panel |
| `dist-ar/` | `html/standalones/ar-<slug>-standalone/` | `https://an-alle.net/standalones/ar-<slug>-standalone/` (also under `allean.uber.space`) |

<!-- project-specific -->
#### Project context: deploy scripts

The example branches (`animationssystem-wanderer`, `material-shader-showcase`,
`zufallsverteilung-lod`) ship a `npm run deploy:production` script that builds
both and rsyncs them to the AN ALLE! server; these three are the example scenes
exported as modules so far (`randomfield`, `shadershowcase`, `soundwanderer`).
`proximity-effekte` was never exported as a module; it only has
`npm run deploy:ar` (standalone to the test space). The Augmented
Bahnhofsviertel branches (now in the private archive repository) build both for all works at once with
`npm run abv:release`, which also checks shared components, asset-id clashes
and the build itself, and run their previews on the host's 8frame 1.3.0
(`PORTING-GUIDE.md` §9 on those branches). None of this is on
`feature_template`.

<!-- /project-specific -->

### Registering it on the platform

This step needs an admin login. In the admin panel (`/admin/`), add an AR module: `text` (title),
`url` (the uploaded `dist-platform/` folder), `author`, `location` (where
it appears), optionally a category; `enabled` controls visibility. To test
without travelling there:

- **Direct link:** the app opens a module from its id in the URL hash,
  `…/#<moduleId>`, regardless of location.
- **Spoof link:** "Spoof here" in the admin panel opens the app with
  `#spoof=<lat>/<lng>` — the GPS position is faked, camera and AR stay
  real.

### After uploading

Open it in the app on a phone, via the direct link: placement (floor,
image targets), light and colours (8frame 1.3!), sound after the first
tap, taps on iOS, loading time. Then open another module in the same
session and come back: component names stay registered after a module is
unmounted (its assets, camera settings and image targets are removed).
