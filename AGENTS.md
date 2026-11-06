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

## 2. Two kinds of work, and the branch model

Figure out which one you are doing before anything else:

- **Project work:** the user builds their own module in their own fork or
  branch. This is the usual case in a clone you find on a user's machine. Their
  branch is theirs, whatever its name: edit `src/ArModule.vue`, `src/assets/` and
  the manifest freely. If they ask for scene work while still on
  `feature_template`, create a branch for it first (`git switch -c <name>`), then
  carry on. Don't refuse the task, and don't follow the template rules marked
  "template work" below.
- **Template work:** adding, porting or changing a feature in
  `feature_template` itself. All rules below apply.

Branches (`feature_template` is the default branch of the public repository and
protected against force-push and deletion):

- `main` — clean baseline. Placeholder scene content only.
- `feature_template` — the accumulation branch. Every reusable feature
  ever universalized lives here, additively, on top of `main`. This is
  almost certainly the branch you are on or should be working toward if
  the task is "add/port/document a feature."
- `<Name>_module`, `<Name>_production` branches (e.g. `Jakob_module`,
  `Gyumin_production`), `abv-*` / `augmented-bahnhofsviertel`, and `sound-player`,
  `proximity-effekte`, `zwischen-basis`, `host-light-scale`, `ai-asset-tools`,
  `plant-sandbox` — real, one-off projects and work branches, many by students and
  artists. They are no longer in the public repository but in
  the **private** `working-on-democracy/ar-module-template-archive`, and most users
  have no access. Without access, `Source` entries and "Project context" notes
  naming them are history only: don't look for them. With access, treat the student
  branches as **read-only source material** — never merge `main` into them, never
  push changes to them, only read code from them (`git show <branch>:<path>`).
  Their assets are their authors' work: never copy them (§5). Never push any of
  these branches back to the public repository. A user's own project branch is not
  one of these, even with a similar name.

If the task involves "port X from branch Y" or "bring in a feature," you
are doing what this repo calls **universalizing** — see §3.

## 3. Read order before modifying anything

**Project work:** this file, then `FEATURE-CATALOG.md` and the guide of each
feature you use (including its §4). Read
`cross-feature-reference-docs/SCENE-PLACEMENT-GUIDE.md` before positioning
anything and `BUILD-AND-EXPORT-GUIDE.md` (same folder) before an export. Open
the other documents below only when their topic comes up.

**Template work:** all of the following, in order.

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
7. **`cross-feature-reference-docs/HEADLESS-AR-TESTING-GUIDE.md`** — read
   before claiming anything camera/image-target/XR8-dependent works
   without a phone: how to run `dev:ar` in headless Chromium with an
   emulated iPhone and a generated video of the image target as the
   camera, what that does and does not verify.
8. **`cross-feature-reference-docs/SCENE-PLACEMENT-GUIDE.md`** — read
   before positioning anything in `ArModule.vue` or "fixing" a scene that
   sits in the wrong place: host camera/module root, 8th Wall floor and
   units, `place-in-front` (`scene-root`) and `world-origin`.
9. **`cross-feature-reference-docs/BUILD-AND-EXPORT-GUIDE.md`** — read
   before an export or when a module behaves differently in the host than
   in a preview: the four builds, the host's loading steps, upload and
   registration.
10. **`README.md`** — technical project layout/build details, only if you
   need build-system specifics not covered above.
   `cross-feature-reference-docs/ARCHITECTURE-GUIDE.md` has the layer/format/
   convention overview; the A-Frame, 8th Wall, Vue and writing-a-component
   introductions next to it are written for humans new to the stack — point
   users there rather than re-explaining basics.
11. **`QUICK_START_GUIDE.md`** — only relevant if the user is a non-technical
   artist/end-user of the template, not another engineer. Deliberately
   shallow; don't treat it as a technical reference.

## 4. Repo layout

