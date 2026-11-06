# Architecture guide (how the pieces fit together)

<!-- overview -->
## Introduction

An AR module is built from several tools that each do one job: a 3D
framework describes the scene, an AR engine follows the camera and finds
the floor or a picture, a user-interface framework holds everything
together and connects it to the platform, a build tool packs it into one
file, and the platform itself — a web app with a database behind it —
decides who sees which work where.

This page is the map: which layer does what, how they talk to each other,
what happens on a computer while you work and on the phone when a visitor
opens a work, which file types and languages appear in the project and
where, and the naming rules that make it all fit. The four introductions
next to it (A-Frame, 8th Wall, Vue, writing a component) explain the tools
themselves; this page explains how they're put together here.

<!-- /overview -->

## About this guide

The technical companion to the introductions
([A-Frame](AFRAME-INTRODUCTION.md), [8th Wall](8THWALL-INTRODUCTION.md),
[Vue](VUE-INTRODUCTION.md), [writing a component](WRITING-A-COMPONENT-GUIDE.md)).
Read it once to get the overall picture, and come back when you wonder
where something lives or why a file has the shape it has. Host facts are
from `TobiasStill/ar-demo-backend` at `727ea7a`; versions as in this
template's `package.json` and `lib/vendor/`.

## 1. The layers

From the bottom up, as they run in a visitor's browser:

| Layer | What it does | In this project |
|---|---|---|
| **WebGL / three.js** | Draws 3D graphics in the browser. three.js is the JavaScript 3D library: scenes, meshes, materials, lights, matrices. | Bundled inside A-Frame — never installed separately. Components reach it as `THREE` / `AFRAME.THREE`. |
| **A-Frame** | Describes a three.js scene as HTML: `<a-entity>` elements with components as attributes, an entity-component-system on top of three.js. | 8th Wall's build of A-Frame ("8frame"): **1.3.0** in the host (three.js r137), **1.5.0** in `dev:ar`/`build:ar` (three.js r158), stock A-Frame 1.3.0 in `npm run dev`. |
| **aframe-extras** | Extra A-Frame components; here mainly `animation-mixer` (plays glTF animations). | 6.1.1, from jsDelivr. |
| **8th Wall engine** (`XR8`) | Camera feed, world tracking (SLAM: floor, device motion), image targets, light estimation. | `@8thwall/engine-binary` 1.0.0 (`xr.js`, binary-only licence, includes SLAM). |
| **xrextras** | 8th Wall helper components for A-Frame: loading screen, error screen, gestures, image-target wrapper, video player. | `@8thwall/xrextras` 1.0.0, self-hosted. |
| **Vue 3** | Turns a component file into DOM and keeps it updated from state. Here: the module itself is a Vue component, and so is the host app. | One Vue for host and module, provided by the host through an import map; `vue` is never bundled into a module. |
| **The module** | Your work: `src/ArModule.vue` (scene markup, 2D UI, state), `src/a-frame-components/*.ts` (behaviour), `src/assets/` (models, images, sound). | Built to `dist-platform/ar-module.js` + `assets/`. |
| **The host app** | The AN ALLE! web app: map, posts, drawing, module menu; owns the `<a-scene>`, the camera, the lights and the 8th Wall session, loads one module at a time. | `ar-demo-backend/frontend` (Vue + Vite), served from `https://an-alle.net/`. |
| **Backend** | Stores module records (title, URL, author, location, category, enabled), posts, drawings; answers the app's queries. | `ar-demo-backend` (Node.js, Express, Apollo GraphQL, MongoDB); admin panel at `/admin/`. |

Who owns what, in one line each:

- **Host:** `<a-scene>` (with `xrweb`, gesture detector, fog, renderer
  settings), the one `<a-camera>` (start `0 0.35 0.8`, cursor, raycaster),
  two base lights, its UI, the mount point `0 1.6 -3`.
- **Module:** everything inside that mount point, plus what its manifest
  asks for — components to register, camera settings (except `id`,
  `position`, `cursor`, `raycaster`), image targets, `hostLights: false`,
  assets.

## 2. What happens when

### While you work

