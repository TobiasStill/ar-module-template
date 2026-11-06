# Asset compression guide

<!-- overview -->
## Introduction

Everything a visitor sees in an AR scene — 3D models, their textures,
pictures — has to travel over the mobile network to their phone before
the scene can start. Big files mean long waiting with a loading bar, and
sometimes a phone that runs out of memory. Compression is like packing a
suitcase well: the same things, folded tighter, so they take up much less
space.

For 3D models this happens in two ways. The shape of a model — its
thousands of corner points — is stored with slightly less precision, which
nobody can see but makes the file a lot smaller. And the pictures painted
onto models (textures) are converted into a modern, compact image format
and, if they are larger than a phone screen could ever show, shrunk to a
sensible size.

The template has a small interactive tool that does all of this, always
starting from an untouched original, so packing the same suitcase twice
can never squash its contents. The phone, in turn, needs a matching
"unpacker" to open compressed models — the template installs it
automatically for every module. This guide explains the tool, the
unpacker, and the few pitfalls to know about.

<!-- /overview -->

## About this guide

Not tied to one feature — this is about compressing whatever `.glb` models
and images *any* feature or project scene uses, and about one piece of
runtime plumbing (the MeshOpt decoder patch) every project needs the moment
it ships a single mesh-compressed asset. Read this before compressing
anything in `src/assets/`, and before debugging a `.glb` that suddenly
fails to load or has lost some behavior that used to work.

## 1. Why a MeshOpt decoder patch exists at all

A-Frame 1.3.0 / 8th Wall's bundled `THREE.GLTFLoader` never calls
`setMeshoptDecoder(...)` itself. `gltfpack -c`-compressed `.glb` files use
`EXT_meshopt_compression`, and three.js's own `GLTFLoader` **requires**
that explicit call before it can decode that extension — without it, a
compressed asset fails to load completely (not degraded, not partial —
nothing renders, with a console error). This template patches every
`THREE.GLTFLoader` instance automatically:

- [`lib/gltf-meshopt-setup.ts`](../lib/gltf-meshopt-setup.ts) — wraps
  `THREE.GLTFLoader`'s constructor so every new instance gets
  `setMeshoptDecoder()` called on it. Vendors
  [`lib/vendor/meshopt_decoder.module.js`](../lib/vendor/meshopt_decoder.module.js)
  (from `three@0.137.0`, the version this stack bundles — a self-contained
  ES module, no dependency on the `THREE` global) plus a hand-written
  [`.d.ts`](../lib/vendor/meshopt_decoder.module.d.ts) — the vendored JS has
  no types of its own, and `vue-tsc --noEmit` fails outright
  (`TS7016`) without one — don't drop the `.d.ts` file when copying this
  elsewhere.
- Called once, unconditionally, from `src/manifest.ts` (`patchGLTFLoaderWithMeshoptDecoder()`),
  the moment the module bundle is evaluated — before any model can load, in
  every context (both local previews and the real host). Idempotent and
  cheap even if a project never compresses a single asset.
- **If `THREE` isn't there yet, it retries every frame** (for up to 30 s)
  instead of giving up. In the real host A-Frame is loaded before any module
  is imported, so the first call patches. But `npm run dev:ar`'s `ar.html`
  injects 8frame dynamically, and the module bundle can evaluate first
  (measured: `manifest.ts` at ~65 ms, `THREE` at ~160 ms). The earlier
  one-shot check then silently skipped the patch, and every compressed
  `.glb` failed in `dev:ar` with "setMeshoptDecoder must be called before
  loading compressed files" — while working in `npm run dev` and the host.
  Models only start loading once the scene and module are up, well after
  8frame, so a patch on a later frame is still in time.

An alternative approach to the same fix is to patch
`GLTFLoader.prototype.load` instead of the constructor and use the real
`meshoptimizer` npm package instead of a vendored file — not what this
template uses, but worth knowing if the vendored-constructor-patch
approach ever needs revisiting.

<!-- project-specific -->
### Project context: earlier projects

The constructor patch was ported directly from `Gyumin_module`/
`Jakob_module`/`Madleen_module`/`Rosa_module` — identical across all four,
already validated across real production deployments. `Fanyu_module`
independently wrote the alternative described above. The missing `.d.ts`
bit two separate branches independently. The retry for a late `THREE` was
found while porting the Augmented Bahnhofsviertel works.

<!-- /project-specific -->

## 2. The compression tool: `scripts/compress-assets.ts`

Run via `npm run compress-assets` — an interactive prompt, not a flag-heavy
CLI invocation. It asks, in order: what to compress (`.glb` models,
standalone images, or both), which specific files (or all of them), WebP
quality (lossless or ~90% lossy), and whether/how to resize textures —
then shows a summary and asks for confirmation before touching anything.

### What it actually does, per file

For a **`.glb` model**:

1. **Mesh compression** — `gltfpack -c -kn -km` against the pristine
   original (see §3). `-kn`/`-km` keep named nodes/meshes/materials —
   without them, gltfpack strips names entirely by default, and
   name-dependent components such as
   [`mesh-render-order`](../guides/MESH-RENDER-ORDER-FEATURE-GUIDE.md)
   stop working.