```
src/ArModule.vue              the ONE file a project fork hand-edits with its own scene
src/manifest.ts                assets (auto) + components (auto, see §5) + camera + imageTargets
src/a-frame-components/*.ts    every A-Frame component, flat folder, non-recursive scan; file name = component name
src/assets/                    binary assets (.glb/.png/.mp3/...), flat folder, non-recursive scan; empty in the template
src/image-targets/             8th Wall image-target JSON + images, flat, non-recursive scan; empty in the template
src/asset-loading-overlay.ts   template-baseline loading bar/spinner helper (not a component)
src/ArOverlay.vue              AR Overlay feature (Vue, not an A-Frame component) + src/ar-overlay-icons.ts
examples/*.html                copy-paste reference markup per feature, never compiled/served
examples/assets/, examples/image-targets/  generated demo files; never scanned; copied into src/ when a project uses them
guides/*-FEATURE-GUIDE.md      one guide per feature: setup, attributes, internals, incompatibilities
cross-feature-reference-docs/  docs spanning multiple features, not owned by any one (render-order/transparency, asset compression, headless AR testing, scene placement, build & export, architecture, tool introductions)
lib/                            host/preview plumbing — not edited by a project fork; includes gltf-meshopt-setup.ts.
                               dev:ar/build:ar run 8frame 1.5.0 (lib/vendor/), the host runs 8frame 1.3.0 (three r137) —
                               verify three.js-version-sensitive behaviour (colorSpace/encoding, opaque sorting, PMREM) against the host
scripts/compress-assets.ts     `npm run compress-assets` — interactive mesh/texture compression tool
scripts/generate-demo-assets.ts  generates the demo files and mirror-shard's shards.json from code
scripts/used-components.ts     scan behind automatic component registration (virtual:used-components in vite.config.ts)
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
- **Template work: no third-party material, and nothing in `src/assets/`
  or `src/image-targets/`.** Student and project work isn't free to redistribute,
  so never copy models, images, sound, video or geometry data from a source
  branch, not even as a demo. Demo files are generated
  (`scripts/generate-demo-assets.ts`) or documented as free to use, and live in
  `examples/assets/` / `examples/image-targets/`. Both `src/` folders stay empty
  because everything in them ships with every module. See
  `ADDING-FEATURES-WORKFLOW.md` step 5.
- **Template work: never edit `feature_template`'s `src/ArModule.vue`** to
  demonstrate a feature — it's the one file every fork hand-edits, and must stay
  generic. (In project work, it is the file to edit: see §2.) Add `examples/*.html` instead. The one standing exception is
  genuine template-baseline infrastructure that isn't a pick-and-choose
  feature (e.g. the loading bar/spinner) — that required, and required
  explicit user sign-off before, direct `ArModule.vue` edits.
- **Components register automatically — the file name is the component
  name.** Every file in `src/a-frame-components/` with a default export is
  a component named after its file; the ones the module uses (by name in
  `ArModule.vue` and the files it imports, plus transitively) are bundled
  and registered via `virtual:used-components` (`scripts/used-components.ts`,
  `vite.config.ts`). Don't add component imports/entries to
  `src/manifest.ts` — only for a name differing from the file, or one built
  at runtime, after the `...usedComponents` spread. Helper files must NOT
  have a default export (that's what keeps them unregistered). Other
  `src/manifest.ts` edits (camera, imageTargets) stay additive-only: never
  touch or reformat existing entries as a side effect.
- **A-Frame component registration dedups by name; first-registered
  wins, silently.** Two features (or a fork + this template) registering
  the same component name with different behavior is a silent bug, not an
  error. Check for name collisions before adding a component — i.e.
  before naming a new component file.
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
- **`hostLights: false` only in a module with lights of its own.** The
  manifest field makes the host switch its two scene lights off while the
  module is shown. Set it only when the scene has lights itself
  (`<a-light>`, `light`, three.js lights from a component — not
  `xr-light` alone, it only drives an existing light);
  otherwise the module turns dark in the host. Remove it when the module's
  last light goes. See README "Host lights".
- **Template work, with access: check the host repo for changes regularly**
  (`TobiasStill/ar-demo-backend`, private, read via `gh api`; read-only unless
  the user asks for a PR). If `gh api` returns 404 or 403, the user has no access:
  don't block on it, rely on the facts in README "Keeping up with the host" and
  say they couldn't be re-checked. Before a release, before relying on a host fact (runtime versions, base
  scene/lights, UI, module loader), and whenever host and preview behave
  differently: look at the commits since the "Last checked" line in README
  "Keeping up with the host" and at the files listed there. If anything
  changed, tell the user, align previews/docs, and update that line. The
  host may upgrade 8frame (currently 1.3.0) at any time.
- **The host mounts every module at `0 1.6 -3`; its camera starts at
  `0 0.35 0.8`; 8th Wall's floor is world y = 0.** `dev:ar` mirrors all
  three (`lib/preview-ar.ts`). So a fixed local position never lands on the
  floor: floor content goes inside the start scene's `scene-root`
  (`place-in-front`), and every `xrextras-named-image-target` goes inside
  `<a-entity world-origin>` — never a hard-coded counter-offset. See README
  "Where a module sits".
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
  limitation explicitly) for anything camera/XR8-dependent. Without a
  phone, run `dev:ar` headless with a fake camera video per
  `cross-feature-reference-docs/HEADLESS-AR-TESTING-GUIDE.md`, and state
  what that could not verify (device motion/SLAM, real-GPU performance).
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
per-feature. Guides and cross-feature docs follow the wiki-ready structure
(`<!-- overview -->` block first, project-specific remarks only inside
`<!-- project-specific -->` blocks, general text coherent without them) —
`ADDING-FEATURES-WORKFLOW.md` step 9. Treat a feature as incomplete without these, not as
"documentation debt to do later."