```
npm run dev       Vite dev server ─▶ index.html + lib/preview.ts
                  stock A-Frame 1.3.0 (CDN), no camera, no 8th Wall
npm run dev:ar    Vite dev server (https) ─▶ ar.html + lib/preview-ar.ts
                  8frame 1.5.0 + engine + xrextras, the host's base scene
```

Both previews mount `src/ArModule.vue` the way the host does
(`lib/host-runtime.ts`: register components, apply camera settings, image
targets, host lights, inject assets). `dev:ar` also copies the host's camera
start and mount point. Vite recompiles on every save; `.vue` and `.ts` are
translated to JavaScript on the fly.

### When you build

```
npm run build     vue-tsc --noEmit (type check), then vite build (library mode)
                  ─▶ dist-platform/ar-module.js   one ES module, default export =
                                                  the Vue component, plus `manifest`
                     dist-platform/assets/…       copied from src/assets/
                     dist-platform/image-targets/ copied from src/image-targets/
                     dist-platform/manifest.json
npm run build:ar  vite build --mode ar
                  ─▶ dist-ar/                     standalone page: ar.html as
                                                  index.html, Vue bundled, engine,
                                                  8frame, xrextras in external/
```

Two build-time helpers decide what goes in: `virtual:ar-manifest` lists
every file in `src/assets/` as `{ id, src }`, and `virtual:used-components`
(`scripts/used-components.ts`) finds the components `ArModule.vue` actually
uses, so only those are bundled and registered.

### When a visitor opens a work

1. The phone loads the host app from `an-alle.net`; the host loads A-Frame,
   aframe-extras, xrextras and the 8th Wall engine, starts the camera and
   world tracking.
2. The app asks the backend for modules near the visitor; the visitor picks
   one in the module menu (or opens `…/#<moduleId>` directly).
3. The host `import()`s the module's `ar-module.js` from its URL, reads
   `manifest`, registers components, applies camera settings, image targets
   and `hostLights`, injects the assets (URLs resolved against the module's
   folder), and mounts the Vue component inside the entity at `0 1.6 -3`.
4. A-Frame initialises the module's entities and components; the module's
   own components take over from there (placement, interaction, effects).
5. Picking another module unmounts this one: assets, camera settings, image
   targets and light state are restored; registered component names stay.

Details: [BUILD-AND-EXPORT-GUIDE.md](BUILD-AND-EXPORT-GUIDE.md);
placement: [SCENE-PLACEMENT-GUIDE.md](SCENE-PLACEMENT-GUIDE.md).

## 3. Files and formats

| Format | Where | What it is |
|---|---|---|
| `.vue` | `src/ArModule.vue`, `src/ArOverlay.vue` | Vue single-file component: `<template>` (markup), `<script setup lang="ts">` (TypeScript), optional `<style>` (not shipped to the host). |
| `.ts` | `src/a-frame-components/`, `src/manifest.ts`, `src/*.ts`, `lib/`, `scripts/`, `vite.config.ts` | TypeScript. Components, manifest and helpers run in the browser; `scripts/` and `vite.config.ts` run in Node.js during development/build. |
| `.d.ts` | `lib/virtual-manifest.d.ts`, `lib/vendor/*.d.ts` | Type declarations only, no code — tell TypeScript what a module without its own types looks like. |
| `.js` | `lib/vendor/` | Vendored third-party code (8frame, meshopt decoder), not edited. |
| `.html` | `index.html`, `ar.html` | The two preview pages Vite serves. |
| `.html` | `examples/*.html` | Copy-paste reference markup per feature — never served or compiled. |
| `.json` | `src/image-targets/*.json`, `package.json`, `tsconfig.json`, `dist-platform/manifest.json` | Data: image-target descriptors, project config, TypeScript config, build output. |
| `.glb` / `.gltf` | `src/assets/` | 3D models (glTF), optionally mesh-compressed (meshopt). |
| `.png` / `.jpg` / `.webp` | `src/assets/`, `src/image-targets/` | Textures, images, image-target pictures. |
| `.mp3` / `.mp4` | `src/assets/` | Sound, video. |
| `.md` | repo root, `guides/`, `cross-feature-reference-docs/` | Documentation (also published in the wiki). |
| `.sh` | `scripts/` on some project branches | Bash deploy scripts (`deploy:ar`, `deploy:production`). |