2. **Name reattachment** — `-kn` alone is not sufficient, and this took
   direct verification to discover: it does NOT keep a name on the
   mesh-bearing node itself. Instead it wraps each named mesh node in a
   new, unnamed-mesh **parent** node that carries the name, leaving the
   original mesh node unnamed as that parent's only child — technically
   satisfying "the name can still be found to transform the group
   externally," but not where any component written against the
   pre-compression convention (a name directly on the mesh node —
   e.g. [`mesh-render-order`](../guides/MESH-RENDER-ORDER-FEATURE-GUIDE.md))
   would look for it. The script walks the compressed document afterward
   and copies each such wrapper's name back down onto its one mesh-bearing
   child (`reattachNamesToMeshNodes()` in the script) — restoring the
   original "name lives on the mesh node" convention so nothing that
   referenced mesh names before compression needs to change after it.
3. **Texture pass** — every texture is resized (per your chosen rule) and
   re-encoded as WebP, via `@gltf-transform`'s `NodeIO`/`compressTexture`,
   **not** another `gltfpack` invocation — see §4 for why that distinction
   is load-bearing, not a style choice.

For a **standalone image** (`.png`/`.jpg`/`.jpeg` sitting directly in
`src/assets/`, not embedded in a `.glb`): resized (per the same rule) and
re-encoded as WebP via `sharp` directly, written as `<name>.webp`, and the
original extension's file is removed from `src/assets/` (it's already safe
in `uncompressed-assets/` — see §3) so the asset scanner doesn't ship both.

### Quality options

- **Lossless** — pixel-identical, format change only. Right default when
  you don't know the source's compression history, or the image has hard
  edges/text/UI icons where lossy artifacts are visible.
- **~90% quality (lossy)** — WebP quality 90. Right for photographic
  source content where a JPEG-like quality level is already acceptable.

### Resize rule

Compares each texture's **shorter** side against a threshold you choose
(no default is assumed — you're asked every run):

- Shorter side `>=` threshold → **halved**, both dimensions, preserving
  aspect ratio (a 4096×2048 texture at threshold 1024 becomes 2048×1024).
- Shorter side `<` threshold → left untouched.

The threshold value itself is inclusive on the "still halve" side — a
texture exactly at your threshold is still halved; only textures strictly
smaller are left alone. Choosing "no resizing" skips this rule entirely
and only re-encodes format/quality.

## 3. `uncompressed-assets/` — why every run starts from a pristine original

Compression always writes its output back to `src/assets/<name>`, under
the exact original filename (`.webp` conversions aside — see above) — but
before touching anything, the tool guarantees an untouched copy exists in
`uncompressed-assets/` (repo root, gitignored, invisible to the Vite build —
its scanner only ever looks at `src/assets/`, so this needs no build
config of its own). On every run, **the pristine copy is always the
source of truth**: if `uncompressed-assets/<name>` already exists, that's
what gets compressed from — never the file currently sitting in
`src/assets/`, which might already be a compressed derivative.

This isn't just tidiness. Running `gltfpack` a *second* time on an
already mesh-compressed `.glb` (e.g. just to convert its textures) silently
re-quantizes geometry that has already been quantized once — quantization
is lossy, so a second pass compounds precision loss on top of the first,
corrupting geometry a little more each time it happens. Texture-only
changes therefore go through `@gltf-transform`'s `NodeIO` with the meshopt
decoder *and* encoder registered, so already-compressed mesh data
round-trips through unchanged while only textures are touched — exactly
what this tool's texture pass does (§2, step 3). Always compressing from a
preserved pristine original makes accidental mesh (re)compression of
already-compressed output structurally impossible — there's no code path
where the tool ever compresses its own prior output.

<!-- project-specific -->
#### Project context: `Gyumin_production` / `Rosa_module`

The double-quantization bug was found (and initially not understood) on
`Gyumin_production`, where 101 already mesh-compressed `.glb`s' textures
were converted to WebP with a second `gltfpack` run; the `NodeIO`
round-trip was the eventual fix there. The stripped-names default of
`gltfpack` is very likely why `Rosa_module`'s shipped `Rosa.glb` had every
node name stripped — see
[MESH-RENDER-ORDER-FEATURE-GUIDE.md](../guides/MESH-RENDER-ORDER-FEATURE-GUIDE.md) §3.

<!-- /project-specific -->

**Practical implication:** re-running the tool on the same file with
different settings (a different quality, a different resize threshold) is
always safe and always starts fresh from the same pristine source — never
compounds with a previous run's result.

## 4. Verify after compressing

- `npm run build` — confirms the compressed asset still loads and typechecks
  cleanly through the full pipeline.
- A visual check — `npm run dev` (or `npm run dev:ar` for anything
  camera/AR-specific) — confirms the model/texture still looks right.
  Nothing in this tool's own pipeline can catch a visual regression (banding
  from over-aggressive quantization, a texture gone too blurry from
  resizing too aggressively) — only look at it.
- If the asset is referenced by mesh/node name anywhere (e.g.
  [`mesh-render-order`](../guides/MESH-RENDER-ORDER-FEATURE-GUIDE.md)),
  confirm those names still resolve — §2's name-reattachment step handles
  this automatically, but a "this specific mesh doesn't respond anymore"
  regression is exactly what a broken name would look like, so it's worth
  knowing where to look first.

## 5. What this tool does not do

- It doesn't touch anything outside `src/assets/` — in particular,
  **never** run this against `src/image-targets/*.jpg`. 8th Wall reads
  those by exact filename/format for tracking; converting or resizing them
  risks breaking image detection.
- It doesn't decimate/simplify mesh geometry (fewer triangles) — only
  quantizes and compresses the geometry gltfpack already has. Simplification
  is a separate, lossier decision this tool deliberately doesn't make for
  you.
- It doesn't run a headless-browser or automated visual regression check —
  see §4 for what to do manually instead.
