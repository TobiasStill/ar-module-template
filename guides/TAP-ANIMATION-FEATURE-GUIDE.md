# Tap Animation feature guide

<!-- overview -->
## Overview

Brings a model to life with a touch. Tap a closed seashell and it opens;
tap a music box and its figure starts to dance — the model plays the
movement that was built into it, together with its sound. It can be a
one-time surprise that stays in its final pose, or something that plays
again on every tap. Until the visitor has allowed sound, taps can be
ignored, so nobody sees the movement without hearing it.

<!-- /overview -->

## Technical summary

Tap a model to play one of its glTF animations — once (it stays at the last
frame, e.g. a shell opening) or on every tap — and start its sound with it;
taps can be gated until audio is unlocked. Applicable to any entity with a
`gltf-model` — see [3. Under the hood](#3-under-the-hood).

<!-- project-specific -->
### Project context: origin

Generalised from #20 Solid Dream Level (`augmented-bahnhofsviertel`: eight
shells that open once on tap and play their sound). `enabled` replaces
that work's global `window.soundUnlocked` flag.

<!-- /project-specific -->

Files:

```
src/a-frame-components/tap-animation.ts
examples/tap-animation-usage.html   # scene wiring + attribute reference
```

No assets. Uses aframe-extras' `animation-mixer` (loaded by the host and
both previews).

## 1. Step-by-step: adding this to a new project

1. **Copy** `tap-animation.ts` into `src/a-frame-components/`.

2. **Nothing to register** — every component file in
   `src/a-frame-components/` is registered automatically under its file
   name as soon as the scene uses it (README, "The manifest"); unused ones
   aren't even bundled. Only a component registered under a different name,
   or one whose name is built at runtime, needs a manual entry in
   `src/manifest.ts`.

3. **Wire the scene** — `tap-animation` on the model, a `sound` on the same
   entity if it should sound (`examples/tap-animation-usage.html`).

4. **Build and test** — `npm run dev` (click the model) or `npm run dev:ar`
   on a phone (tap it).

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `clip` | string | `*` | Clip name (wildcards as in `animation-mixer`). |
| `loop` | string | `once` | `once`, `repeat` or `pingpong`. |
| `clampWhenFinished` | boolean | `true` | Stay on the last frame. |
| `once` | boolean | `true` | Only the first enabled tap plays. |
| `sound` | boolean | `true` | Also (re)start the entity's `sound`. |
| `enabled` | boolean | `true` | Taps are ignored while `false`. |

Event **out**: `tap-animation-played`.

## 3. Under the hood

The tap is the host's cursor `click` on `.cantap` (the class is added; the
host's and both previews' raycaster target `.cantap`). On a tap it removes
and re-sets `animation-mixer` with the configured clip/loop/clamp — setting
it fresh restarts the clip from the first frame — and stops/starts the
entity's `sound`. `enabled` gates the taps: set it from the button that
unlocks audio, so the first tap doesn't play a silent animation.

## 4. Incompatibilities, risks & troubleshooting

- **`animation-mixer` / `trim-loop-clip` on the same entity.**
  `tap-animation` owns `animation-mixer` on its entity — don't also set it
  (or [Trim Loop Clip](TRIM-LOOP-CLIP-FEATURE-GUIDE.md)) there.
- **iOS click.** Relies on the host cursor's `click`, which iOS Safari can
  suppress after `xrextras-gesture-detector` handled the touch (see
  [Sound](SOUND-FEATURE-GUIDE.md) §4). Test tap targets on a phone, and
  avoid [Gestures](GESTURES-FEATURE-GUIDE.md) on the same model.
- **Tap also recenters.** With [Placement](PLACEMENT-FEATURE-GUIDE.md)'s
  `tapRecenter`, a tap on the model also re-places the scene — use a
  recenter button instead.
- **Animated skinned meshes** need `no-frustum-cull` (on the module root,
  template baseline) or they vanish while animating.

<!-- project-specific -->
### Project context: Augmented Bahnhofsviertel

On #20 Solid Dream Level the tap worked fine on iPhone despite the iOS
click caveat above.

<!-- /project-specific -->