Generated, never edited by hand: `dist-platform/`, `dist-ar/`,
`node_modules/`, `uncompressed-assets/` (pristine copies kept by the
compression tool).

## 4. Languages and where they appear

| Language | Where | Notes |
|---|---|---|
| **TypeScript** | `.ts` files, `<script setup lang="ts">` | JavaScript plus types; the types are checked by `vue-tsc` and removed in the build. |
| **Vue template / HTML** | `<template>` in `.vue`, `.html` | Markup. In `ArModule.vue` it mixes A-Frame tags (`<a-entity>`, `<a-box>`, …) with plain HTML for 2D overlays and Vue bindings (`:attr`, `v-if`, `v-for`). |
| **A-Frame attribute syntax** | inside markup | `component="property: value; other: value"`, vectors as `"x y z"`, selectors as `#id`. A tiny language of its own, parsed by A-Frame. |
| **GLSL** | strings inside some components (`dither-material`, `proximity-cutout`, `liquid-texture`, …) | The GPU shader language; injected into three.js materials via `onBeforeCompile`. Only needed for writing shader effects. |
| **CSS** | inline `style` / `:style` only | A `<style>` block is not loaded by the host — style 2D UI inline. |
| **JSON** | config and data files | No comments allowed. |
| **Bash** | deploy scripts, terminal | `npm run …`, `git …`, `rsync …`. |
| **Markdown** | docs | GitHub-flavoured; the wiki renders the same files. |

## 5. Conventions that hold it together

- **A component's file name is its name.** `src/a-frame-components/place-in-front.ts`
  registers `place-in-front`; using the name in markup is enough to bundle
  and register it. Helpers without a default export are never registered.
- **Flat folders.** `src/a-frame-components/` and `src/assets/` are scanned
  non-recursively — no subfolders.
- **Prefixes instead of folders.** A feature's own files share its prefix
  (`sound-*.ts`, `sound-*.webp`); generic building blocks stay unprefixed
  (`world-origin`, `no-frustum-cull`) or use `ar-` (`ar-button`).
- **An asset's id is its file name without extension.** `src/assets/logo.png`
  → `#logo`. The host provides `<a-assets>`; a module never declares its own.
- **Names are kebab-case** — components, attributes, events
  (`place-in-front-placed`, `spawn-sequence-done`); a component's events
  start with its name.
- **First registration wins.** Component names are global for the whole
  host session; don't change a shared component's behaviour under its
  template name.
- **No `AFRAME`/`THREE` at the top level of a file** — only inside
  functions, because the module may be evaluated before A-Frame exists.
- **Placement through `scene-root` / `world-origin`**, never fixed offsets
  ([SCENE-PLACEMENT-GUIDE.md](SCENE-PLACEMENT-GUIDE.md)).
- **Branches:** `feature_template` is the shared library; every project
  works on its own branch or fork made from it.
- **Docs:** one guide per feature in `guides/` (§1 step-by-step, §2
  attributes, §3 under the hood, §4 incompatibilities), cross-feature topics
  in `cross-feature-reference-docs/`; a plain-language overview at the top
  of each and project-specific notes are wrapped in HTML comment markers
  named `overview` and `project-specific` (the wiki uses them; the exact
  syntax is in ADDING-FEATURES-WORKFLOW.md).

## 6. Environments and versions

| Environment | Runs | Versions |
|---|---|---|
| Your computer | Node.js (npm, Vite, TypeScript, scripts), a desktop browser for `npm run dev` | Vite 5, TypeScript 5, Vue 3.4+, vue-tsc 2 (`package.json`) |
| Phone, `dev:ar` / standalone | Safari/Chrome over https from your computer or a server | 8frame 1.5.0 (three r158), engine-binary 1.0.0, xrextras 1.0.0 |
| Phone, host | Safari/Chrome on `an-alle.net` | 8frame 1.3.0 (three r137), aframe-extras 6.1.1, engine-binary 1.0.0, xrextras 1.0.0 |
| Server | Uberspace: static files (host app, modules, standalones, wiki) plus the Node.js backend | — |

Upstream has moved on — A-Frame 1.8 (three r184), Vue 3.5, Vite 8 — but a
module has to match the host, so the template follows the host's versions,
not the newest ones. When reading official documentation, pick the
matching version (A-Frame docs have a version switch: use 1.3.0).
