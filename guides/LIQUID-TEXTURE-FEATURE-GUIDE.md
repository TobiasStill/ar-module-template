# Liquid-texture feature guide

A generic, reusable procedural "liquid ink" texture generator: fbm-driven
marbling that optionally reveals a target image (attracted toward its dark
areas, following its edges) as `pulse()` is called, with a cellular bubble
decoration and swirl distortion around the last pulse point. Renders once
per instance to an offscreen texture any material can sample — not tied to
`mirror-shard` or any other consumer, despite being salvaged alongside it.

Salvaged and substantially simplified from `Zhichang_module`'s
`dms-mirror-shards.ts` (`DMS_LIQUID_FRAGMENT_SHADER`). See
[3. Under the hood](#3-under-the-hood) for what changed and why — in short,
the source computed **two** competing inks (a hardcoded "democratic blue"
vs. "authoritarian orange" pair, each racing to fill the canvas from its own
target image, blended through a "conflict zone") as bespoke narrative
content for one specific art installation. This keeps the actually generic
technique — marbling, swirl, single-target attraction, cellular decoration —
and drops the two-target political narrative, exposing one target + a
3-stop customizable palette instead.

Files:

```
src/a-frame-components/liquid-texture.ts
examples/liquid-texture-usage.html   # scene wiring + full attribute reference
examples/mirror-shard-liquid-texture-scene.html # combined with mirror-shard,
                                  # recreating the original Zhichang_module
                                  # scene as closely as this system allows
```

No bundled data/assets — the (optional) target image is supplied by
whatever project uses this, via the `target` selector attribute, exactly
like any other `src/assets/`-sourced `<img>`.

## 1. Step-by-step: adding this to a new project

1. **Copy the file** — `liquid-texture.ts` — into your project's own
   `src/a-frame-components/`. No path changes, no data files to bring
   along.

2. **Register it** in your project's `src/manifest.ts`:

   ```ts
   import liquidTexture from "./a-frame-components/liquid-texture";

   export const manifest: Manifest = {
     assets: assetManifest.assets,
     components: {
       // ...whatever you already have...
       "liquid-texture": liquidTexture
     }
   };
   ```

3. **Use it standalone or as a texture source** — see
   [2. Entities & attributes](#2-entities--attributes) or
   `examples/liquid-texture-usage.html`. Standalone, put it on any entity
   and read `getTexture()` yourself (see the exported
   `createLiquidSampleMaterial()` helper for a ready-made way to display
   it). As a texture source for another component, see how
   `mirror-shard.ts` consumes it via a `liquidTarget` selector — grab the
   target's `liquid-texture` component instance and call `.getTexture()`.

4. **Add a target image, if you want one** — drop an image into
   `src/assets/` and reference it via the `target` selector attribute
   (`target: #myImage`). Entirely optional — see
   [2](#2-entities--attributes) for the built-in fallback. Two real example
   textures already ship for this purpose — see
   [3](#3-under-the-hood)'s "Bundled example textures" note — so
   `examples/liquid-texture-usage.html` demonstrates `target` against an
   actual image, not just a placeholder id.

5. **Build and test** — `npm run build`, then `npm run dev`.

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `target` | selector | — | Optional `<img>` asset the ink is attracted toward and reveals over time. Omit for a self-contained procedural marbling look — **this is the built-in fallback, not a degraded mode**; the fbm/cellular/swirl terms all work without a target, only the image-attraction terms are inert without one. |
| `colorLight` | color | `#f4fcff` | Palette's palest stop. |
| `colorMid` | color | `#00b7e6` | Palette's mid stop. |
| `colorDark` | color | `#001f66` | Palette's darkest stop. |
| `quality` | string | `'auto'` | `'auto'` \| `'high'` \| `'balanced'` \| `'low'`. `'auto'` picks `'balanced'` on a probable mobile device, `'high'` otherwise — checked once at `init()`, not per frame. Trades fbm detail / cell count / render-target resolution / refresh rate for GPU cost. |
| `opacity` | number | `0.88` | Overall alpha multiplier on the rendered ink. |

```html
<a-entity liquid-texture="target: #posterImage; colorLight: #fff8f0; colorMid: #ff8a00; colorDark: #4a1600"></a-entity>
```

Methods:

- `pulse(x?, y?, strength?)` — nudges the ink toward fully revealed and
  swirls it from `(x, y)` (both normalized `0..1` texture space, default
  `0.5`/`0.5` — the centre — if omitted). `strength` (default `1`, range
  ~0.25-2) scales how much this one pulse moves the needle.
- `reset()` — fades the revealed ink back to nothing and clears any
  in-flight ripple.
- `getTexture()` — returns the rendered `THREE.Texture` for any other
  material to sample.

Tap-to-pulse: like `mirror-shard`, this listens for the standard `click`
event and needs `class="cantap"` on its own entity to receive one — see
`MIRROR-SHARD-FEATURE-GUIDE.md`'s incompatibilities section for a caveat on
that specific event (applies identically here).

## 3. Under the hood

### What changed from the source, and why

The source shader (`DMS_LIQUID_FRAGMENT_SHADER`, ~600 lines) modeled two
inks simultaneously: a "blue" one attracted to one target image, an
"orange" one attracted to a second target image, a continuous "polarity"
value tracking which one currently "wins," and an explicit conflict-zone
blend where the two visually fight over the same territory. This is
genuinely bespoke narrative content — the whole mechanic only makes sense
paired with the specific two-choice political metaphor the source
installation was built around ("democratic blue" vs. "authoritarian
orange"). Porting it verbatim into a universal template would be closer to
keeping another fork's specific artwork than to porting a technique — the
same category of thing `ADDING-FEATURES-WORKFLOW.md` already says not to do
with project-specific assets, just expressed in shader math instead of an
image file.

What's actually generic and worth keeping: fbm-based marbling, swirl
distortion around a pointer/pulse point, attraction toward a target image's
dark areas and edges (the *mechanism*, not the specific choice of which
image), and the cellular bubble decoration. This port keeps all of that,
reduced to a single target + a single continuous "revealed" amount
(`uFinal`, the source's per-ink `state.final` without the polarity split),
recoloured through a plain 3-stop palette (`colorLight`/`colorMid`/
`colorDark`) instead of two hardcoded 5-stop palettes.

Concretely dropped: `uPolarity`/the whole blue-vs-orange split
(`blueDominance`/`orangeDominance`/`blueWeight`/`orangeWeight`/
`blueControl`/`orangeControl`), the second target/`uAuthorityTarget` and
its own edge-detection pass, the `authorityTarget()` procedural SDF
fallback shape (a stand-in illustration used when the second target image
wasn't loaded — narrative-specific by construction, not a generic
fallback), and the `conflict`/`orangeWins`/`sharedPigment` blend logic that
only has meaning with two inks. `pigmentBoost`/`hash`/`noise`/`fbm`/`swirl`/
`cellRing`/`cellFill` are unchanged (already generic).

### Bundled example textures

`src/assets/liquid-texture-target-1.webp` and `liquid-texture-target-2.webp`
(the source's `single-liquid-final-target.webp` and
`authoritarian-orange-final-target-v1.webp`, renamed to this template's
`<component>-<name>` convention) are real, working example images, brought
in specifically so `examples/liquid-texture-usage.html` can demonstrate the
`target` attribute against an actual photo rather than a placeholder id
that doesn't resolve to anything. This is a deliberate, narrow exception to
`ADDING-FEATURES-WORKFLOW.md`'s "don't bring project-specific artistic
content into the template" guidance from the earlier features' guides — the
two illustrations themselves are generic enough (abstract silhouette
scenes, no text or explicit political symbols) to serve as reusable *demo*
content once separated from the source's "democratic blue vs. authoritarian
orange" framing and file names, unlike e.g. the sound feature's Wand models
or mirror-shard's own source narrative shader math, which weren't brought
over at all. Treat them as placeholder/demo assets a real project replaces
with its own imagery, same as any other example content in this template —
not as this component's permanent default look.

Both are ~1100-1450px WebP, already reasonably sized for a texture (this
component's own render target tops out at 1024px even at `quality: high`),
so no further resizing was done — but a real project shipping its own
target image should size it to roughly the render-target resolution it'll
actually be sampled at, not larger, the same as any texture.

### Offscreen rendering, throttled

Like the source, this renders to a `THREE.WebGLRenderTarget` via a small
orthographic-camera scene (a fullscreen quad running the fragment shader),
throttled by the resolved quality profile's fps — not every frame. The
result (`state.target.texture`) is what `getTexture()` returns; it's a
stable object reference from construction, so a consumer can grab and hold
it even before the first render happens (worst case, one frame of blank
texture — imperceptible).

### The renderer-state save/restore around the offscreen pass — kept, not simplified away

The offscreen render temporarily calls `renderer.setRenderTarget(...)` and,
if the renderer has WebXR active, sets `renderer.xr.enabled = false` for
the duration (restoring both immediately after). This is inherited
unchanged from the source. **This was deliberately not "fixed" or removed**
— see [4](#4-incompatibilities-risks--troubleshooting) for why it's a real,
documented risk rather than a solved problem.

## 4. Incompatibilities, risks & troubleshooting

### Shared-renderer risk from the offscreen render pass (read this before shipping multiple co-mounted modules using this feature)

Every module mounted in this template's host shares **one** `WebGLRenderer`
(the same reason `CAMERA_PROPS_FORBIDDEN` exists for the shared camera).
This component's `tick()` briefly toggles that shared renderer's active
render target and (if WebXR is active) `renderer.xr.enabled`, then restores
both synchronously before returning. In isolation this is safe — the
toggle is fully bracketed and nothing else runs on the main thread between
the disable and the restore in JavaScript's single-threaded execution
model. It has **not** been verified against every way A-Frame/8th Wall
might itself schedule rendering around a component's `tick()` (e.g.
render-loop ordering across multiple systems), so:

- If a project needs multiple co-mounted modules each using
  `liquid-texture` (or `mirror-shard`, which doesn't do this itself but
  bundles this component when `liquidTarget` is used), each instance does
  its own separate offscreen pass, each with its own bracketed toggle —
  the toggles don't overlap in time (JS is single-threaded, `tick()` calls
  run one at a time), but the *cumulative* cost of N separate offscreen
  passes per frame is real and additive.
- This is the same category of risk flagged (but not resolved) for the
  sound feature's cross-module interactions: inherited from the source
  branch's own working code, kept because there's no verified-safe
  simplification available, not because it's been proven safe in every
  configuration. Test on-device if a project combines several instances of
  this feature.

### Quality/cost knobs, if this needs to be cheaper

`quality: low` roughly halves `fbmSteps`/`cellCount` and drops the
render-target to 512px/30fps vs. `high`'s 1024px/60fps — try that first.
Beyond that, the fragment shader itself (marbling + up to ~14 cellular
bubble evaluations, each involving several `fbm`/`hash` calls) is the
actual cost driver, run once per render-target pixel each time it renders
— not something a schema attribute can reduce further without changing the
visual character.

### No interaction found with other features on this branch

Doesn't touch `object3D.scale` (`ar-button`'s domain), doesn't read
`model-loaded` (`proximity-fade`/`proximity-cutout`'s domain), doesn't
register any A-Frame component name that collides with an existing one.
The only cross-cutting concern is the shared-renderer risk above, which is
about the shared `WebGLRenderer`, not about any other feature's code
specifically.
