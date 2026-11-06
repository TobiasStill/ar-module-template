# AR Overlay feature guide

<!-- overview -->
## Overview

Puts flat, screen-fixed buttons and hints on top of the camera picture —
the "Tap to start", "Play" or "Look around" messages a visitor sees before
and while the AR scene runs. They appear only once the scene is loaded and
standing in the room, vanish when tapped, and run whatever should happen
next (start the sound, start a video, …). A small round button in the
corner moves the scene back in front of the visitor if they have wandered
off or it ended up in an awkward spot.

<!-- /overview -->

## Technical summary

A module's 2D UI over the camera image: a centre column of controls (a
hint text, a "Start" or "Play" button, an audio/video unlock button, …)
and an optional recenter button. Waits for the scene's placement if
wanted. Inline styles only, so it looks the same in the host as in the
previews — see [3. Under the hood](#3-under-the-hood).

<!-- project-specific -->
### Project context: origin

Generalised from the Augmented Bahnhofsviertel ports
(`augmented-bahnhofsviertel`: `LegacyOverlay.vue`), which recreated the old
8th Wall projects' `ui.js`/`ui.css` look. Those projects waited for 8th
Wall's `realityready` before showing their UI — the placement wait described
in §3 takes that role here.

<!-- /project-specific -->

Files:

```
src/ArOverlay.vue               # the Vue component
src/ar-overlay-icons.ts         # inline SVG icons + actionButtonHtml()
examples/ar-overlay-usage.html  # copy/paste integration + props reference
```

No assets, nothing to register in `manifest.ts` (it's a Vue component, not
an A-Frame component). Pairs with [Placement & Recenter](PLACEMENT-FEATURE-GUIDE.md).

## 1. Step-by-step: adding this to a new project

1. **Copy the files** — `ArOverlay.vue` and `ar-overlay-icons.ts` — into
   your project's `src/`.

2. **Import and render it** in `src/ArModule.vue`, as a sibling of the
   root `<a-entity>` (it's 2D UI, not part of the 3D scene), next to the
   loading bar/spinner — see `examples/ar-overlay-usage.html` for the
   `<script setup>` part (the `controls` array) and the `<template>` part.

3. **Optional: link it to a placed scene** — give the `place-in-front`
   entity an id and pass it as `place-target`.

4. **Build and test** — `npm run dev:ar`: the controls appear once the
   assets have loaded and (with `place-target`) the scene has been placed;
   a tapped control disappears and runs its `onClick`.

## 2. Entities & attributes

Props:

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `controls` | `ArOverlayControl[]` | `[]` | Centre column, top to bottom. |
| `placeTarget` | string | `""` | Id of a `place-in-front` entity: the overlay waits for its first placement, the recenter button re-places it (`place-in-front-place`). |
| `recenterButton` | boolean | `false` | Show the recenter button (top right, 64 px from the top). |
| `ready` | boolean | `true` | Overlay hidden while `false` — typically `:ready="assetsLoaded"`. |

Emits `recenter` on every recenter tap (with or without `placeTarget`).

`ArOverlayControl`: `id` (key), `html` (trusted static markup — text,
inline `<svg>`, `actionButtonHtml("Label", "#colour")` for a filled button
label), `onClick?`, `keep?` (stays after the tap; default: disappears),
`variant?` (`"action"` default, `"hint"` adds a close icon).

```vue
<ArOverlay place-target="my-scene" :controls="controls" recenter-button :ready="assetsLoaded" />
```

## 3. Under the hood

**Why inline styles.** The library build extracts a module's `<style>`
block into a separate CSS file, but the host only `import()`s the JS — it
never loads that CSS (README "Caveats"). Every style is therefore a bound
style object.

**Waiting for placement.** With `placeTarget` the overlay listens for
`place-in-front-placed` on that entity (and checks `placed` once on mount,
in case placement already happened), so a "Start" hint never shows before
the scene exists.
Recenter dispatches `place-in-front-place` to the same entity, re-placing
only this module.

**Position.** Centre column at 30 % from the top; recenter button at
`top: 64px; right: 15px` — the host's own recalibrate-north button is
fixed at top/right 16 px (`ArScene.vue` in ar-demo-backend), its module
menu top left, its GPS hint top centre.

**Icons as strings.** Everything in `src/assets/` is shipped as a manifest
asset and injected into the host's `<a-assets>`; inlining the SVGs keeps
them out of that list and needs no raw-import build config.

## 4. Incompatibilities, risks & troubleshooting

- **Taps on the overlay don't count as scene taps** — the tap detector of
  [Placement](PLACEMENT-FEATURE-GUIDE.md) only reacts to the canvas, so a
  button never triggers `tapRecenter` or `tap-place-cursor`.
- **Audio/video unlock must happen inside the tap.** iOS only allows
  starting audio/unmuted video synchronously inside a user gesture — call
  `play()`/`playSound()` directly in a control's `onClick`, not after an
  `await` or timeout. (The [Sound](SOUND-FEATURE-GUIDE.md) feature's
  unlock overlay is the dedicated tool for ambient audio.)
- **`html` is rendered with `v-html`** — only pass static markup written by
  the module author, never text from the `arModule` record or other
  runtime data.
- **Overlapping host UI.** Keep custom absolutely positioned elements out
  of the top-left (module menu), top-centre (GPS hint) and top-right 60 px
  (recalibrate button) of the screen.
- **Several overlays.** Each `ArOverlay` is independent; two of them with
  `recenterButton` would stack at the same spot — use one per module.
