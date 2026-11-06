# ar-module-template

A starter project for building **ArModule** components — Vue 3 SFCs that are compiled to a single ES module, hosted at any URL, and dynamically loaded into the AR scene at runtime.

New to the tools? Start with the introductions in `cross-feature-reference-docs/`: [A-Frame](cross-feature-reference-docs/AFRAME-INTRODUCTION.md), [8th Wall](cross-feature-reference-docs/8THWALL-INTRODUCTION.md), [Vue](cross-feature-reference-docs/VUE-INTRODUCTION.md), [writing a component](cross-feature-reference-docs/WRITING-A-COMPONENT-GUIDE.md), and the [architecture overview](cross-feature-reference-docs/ARCHITECTURE-GUIDE.md) (layers, formats, languages, conventions).

## Layout

```
ar-module-template/
├── package.json          # deps + build/dev scripts
├── tsconfig.json
├── vite.config.ts        # lib build + VR/AR previews + standalone AR build; bundles src/assets
├── index.html            # VR/desktop preview page  (npm run dev)
├── ar.html               # 8th Wall AR preview page (npm run dev:ar / build:ar)
├── src/                   # everything a fork is expected to edit
│   ├── ArModule.vue           # the user-edited component (template syntax)
│   ├── manifest.ts            # the authored manifest: assets + components (both automatic) + camera + imageTargets + hostLights
│   ├── assets/                 # drop .glb/.png/.mp3/… here — auto-derived into the manifest (empty in the template)
│   ├── a-frame-components/     # custom A-Frame components — registered automatically by file name when used
│   ├── image-targets/          # 8th Wall image-target JSON + images, referenced from manifest.ts (empty in the template)
│   ├── asset-loading-overlay.ts # loading bar + spinner used by ArModule.vue (template baseline)
│   ├── ArOverlay.vue           # AR Overlay feature: 2D controls/hint over the AR view (FEATURE-CATALOG)
│   └── ar-overlay-icons.ts     # inline SVG icons for ArOverlay.vue
├── lib/                   # internal plumbing — not meant to be edited by a fork
│   ├── main.ts                # entry: re-exports the SFC as default + the manifest
│   ├── manifest.types.ts      # Manifest/CameraProps/CameraSettings/ManifestAsset types
│   ├── preview.ts             # VR/desktop preview harness (stock A-Frame)
│   ├── preview-ar.ts          # 8th Wall AR preview harness (8frame + engine + xrweb)
│   ├── host-runtime.ts        # shared preview wiring (register components / camera / image targets / host lights)
│   ├── frustum-culling.ts     # helper used by src/a-frame-components/no-frustum-cull.ts
│   ├── gltf-meshopt-setup.ts  # patches THREE.GLTFLoader so meshopt-compressed .glb files load
│   ├── vendor/                # meshopt decoder (for gltf-meshopt-setup.ts) + 8frame 1.5.0 (dev:ar / build:ar)
│   └── virtual-manifest.d.ts  # ambient types for `virtual:ar-manifest` and `virtual:used-components`
├── scripts/
│   ├── compress-assets.ts     # `npm run compress-assets` — interactive mesh/texture compression
│   └── used-components.ts     # finds the components the module uses (automatic registration)
└── uncompressed-assets/   # gitignored, local-only; pristine originals kept by compress-assets.ts
```

## Workflow

1. `cd ar-module-template`
2. `npm install`
3. Edit `src/ArModule.vue` — full SFC with `<template>`, `<script setup>`, `<style>`. The `arModule` prop matches the data shape the host injects.
4. `npm run build` → produces `dist-platform/ar-module.js`, a single ES module that default-exports your component.
5. Host the whole `dist-platform/` folder somewhere reachable by the AR app (on the AN ALLE! server: `html/ar-modules/<name>/` → `https://an-alle.net/ar-modules/<name>/`; any CORS-enabled URL works).
6. Add the module in the host's admin panel (`/admin/`, stored as an `ArModule` record): its `url` points at that folder (or directly at `ar-module.js`), plus title, author and location. Details: [cross-feature-reference-docs/BUILD-AND-EXPORT-GUIDE.md](cross-feature-reference-docs/BUILD-AND-EXPORT-GUIDE.md).

