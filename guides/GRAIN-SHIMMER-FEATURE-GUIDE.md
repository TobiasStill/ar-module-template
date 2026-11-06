# Grain Shimmer feature guide

<!-- overview -->
## Overview

Gives a model a grainy, glittering skin. As the visitor walks around or the
object turns, tiny specks on its surface flicker and sparkle — like
sugar crystals, sand or spray paint catching the light. It works with the
grain already painted into a model's textures, and can add its own fine
grain on top for smooth surfaces. Optionally the grain trickles even when
nothing moves, like the noise of old film.

<!-- /overview -->

## Technical summary

A grainy surface that sparkles as the viewer or the model moves, available
for any model: textures sampled without mipmaps, plus optional grain added
in the shader (fixed to the surface, or trickling like film grain).
Applicable to any entity with a mesh — see
[3. Under the hood](#3-under-the-hood).

<!-- project-specific -->
### Project context: origin

An original feature built from an analysis of #20 Solid Dream Level
(`augmented-bahnhofsviertel`), whose look it reproduces (see §3).

<!-- /project-specific -->

Files:

```
src/a-frame-components/grain-shimmer.ts
examples/grain-shimmer-usage.html   # scene wiring + attribute reference
```

No assets.

## 1. Step-by-step: adding this to a new project

1. **Copy** `grain-shimmer.ts` into `src/a-frame-components/`.

2. **Nothing to register** — every component file in
   `src/a-frame-components/` is registered automatically under its file
   name as soon as the scene uses it (README, "The manifest"); unused ones
   aren't even bundled. Only a component registered under a different name,
   or one whose name is built at runtime, needs a manual entry in
   `src/manifest.ts`.

3. **Wire the scene** — `grain-shimmer` on the model
   (`examples/grain-shimmer-usage.html`). Grainy textures: `grain: 0`
   (filter only). Smooth textures: the default adds shader grain.

4. **Build and test on a phone** (`npm run dev:ar`) — the effect is the
   movement; a still image only shows the grain.

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `filter` | string | `linear` | `linear` or `nearest`: the model's textures without mipmaps (`nearest` = harder, pixelated); `mipmap`: textures unchanged. |
| `grain` | number | `0.35` | Shader grain strength 0–1 (brightness noise); `0` = no shader change. |
| `grainScale` | number | `300` | Grain cells per local unit, in object space. |
| `animated` | boolean | `false` | Re-seed the grain over time — it trickles even when nothing moves. |
| `speed` | number | `24` | Re-seeds per second when `animated`. |

No events.

## 3. Under the hood

**Where the shimmer comes from.** Take a texture of pixel-fine grain whose
sampler uses `minFilter: LINEAR` — no mipmaps. When the texture is drawn
smaller than it is, each screen pixel samples one grain at random instead
of an average, and with every small movement a different one: the surface
sparkles. With mipmaps the grain would blur into a calm mixed colour.

<!-- project-specific -->
#### Project context: Augmented Bahnhofsviertel

In #20 Solid Dream Level the textures are pixel-fine spray-paint grain
(2000 px) and the glTF sampler says `minFilter: LINEAR`. All the old Cinema
4D exports of the Augmented Bahnhofsviertel works carry that sampler; only
#20's texture content makes it visible.

<!-- /project-specific -->

**`filter`.** Each texture slot (map, emissive, roughness, metalness, AO,
normal, alpha) is cloned — the clone shares the image but has its own
sampler settings — and set to `minFilter` Linear/Nearest with
`generateMipmaps = false`. Without cloning, every other copy of the asset
(or another material using the texture) would change too.

**`grain`.** A shader patch (`onBeforeCompile`) passes the object-space
vertex position to the fragment shader and multiplies the diffuse colour
after `map_fragment` by `1 + (hash(floor(pos · grainScale)) − 0.5) · 2 ·
grain`. Object space makes the grain stick to the model (it sparkles with
movement exactly like texture grain); `animated` changes a seed uniform
`speed` times a second. Strength, scale and seed are uniforms, so changing
them never recompiles; the program cache key is extended with
`|grain-shimmer`.

**Materials are cloned** and the originals restored on `remove()`. The
patch chains an `onBeforeCompile` already on the original material (and its
cache key) — `material.clone()` doesn't copy those, so they're taken over
explicitly. A-Frame primitives load their `material` texture asynchronously
onto A-Frame's own material object; the component re-applies on
`materialtextureloaded`.

## 4. Incompatibilities, risks & troubleshooting

- **Other shader patches.** Dither Material, Proximity Fade/Cutout and
  other `onBeforeCompile` users: this component chains a patch that exists
  on the material *before* it runs. A component that patches *after* it and
  replaces `onBeforeCompile` drops the grain. Set grain-shimmer last, and
  see [cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md)
  on program cache keys.
- **Material swappers.** [Material Properties](MATERIAL-PROPERTIES-FEATURE-GUIDE.md)
  and [`unlit-material`](LOD-BILLBOARD-FEATURE-GUIDE.md) replace materials;
  applied after grain-shimmer they remove it. Add grain-shimmer last.
- **Changing an A-Frame primitive's `material` attribute** later updates
  A-Frame's own material, not the cloned one — remove and re-add
  grain-shimmer after such a change.
- **Aliasing is the point.** Without mipmaps distant textures also flicker
  strongly; on big, far-away surfaces that can look noisy rather than
  sparkly — use `filter: mipmap` with shader grain there.
- **Performance.** The shader patch adds a few instructions per pixel; no
  extra textures or render passes.
