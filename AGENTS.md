# AGENTS.md — entry point for an AI agent working in this repo

Machine-oriented onboarding doc. Not written for human readability. If you
are an AI agent that has just been pointed at this repository, read this
file fully before doing anything else, then follow the read-order below
before making any change.

## 1. What this repo is

`ar-module-template`: a starter project for **ArModule** components — Vue 3
SFCs (`src/ArModule.vue`) compiled by Vite to one ES module, hosted at a
URL, and dynamically loaded into an AR scene at runtime by an external
host app. The 3D layer is A-Frame + 8th Wall (`xrextras`/XR8) for camera
tracking, image targets, and AR session management. Two preview modes:
`npm run dev` (stock A-Frame, no camera, VR/desktop only) and
`npm run dev:ar` (real 8th Wall AR session, phone camera required) — these
are NOT interchangeable; some features (image tracking) only function in
the latter.

## 2. Branch model — figure out which branch you're on before doing anything

- `main` — clean baseline. Placeholder scene content only.
- `feature_template` — the accumulation branch. Every reusable feature
  ever universalized lives here, additively, on top of `main`. This is
  almost certainly the branch you are on or should be working toward if
  the task is "add/port/document a feature."
- `<Name>_module`, `<Name>_production`, or bare `<Name>` branches (e.g.
  `Jakob_module`, `Gyumin_production`, `Rosa`) — real, one-off student/
  client AR projects. Each one built project-specific features that may
  contain something worth generalizing into `feature_template`. Treat
  these as **read-only source material** — never merge `main` into them,
  never push changes to them, only read/copy from them (`git show
  <branch>:<path>`, `git checkout <branch> -- <path>`).

If the task involves "port X from branch Y" or "bring in a feature," you
are doing what this repo calls **universalizing** — see §3.

## 3. Mandatory read order before modifying anything

1. **This file.**
2. **`ADDING-FEATURES-WORKFLOW.md`** (repo root) — the authoritative,
   numbered, step-by-step process for adding any feature to
   `feature_template`, whether ported from a source branch or written
   original. Read in full before adding, porting, or restructuring a
   feature. It also contains a clearly-marked, skippable "Porting
   subroutine" section that only applies when a source branch is
   involved.
3. **`FEATURE-CATALOG.md`** (repo root) — index of every feature already
   on this branch: one-line description, tags, source branch, link to its
   guide. Check this **before** starting new work, to avoid duplicating
   something that already exists, and to find what to reuse/extend. Has
   its own tag taxonomy and a hand-maintained clustering order (see its
   "Tags" section at the end) — `ADDING-FEATURES-WORKFLOW.md` step 10
   explains how to extend both correctly when adding a feature.
4. **The specific `guides/<FEATURE>-FEATURE-GUIDE.md`** for anything you
   are about to touch, extend, or combine with something else — each
   guide's own §4 ("Incompatibilities, risks & troubleshooting") documents
   real, already-found conflicts with other features. Don't skip this and
   rediscover a known incompatibility from scratch.
5. **`cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md`**
   — read before touching anything that mutates a `material` or
   `renderOrder`: opaque vs. transparent render queues,
   `onBeforeCompile`/`customProgramCacheKey` collisions, material-cloning
   rules, LOD render-order banding. Applies across many features; not
   duplicated in each one. Any other doc that spans multiple features
   without belonging to one lives in this same folder — see §4 and §6.
6. **`cross-feature-reference-docs/ASSET-COMPRESSION-GUIDE.md`** — read
   before compressing/resizing/reformatting anything in `src/assets/`, or
   before debugging a `.glb` that stopped loading or lost some
   name-dependent behavior. Covers `scripts/compress-assets.ts`, the
   MeshOpt decoder patch, and two real, previously-found pitfalls (silent
   geometry corruption from double-compressing, `gltfpack` relocating mesh
   names off the mesh node).
7. **`README.md`** — technical project layout/build details, only if you
   need build-system specifics not covered above.
8. **`QUICK_START_GUIDE.md`** — only relevant if the user is a non-technical
   artist/end-user of the template, not another engineer. Deliberately
   shallow; don't treat it as a technical reference.

## 4. Repo layout

```
src/ArModule.vue              the ONE file a project fork hand-edits with its own scene
src/manifest.ts                additive registry: assets + camera + components + imageTargets
src/a-frame-components/*.ts    every A-Frame component, flat folder, non-recursive scan
src/assets/                    binary assets (.glb/.png/.mp3/...), flat folder, non-recursive scan
src/image-targets/             8th Wall image-target JSON + images, flat, non-recursive scan
src/asset-loading-overlay.ts   template-baseline loading bar/spinner helper (not a component)
examples/*.html                copy-paste reference markup per feature, never compiled/served
guides/*-FEATURE-GUIDE.md      one guide per feature: setup, attributes, internals, incompatibilities
cross-feature-reference-docs/  docs spanning multiple features, not owned by any one (render-order/transparency, asset compression)
lib/                            host/preview plumbing — not edited by a project fork; includes gltf-meshopt-setup.ts
scripts/compress-assets.ts     `npm run compress-assets` — interactive mesh/texture compression tool
uncompressed-assets/            gitignored, local-only; pristine originals kept by compress-assets.ts
*.md (repo root)                general, not-feature-specific docs (this file, workflow, catalog, README, quick-start)
```