### Local VR preview during development

- `npm run dev` starts a Vite dev server (with HMR) that mounts `ArModule.vue` standalone inside an A-Frame scene. Open the printed URL in a browser.
- The scene shows A-Frame's built-in **"Enter VR"** button (bottom-right). Any WebXR-compatible HMD (Quest browser, SteamVR, etc.) can enter immersive mode.
- Desktop fallback: WASD to move, mouse drag to look around.
- Mock prop data lives in `lib/preview.ts` — edit it to test different inputs.
- Placement isn't the host's here (camera at `0 0 0`, module at `0 1.5 0`, no 8th Wall floor) — check where things stand in `npm run dev:ar`.
- For LAN access (e.g. from a standalone HMD on the same network): `npm run dev -- --host`.

The VR preview loads the host's component runtime from CDN, pinned to the host's versions: **A-Frame 1.3.0** (the version 8thwall's `8frame` is built on), `aframe-extras` (`animation-mixer`, …) and `xrextras` (`xrextras-*`).

Note this mode uses **stock A-Frame, not `8frame`**: 8frame's render loop is driven by the 8th Wall camera engine, so it never paints standalone — fine for a desktop/VR preview that has no camera. Stock A-Frame self-renders and is binary-compatible with the same `aframe-extras`/`xrextras`. `xrextras-*` components that depend on the AR engine (e.g. `xrextras-attach` to a tracked target) simply no-op here. For a true 8th Wall AR preview, see below.

### 8th Wall AR preview (camera + world tracking)

- `npm run dev:ar` runs the preview against the **full host runtime** — `8frame` + `aframe-extras` + `xrextras` + the 8th Wall engine (`xrweb`) — so the module renders in real camera AR. Mock prop data lives in `lib/preview-ar.ts`.
- **One version difference to the host:** this preview (and `build:ar`) loads **8frame 1.5.0** (three.js r158) from `lib/vendor/`, while the host app runs **8frame 1.3.0** (three.js r137). Most scenes behave the same, but three.js APIs that changed in between (e.g. `colorSpace` vs. `encoding`, sorting of opaque objects, PMREM updates) can differ — check such details in the host. Aligning the preview with 8frame 1.3 is planned.
- The engine itself isn't on a public CDN: it's installed via the `@8thwall/engine-binary` dev-dependency and copied into `/external/xr/` by `vite-plugin-static-copy` (exactly as the host does). `npm install` puts it in place.
- **HTTPS is required for the camera** on any non-`localhost` origin. `dev:ar` serves over https (`@vitejs/plugin-basic-ssl`) and binds all interfaces (`--host`), so you can open the printed LAN URL on a phone (accept the self-signed cert). It also prints that URL as a QR code to scan (`scripts/dev-qr-code.ts`); with several networks, it picks the likeliest and lists the other addresses below the code. 8th Wall's SLAM/world-tracking needs a phone's rear camera + IMU — a laptop webcam works for a quick sanity check but won't track.
- Without a phone (e.g. an AI agent checking its own work): headless Chromium with an emulated iPhone and a generated video of the image target as the camera verifies target detection and scene rendering, not device motion or real-GPU performance — see [`cross-feature-reference-docs/HEADLESS-AR-TESTING-GUIDE.md`](cross-feature-reference-docs/HEADLESS-AR-TESTING-GUIDE.md).


### Keeping up with the host

Everything this template assumes about the host app — its runtime versions
(8frame, aframe-extras, xrextras, engine), its base scene (lights, camera,
raycaster, fog), its UI and its module loader — can change on the host side
at any time. The host is
[`TobiasStill/ar-demo-backend`](https://github.com/TobiasStill/ar-demo-backend)
(private: the link and the `gh` commands only work with access to it; without
access, rely on the facts below and test in the app). **With access, check it
for changes regularly**:
before a release, before relying on a host fact in new work, and whenever
something behaves differently in the host than in the preview. Look at the
commits since the last check, and at least these files:

| File (host repo) | What it decides for a module |
|---|---|
| `frontend/index.html` | runtime versions (`external/scripts/8frame-*.min.js`, aframe-extras, xrextras, engine) |
| `frontend/package.json` | `@8thwall/engine-binary`, `@8thwall/xrextras` versions |
| `frontend/src/components/ArScene.vue` | base scene: `#host-lights`, camera, raycaster, fog, gesture detector |
| `frontend/src/components/ArModule.vue` | module loader: manifest fields, registration, mount root, unmount |

If something changed, update the previews (`lib/preview*.ts`, `ar.html`,
`index.html`, `lib/vendor/`), the docs and the line below.

**Last checked:** 2026-11-06, host `master` at `727ea7a` — 8frame 1.3.0,
aframe-extras 6.1.1, `@8thwall/engine-binary` 1.0.0, `@8thwall/xrextras`
1.0.0, `hostLights` supported (PR #4), camera starts at `0 0.35 0.8`,
modules mounted at `0 1.6 -3` (see "Where a module sits").

### Builds

What each build is for, what the host does with a module and how to
upload and register it:
[cross-feature-reference-docs/BUILD-AND-EXPORT-GUIDE.md](cross-feature-reference-docs/BUILD-AND-EXPORT-GUIDE.md).

- `npm run build` → **library** build → `dist-platform/ar-module.js` (`vue` is external, so the module shares the host's Vue runtime via the import map). This is the artifact the host loads. `npm run build:watch` rebuilds it on every save.
- `npm run build:ar` → **standalone AR app** → `dist-ar/` (`index.html` + bundled module + the engine copied into `external/xr/`). A self-contained, deployable page for testing the module in AR on a device — serve `dist-ar/` over https and open it on a phone.

## How it works

- Vite is configured in **library mode**, so the build output is a single ES module.
- `vue` is marked **external** in the library build (`rollupOptions.external: ["vue"]`), so `import { ... } from "vue"` stays a bare import in the emitted `ar-module.js` — Vue is *not* bundled. At runtime the host's **import map** resolves that bare `vue` to a single, host-served Vue ESM build. Because the host app imports `vue` from the same import map, the module and the host share **one** Vue instance — no second copy, and no hand-maintained re-export shim that has to track Vue's public API.
- `a-*` tags are registered as custom elements so A-Frame markup compiles without warnings.
- The host (`frontend/index.html`) declares `<script type="importmap">{ "imports": { "vue": "…/vendor/vue.runtime.esm-browser*.js" } }</script>` and externalizes `vue` in its own build (`frontend/vite.config.ts`), so both sides resolve `vue` to that one file.

## The `arModule` prop

Every ArModule receives the database record as a prop:

```ts
interface ArModuleData {
  id: string;
  text: string;
  url: string;
  author: string;
  location: { lat: number; lng: number };
  assets: { id: string; src: string }[];
  components: { name: string; url: string }[];
  createdAt: string;
}

defineProps<{ arModule: ArModuleData }>();
```

Use it to drive your scene content (e.g. show the author's name, position by location, etc.).

## Bundling assets with the module

Drop any binary asset (`.glb`, `.gltf`, `.png`, `.mp3`, …) into `src/assets/`. The build pipeline picks them up automatically — no manual wiring:

- Each file becomes a manifest entry. The **file name without its extension is the asset id**, and it is hosted at `assets/<filename>`. So `src/assets/model.glb` → `{ id: "model", src: "assets/model.glb" }`.
- Reference it from `ArModule.vue` by id: `<a-entity gltf-model="#model">`. Do **not** declare your own `<a-assets>` — the host (and the dev preview) inject the manifest's assets into the scene's `<a-assets>` before your module mounts.
- `npm run build` copies every asset into `dist-platform/assets/` and writes `dist-platform/manifest.json`. The emitted `dist-platform/ar-module.js` also re-exports the same manifest, which is what the host reads via `mod.manifest`.
- `npm run dev` serves the assets at `/assets/*` and injects them into the standalone preview scene, so models resolve exactly as they will in the host.

`src/assets/` is empty in the template, because everything in it ships with the module. The examples' demo files are in `examples/assets/` and `examples/image-targets/`; copy only what you use. They are generated by `scripts/generate-demo-assets.ts`. Only add assets you have the rights to.

When you publish, host the **whole `dist-platform/` folder together** so the relative `assets/…` paths in the manifest resolve next to the page that loads them.

### Compressing assets before shipping

`npm run compress-assets` — an interactive script (`scripts/compress-assets.ts`)
that mesh-compresses `.glb` files (`gltfpack -c`) and re-encodes textures
(embedded or standalone) as WebP, with a resize option. Every pristine
original is preserved in `uncompressed-assets/` (gitignored, local-only)
before anything is touched, so re-running with different settings is
always safe. See
[cross-feature-reference-docs/ASSET-COMPRESSION-GUIDE.md](cross-feature-reference-docs/ASSET-COMPRESSION-GUIDE.md)
for the full picture, including two non-obvious pitfalls it exists to
avoid (silent geometry corruption from re-compressing an already-compressed
`.glb`, and `gltfpack` relocating mesh names to a different node than
where existing code expects to find them).

## The manifest: components, camera & image targets

Everything the host needs to set up your scene travels in **one object** — the
`manifest` your bundle exports (the host reads it as `mod.manifest` right after
`import(url)`). `src/manifest.ts` is where you author it:

```ts
export const manifest: Manifest = {
  assets: assetManifest.assets,          // auto-derived from src/assets/
  camera: {                              // applied to the scene's <a-camera>
    "look-controls": "enabled: false",
    "wasd-controls": "acceleration: 30"
  },
  components: {                          // automatic, see below
    ...usedComponents
  },
  imageTargets: [videoTarget],           // 8th Wall image-target JSON
  hostLights: false                      // optional, see below
};
```

### Components register automatically

Every file in `src/a-frame-components/` with a default export is an A-Frame
component **named after its file** (`place-in-front.ts` → `place-in-front`).
The ones your module actually uses — found by name in `ArModule.vue` and the
files it imports, plus whatever those components use themselves — are
bundled and registered automatically (`virtual:used-components`, built by
`scripts/used-components.ts` in `vite.config.ts`). Same in `npm run dev`,
`npm run dev:ar` (recomputed when you edit `src/`, the page reloads) and
`npm run build`. Unused components are neither bundled nor registered, which
keeps the module small and keeps it from claiming component names in the
shared host scene (first registration of a name wins there).

So to use a component: copy its file into `src/a-frame-components/` and put
its name on an entity — nothing to import or list in `manifest.ts`. Files
without a default export (`*-shared.ts`, `sound-unlock-audio.ts`, …) are
helpers and are never registered. Only a component that must be registered
under a different name than its file, or whose name is assembled at runtime
(`"my-" + kind`, which the scan can't see), needs a manual entry after the
spread in `manifest.ts`:

```ts
components: { ...usedComponents, "my-name": myComponent }
```

### Host lights: `hostLights`

The host keeps two lights on in its scene (ambient `#BBB` and a directional
light at 0.6, grouped as `#host-lights` in `ArScene.vue`), and every light a
module brings adds on top of them. A module that brings its complete lighting
sets `hostLights: false`: the host then switches its own lights off while the
module is shown (the group is hidden — three.js skips invisible lights,
shadows included) and back on at unmount. Default `true` = host lights stay
on, which a module without lights of its own needs. The module contains no
code for this; both previews have the same `#host-lights` group and apply the
field the same way (`applyHostLights` in `lib/host-runtime.ts`).

**Convention: `hostLights: false` only in a module with lights of its own.**
Set it only when the scene itself contains lights (`<a-light>`, a `light`
component, or three.js lights created by a component — `xr-light` only
drives an existing light, it isn't one). A module
without lights would turn dark in the host — unlit materials and the camera
image aside — so it keeps the default and the host lights. When a module
loses its last light, remove `hostLights: false` too.

### Camera keys are restricted

`camera` is typed as `CameraSettings`, not the full set of `<a-camera>` attributes:
`id`, `position`, `cursor`, and `raycaster` (`CAMERA_PROPS_FORBIDDEN` in `lib/manifest.types.ts`)
are **excluded at the type level** — `manifest.ts` won't compile if you set them. The
host owns those four because it places and interacts with the *one* shared `<a-camera>`
in its own scene (see `frontend/src/components/ArScene.vue`): it sets `id="camera"` so
other code can look the element up, `position` to locate the viewer, and `cursor`/`raycaster`
to make posts tappable. A module that overrode them would relocate or break interaction
with the host's UI for every other module sharing that camera. Anything else on
`<a-camera>` — `rotation`, the built-in `camera` component (fov/zoom/near/far/active),
`look-controls`, `wasd-controls` — is fair game and gets applied (and reverted on
unmount) as shown above.

The scene's `<a-camera>` always has `id="camera"` — in the host, and in both local
previews (`lib/preview.ts`, `lib/preview-ar.ts`), which construct their own `<a-camera>`
to match. Query it with `document.querySelector("#camera")` (or `a-camera`, since
there's only ever one) if a component needs to reach it directly.

### Where a module sits: host camera and module root

Summary below; the full picture — spaces, units, every environment, the
history of the offset, measurements, checklist — is in
[cross-feature-reference-docs/SCENE-PLACEMENT-GUIDE.md](cross-feature-reference-docs/SCENE-PLACEMENT-GUIDE.md).

The host starts the shared `<a-camera>` at `0 0.35 0.8` and mounts every
module inside an entity at `0 1.6 -3` (`AR_MODULE_POSITION` in
`ArScene.vue`). Positions in `ArModule.vue` are therefore relative to that
root — not to the camera, and not to the floor: the root sits 1.25 above
and 3.8 in front of the camera's starting point.

8th Wall uses the camera's start position as its starting pose (measured in
a headless `dev:ar` session: `0 0.35 0.8` stays put; with `0 0 0` the engine
substitutes its own height of about 2, which put modules ~1.65 lower
relative to the viewer than in the app). So `npm run dev:ar` starts its
camera at the same `0 0.35 0.8` and wraps the module in a `module-root` at
`0 1.6 -3` (`lib/preview-ar.ts`) — same relative placement as the host.
`npm run dev` (VR/desktop, no 8th Wall) is not matched: camera at `0 0 0`,
module at `0 1.5 0`. Check placement in `dev:ar`.

8th Wall's floor is world `y = 0`, so local `y = 0` in `ArModule.vue`
floats 1.6 units above it — above the viewer's head. And scene units aren't
metres: with 8th Wall's `responsive` scale, the camera's start height (0.35)
stands for the phone's real height.

- **Content on the floor: `place-in-front`.** The template's start scene
  already wraps its content in
  `<a-entity id="scene-root" place-in-front="referenceHeight: 1.5; distance: 2">`
  ([Placement](guides/PLACEMENT-FEATURE-GUIDE.md)): it puts its entity on
  the world floor in front of the viewer and converts that pose through the
  parents' matrices, so children's `y = 0` is the floor under any root
  offset (headless check: `scene-root` and the ground plane at world
  `y = 0` in `dev:ar` and `dev`). `referenceHeight: 1.5` scales it as if
  authored for a camera 1.5 above the floor, so units inside are roughly
  metres and `distance: 2` is about 2 m. Put your scene inside it. Don't
  compensate with fixed offsets (`position="0 -1.6 0"`) — they're right for
  one root only (`npm run dev` already differs).
- **Image-target content: `world-origin`.** `xrextras-named-image-target`
  sets its own local pose from the tracked image, so any offset above it
  moves the content off the image. Wrap it in
  `<a-entity world-origin>` (`src/a-frame-components/world-origin.ts`),
  which sets its transform to the inverse of its parents' and so sits at the
  world origin whatever the root is. Checked headless in `dev:ar` with the
  host's offset, without it (as if the host dropped it), and without the
  component (content off the image — which is why `dev:ar` applies the
  offset to every module, like the host, instead of skipping it for
  image-target modules as it did before). Details:
  [Image Tracking](guides/IMAGE-TRACKING-FEATURE-GUIDE.md#required-runtime-setup--get-this-wrong-and-it-fails-silently-or-crashes).
  Earlier project branches (`animationssystem-wanderer`,
  `material-shader-showcase`, `zufallsverteilung-lod`) use a fixed
  counter-offset `<a-entity position="0 -1.6 3">` instead — right for the
  current host, wrong if it ever drops the offset; replace it with
  `world-origin` when such a branch is touched again.

Before mounting your component, the host (`frontend/src/components/ArModule.vue`)
walks the manifest and, in order:

1. **`components`** — registers each `name → definition` via `AFRAME.registerComponent`
   (skipping any already registered). Definitions are **bundled into your module**
   — author them in `src/a-frame-components/`; the ones the module uses are
   added to `components` automatically (see above).
   They no longer need to self-register or be hosted as separate URLs.
2. **`camera`** — applies each attribute to the scene's `<a-camera>`, remembering
   the previous values.
3. **`imageTargets`** — feeds the array to `XR8.XrController.configure({ imageTargetData })`.
   Drop the JSON the 8th Wall target tool produces (plus its images) into
   `src/image-targets/` and `import` it into `manifest.ts`.
4. **`assets`** — injects each `{ id, src }` into `<a-assets>` as an `<a-asset-item>`.

On unmount the host tears all of this back down: it removes the injected assets,
**restores the camera** to its previous attributes, and clears the image targets
(`imageTargetData: []`). Registered components stay registered — A-Frame has no
deregister — which is why registration is guarded against duplicates.

The two local previews (`npm run dev` / `npm run dev:ar`) mirror this exact wiring
via `lib/host-runtime.ts`, so components, camera settings, image targets,
host lights and assets behave the same in preview as in the host. Where the
module is mounted and where the camera starts is mirrored by `dev:ar` only
(see "Where a module sits").

## Caveats

- `vue` is external, so nothing Vue-related is bundled into `ar-module.js` — any Vue API works (nothing to enumerate), and the whole runtime is downloaded once by the host and shared.
- The host **must** ship an import map that resolves `vue` before any ArModule loads (and must externalize `vue` in its own build so it uses that same instance). If that wiring ever moves, every published module breaks; treat it as a stable contract.
- Cross-origin loading: the host fetches your module via `import(url)`. The server hosting the JS must send appropriate CORS headers and the correct `Content-Type: text/javascript` (or `application/javascript`). Vite's dev server does this by default.
- Don't add Vue to `dependencies`. It's a peer of the host runtime; bundling it would create a second Vue instance and break vnode rendering.
- A `<style>` block in `ArModule.vue` won't apply in the host. The library build extracts SFC styles into a separate CSS file next to `ar-module.js`, but the host only `import(url)`s the JS — it never loads that CSS. This rarely matters (an AR module drives a 3D A-Frame scene, not styled DOM), but if you need visible styling, set it on the scene entities (materials, attributes) rather than via CSS.
