# ar-module-template

A starter project for building **ArModule** components — Vue 3 SFCs that are compiled to a single ES module, hosted at any URL, and dynamically loaded into the AR scene at runtime.

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
│   ├── manifest.ts            # the authored manifest: assets + camera + components + imageTargets
│   ├── assets/                 # drop .glb/.png/.mp3/… here — auto-derived into the manifest
│   ├── a-frame-components/     # custom A-Frame components, referenced from manifest.ts
│   └── image-targets/          # 8th Wall image-target JSON + images, referenced from manifest.ts
├── lib/                   # internal plumbing — not meant to be edited by a fork
│   ├── main.ts                # entry: re-exports the SFC as default + the manifest
│   ├── manifest.types.ts      # Manifest/CameraProps/CameraSettings/ManifestAsset types
│   ├── preview.ts             # VR/desktop preview harness (stock A-Frame)
│   ├── preview-ar.ts          # 8th Wall AR preview harness (8frame + engine + xrweb)
│   ├── host-runtime.ts        # shared preview wiring (register components / camera / image targets)
│   ├── frustum-culling.ts     # helper used by src/a-frame-components/no-frustum-cull.ts
│   ├── gltf-meshopt-setup.ts  # patches THREE.GLTFLoader so meshopt-compressed .glb files load
│   ├── vendor/                # vendored meshopt decoder (gltf-meshopt-setup.ts's only dependency)
│   └── virtual-manifest.d.ts  # ambient types for the auto-generated `virtual:ar-manifest`
├── scripts/
│   └── compress-assets.ts     # `npm run compress-assets` — interactive mesh/texture compression
└── uncompressed-assets/   # gitignored, local-only; pristine originals kept by compress-assets.ts
```

## Workflow

1. `cd ar-module-template`
2. `npm install`
3. Edit `src/ArModule.vue` — full SFC with `<template>`, `<script setup>`, `<style>`. The `arModule` prop matches the data shape the host injects.
4. `npm run build` → produces `dist-platform/ar-module.js`, a single ES module that default-exports your component.
5. Host that JS somewhere reachable by the AR app (e.g. `frontend/public/ar-modules/your-module.js`, or any CORS-enabled URL).
6. Insert an `ArModule` record in Mongo whose `url` field points at that JS file.

### Local VR preview during development

- `npm run dev` starts a Vite dev server (with HMR) that mounts `ArModule.vue` standalone inside an A-Frame scene. Open the printed URL in a browser.
- The scene shows A-Frame's built-in **"Enter VR"** button (bottom-right). Any WebXR-compatible HMD (Quest browser, SteamVR, etc.) can enter immersive mode.
- Desktop fallback: WASD to move, mouse drag to look around.
- Mock prop data lives in `lib/preview.ts` — edit it to test different inputs.
- For LAN access (e.g. from a standalone HMD on the same network): `npm run dev -- --host`.

The VR preview loads the host's component runtime from CDN, pinned to the host's versions: **A-Frame 1.3.0** (the version 8thwall's `8frame` is built on), `aframe-extras` (`animation-mixer`, …) and `xrextras` (`xrextras-*`).

Note this mode uses **stock A-Frame, not `8frame`**: 8frame's render loop is driven by the 8th Wall camera engine, so it never paints standalone — fine for a desktop/VR preview that has no camera. Stock A-Frame self-renders and is binary-compatible with the same `aframe-extras`/`xrextras`. `xrextras-*` components that depend on the AR engine (e.g. `xrextras-attach` to a tracked target) simply no-op here. For a true 8th Wall AR preview, see below.

### 8th Wall AR preview (camera + world tracking)

- `npm run dev:ar` runs the preview against the **full host runtime** — `8frame` + `aframe-extras` + `xrextras` + the 8th Wall engine (`xrweb`) — so the module renders in real camera AR, identical to production. Mock prop data lives in `lib/preview-ar.ts`.
- The engine itself isn't on a public CDN: it's installed via the `@8thwall/engine-binary` dev-dependency and copied into `/external/xr/` by `vite-plugin-static-copy` (exactly as the host does). `npm install` puts it in place.
- **HTTPS is required for the camera** on any non-`localhost` origin. `dev:ar` serves over https (`@vitejs/plugin-basic-ssl`) and binds all interfaces (`--host`), so you can open the printed LAN URL on a phone (accept the self-signed cert). 8th Wall's SLAM/world-tracking needs a phone's rear camera + IMU — a laptop webcam works for a quick sanity check but won't track.

### Builds

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
  components: {                          // name → AFRAME component definition
    "no-frustrum-cull": noFrustrumCull
  },
  imageTargets: [videoTarget]            // 8th Wall image-target JSON
};
```

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

Before mounting your component, the host (`frontend/src/components/ArModule.vue`)
walks the manifest and, in order:

1. **`components`** — registers each `name → definition` via `AFRAME.registerComponent`
   (skipping any already registered). Definitions are **bundled into your module**
   — author them in `src/a-frame-components/` and import them into `manifest.ts`.
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
via `lib/host-runtime.ts`, so components, camera, and image targets behave the
same in preview as in the host.

## Caveats

- `vue` is external, so nothing Vue-related is bundled into `ar-module.js` — any Vue API works (nothing to enumerate), and the whole runtime is downloaded once by the host and shared.
- The host **must** ship an import map that resolves `vue` before any ArModule loads (and must externalize `vue` in its own build so it uses that same instance). If that wiring ever moves, every published module breaks; treat it as a stable contract.
- Cross-origin loading: the host fetches your module via `import(url)`. The server hosting the JS must send appropriate CORS headers and the correct `Content-Type: text/javascript` (or `application/javascript`). Vite's dev server does this by default.
- Don't add Vue to `dependencies`. It's a peer of the host runtime; bundling it would create a second Vue instance and break vnode rendering.
- A `<style>` block in `ArModule.vue` won't apply in the host. The library build extracts SFC styles into a separate CSS file next to `ar-module.js`, but the host only `import(url)`s the JS — it never loads that CSS. This rarely matters (an AR module drives a 3D A-Frame scene, not styled DOM), but if you need visible styling, set it on the scene entities (materials, attributes) rather than via CSS.