## 5. Hard rules — violating these breaks something non-obvious

- **`src/a-frame-components/` and `src/assets/` are scanned
  non-recursively.** A file placed in a subfolder is silently invisible to
  the build. No subfolders, ever, in either. Naming convention instead:
  feature-owned files get a `<feature>-` prefix; genuinely generic/shared
  building blocks stay unprefixed or `ar-`-prefixed, even if only one
  feature currently uses them.
- **Never edit `feature_template`'s `src/ArModule.vue`** to demonstrate a
  feature — it's the one file every fork hand-edits, and must stay
  generic. Add `examples/*.html` instead. The one standing exception is
  genuine template-baseline infrastructure that isn't a pick-and-choose
  feature (e.g. the loading bar/spinner) — that required, and required
  explicit user sign-off before, direct `ArModule.vue` edits.
- **`src/manifest.ts` edits must be additive-only** — new imports, new
  `components` map entries. Never touch or reformat existing entries as a
  side effect of adding a new one.
- **A-Frame component registration dedups by name; first-registered
  wins, silently.** Two features (or a fork + this template) registering
  the same component name with different behavior is a silent bug, not an
  error. Check for name collisions before adding a component.
- **Any component that mutates a loaded `gltf-model`'s material must
  clone it first** (`material.clone()`). glTF assets loaded via
  `gltf-model` share one material object across every instance of that
  asset (e.g. multiple clones from a placement/scatter feature) unless
  cloned. This exact bug (mutate-in-place instead of clone) has been found
  and fixed multiple times across this codebase's history — don't
  reintroduce it.
- **Listen for `object3dset` (filtered to `detail.type === "mesh"`), not
  just `model-loaded`,** in any component that needs to react to a mesh
  becoming available — `model-loaded` is glTF-specific and never fires for
  a plain A-Frame primitive. This exact gap has also been found and fixed
  repeatedly; "applicable to any entity" is a real requirement for
  anything ported into this template, not aspirational.
- **`material.onBeforeCompile` patches need a distinct
  `customProgramCacheKey`.** three.js's default program-cache key ignores
  `onBeforeCompile` edits; without a distinct key, two differently-patched
  materials can silently share one compiled shader program. Multiple
  independent components in this codebase already patch
  `onBeforeCompile` (dithering variants) — see
  `cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md`
  before adding another.
- **The shared `<a-camera>` is host-owned.** `CAMERA_PROPS_FORBIDDEN` in
  `lib/manifest.types.ts` blocks a module from setting `id`/`position`/
  `cursor`/`raycaster` on it at the type level — don't work around this;
  a module doing so would hijack the camera for every other module on
  screen.
- **Stop and present options before implementing anything that:**
  measurably changes a feature's visual/behavioral character (not just
  its code structure); drops something the source branch's real usage
  actually exercises (not already-dead code); or resolves a genuine
  ambiguity about what "universal"/"well-designed" should mean where more
  than one reasonable answer exists. Don't silently make that judgment
  call and explain afterward — the person who asked gets to choose.
  Mechanical/backward-compatible fixes (the two bullets above, code-style
  normalization, dropping provably-dead code) don't need to block on this.
- **Verify with `npx vue-tsc --noEmit` and a full `npm run build`** after
  any non-trivial change — the build exercises the real asset pipeline,
  not just types. Delete the generated `dist-platform/` before finishing —
  gitignored, but don't leave build output sitting in the working tree.
- **Only commit when explicitly told to.** Never commit proactively, even
  after finishing a requested change.
- **`npm run dev` cannot test image targets, camera-dependent behavior, or
  anything requiring a real XR8 session** — it's a stock-A-Frame preview
  with no camera engine at all. Use `npm run dev:ar` (or note the
  limitation explicitly) for anything camera/XR8-dependent.
- **Never mesh/texture-compress an asset that's already compressed** —
  always compress from the pristine original in `uncompressed-assets/`
  (via `npm run compress-assets`, never by hand-invoking `gltfpack`
  directly on a file already in `src/assets/`). Re-running `gltfpack -c`
  on already-quantized geometry silently corrupts it further each time —
  a real bug found on a past project. See
  `cross-feature-reference-docs/ASSET-COMPRESSION-GUIDE.md`. Also never
  run any compression/resize tool against `src/image-targets/*.jpg` —
  8th Wall reads those by exact filename/format for tracking.

## 6. Documentation maintenance obligations

Adding, changing, or removing a feature is not done until:
`FEATURE-CATALOG.md`'s Index row + tags + Tags-section bullets +
row/section ordering are updated (`ADDING-FEATURES-WORKFLOW.md` step 10);
the feature's own `guides/<FEATURE>-FEATURE-GUIDE.md` exists/is updated;
cross-links in any *other* guide affected by a newly-found incompatibility
are updated too (not just the new feature's own guide); `QUICK_START_GUIDE.md`
is touched only if the change affects the template's own structure, not
per-feature. Treat a feature as incomplete without these, not as
"documentation debt to do later."
