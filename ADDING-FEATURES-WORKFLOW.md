# Workflow: adding a feature to `feature_template`

The repeatable process for adding a new, reusable, drop-in feature to
`feature_template` — one any future fork can adopt. This covers **two
different starting points**, and the workflow below is written to handle
both:

- **Porting** a feature that already exists on a project-specific fork
  branch (e.g. `Jakob_module`) into a generalized, project-agnostic form.
  This was how every feature on this branch so far came to exist.
- **Writing an original feature** directly on `feature_template` — no
  source branch, nothing to port, just a new idea that belongs here.

Almost the whole workflow is the same either way: design it well, follow
the file-naming convention, write the guide, update the catalog, check for
incompatibilities, commit. The one part that's specific to porting —
reading and scoping the feature on its *source* branch before touching
anything — is broken out as its own clearly-marked **subroutine**, run once
near the start and only when there's an actual source branch to scope.
Skip it entirely for an original feature and go straight to step 2.

`guides/SOUND-FEATURE-GUIDE.md` (a port) is the worked example this
workflow produced — read it alongside this file to see each step's
concrete output. Follow the same sequence for the next feature, ported or
original, and name its guide `<FEATURE>-FEATURE-GUIDE.md` to match, placed
in `guides/`. `FEATURE-CATALOG.md` is the running index across every
feature this workflow has produced so far — check it first to see what's
already on this branch before starting new work (step 12 covers checking
the new feature against it for compatibility; step 10 covers keeping it
updated). `QUICK_START_GUIDE.md` is a separate, short, non-technical guide
for artists using this template's features — not part of researching or
building a feature, but step 11 covers when it needs a touch-up.

## 0. Keep `main` current — but don't touch feature branches with it

`git fetch origin`, then merge into **local `main` only**
(`git checkout main && git merge origin/main`). Never merge `main`'s
changes into a source feature branch (`Jakob_module`, etc.) — those stay
exactly as their authors left them; this only matters if you're porting
(see step 1). `feature_template` is branched fresh from this updated
`main` (or, once it exists, already sits on top of it — see step 2), so
it's `main`'s current state every feature has to work against — an
original feature needs this just as much as a ported one, since it's
still going to sit in the same shared scene as everything else already on
`feature_template`.

## 1. Is this a port, or an original feature?

- **Porting an existing feature from a source branch** — go run the
  **[Porting subroutine](#porting-subroutine-scoping-a-feature-on-its-source-branch)**
  below now. It walks through reading and scoping the feature on its
  source branch. Come back here and continue at step 2 once it's done.
- **Writing an original feature**, with no source branch to port from —
  skip the subroutine entirely and continue directly at step 2.

---

## Porting subroutine: scoping a feature on its source branch

**Only applies when adapting an existing feature from a project-specific
fork branch (e.g. `Jakob_module`) into `feature_template`. Skip this
entire section for a brand-new feature authored directly on
`feature_template` — there's no source branch to scope, so there's nothing
here to do; go to step 2 of the general workflow above instead.**

Before writing anything, read every file the feature actually touches on
its source branch — components, manifest registration, the relevant slice
of `ArModule.vue`, and any existing docs (e.g. `Jakob_module`'s
`SOUND-CONTROLS.md` was a big head start). The goal is a clear line between:

- **Feature-owned files** — only exist because of this feature.
- **Incidental, unrelated changes** on the same branch — e.g. `Jakob_module`
  also had a `force-shadow-map.ts` component fixing shadow rendering in
  general; that's not part of "the sound feature" and was deliberately left
  behind. Don't drag unrelated fixes along just because they live on the
  same source branch — port them as their own separate feature later if
  they're worth generalizing too.

Also identify **hidden assumptions** baked into the original code that
won't hold in an arbitrary future project — e.g. the original relied on a
specific invisible child-plane naming convention (`sound-button-hit-area`)
for its tap target, and a camera position offset compensating for one
specific host deployment. Anything like that needs to become an explicit,
documented attribute instead (see step 3, and the "if porting" note in it).

Once this is done, continue at **step 2** of the general workflow above —
everything from here on applies the same way whether you just finished
this subroutine or started from an original idea.

---

## 2. Branch (or reuse) `feature_template`

Created once, from `main`, with **no upstream tracking**
(`git checkout -b feature_template main` — not `origin/main`, and don't set
`-u` afterwards) so a stray `git push` can't land on a shared branch by
accident. Every subsequent feature — ported or original — is added to this
same branch, on top of whatever's already there — don't re-branch from
`main` per feature, or you'll lose every feature already on it.

## 3. Design for universality before writing code

This is the step most worth slowing down for, whether you're generalizing
someone else's implementation or designing an original one from scratch.
Ask, for every piece of the feature:

- **Is this generic, or specific to this one feature?** The sound feature's
  original three components tangled "detect a gaze/tap on a 3D object"
  together with "play/pause/stop audio." Splitting that into a generic
  layer (`ar-button` + `ar-button-manager` — reusable by *any* future
  tap-driven feature) and a thin feature-specific layer built on its events
  (`sound-button` + `sound-controller`) is the pattern to repeat: pull out
  anything a *different* feature would plausibly also need, and connect the
  feature-specific part to it via a narrow event/method contract rather
  than tight coupling. For an original feature, ask this just as
  seriously — it's easy to under-generalize your own new code the same way
  a source branch's author under-generalized theirs.
- **If porting: would the current component structure survive a rewrite,
  or is it worth restructuring?** Don't assume the source branch's file
  boundaries are the right ones — they're often just how the feature
  happened to evolve through trial and error (this was true for Sound:
  three components became five, cleanly separated, not three renamed
  ones).
- **Replace scene-specific hacks with declarative attributes.** The
  invisible-hit-area-child-plane pattern became a `zoneSize`/`zoneOffset`
  attribute pair directly on the button entity. A hardcoded camera offset
  stays out of anything universalized — that's specific to one project's
  scene, not the feature. For an original feature, this means: don't
  hardcode anything that only makes sense for whatever scene you happened
  to prototype it in.
- **Define the public surface deliberately**: schema attributes (with
  sensible defaults so most attributes are optional), and DOM events for
  anything another component might want to react to. Once decided, treat it
  as the contract other features (and other forks) will build against.

**If a needed change requires creative or non-obvious judgment, stop and
ask before implementing it.** Not everything above needs sign-off — a lot
of it is mechanical and fine to just do: adopting this branch's established
code style (e.g. `follow-node`/`wander-in-band`'s `AFRAME.THREE` →
`declare const THREE: any` normalization), picking which folder a file
goes in, dropping something already provably dead (an unread schema field,
code gated behind a flag that's never actually enabled anywhere real).
Genuinely check first, though, rather than assuming there's nothing to ask
about — `follow-node` and `wander-in-band` needed zero design changes when
ported, but only because that was actually verified (both take every
meaningful value as a schema attribute already, nothing hardcoded to one
scene), not assumed. What *does* need to be raised, with the specific
issue and 1-2 concrete options plus a recommendation, before writing any
code — the same way the mirror-shard/liquid-texture split and the
proximity-fade ordering fix were presented as options first:

- Measurably changing a feature's visual or behavioral character (not just
  its performance or code structure).
- If porting: dropping part of what the source did that *isn't* already
  dead code — i.e. something a real scene on the source branch actually
  exercises.
- A genuine ambiguity about what "universal" (or, for an original feature,
  just "well-designed and reusable") should mean for this specific piece,
  where more than one reasonable answer exists and the choice changes what
  the shipped component actually does.

Silently making a call like that and only explaining the reasoning
afterward denies the person who asked for the feature an actual decision
they should get to make.

## 4. File naming & organization convention

`src/a-frame-components/` and `src/assets/` are flat, shared folders — every
feature's files live there side by side. Two ways to keep them
distinguishable: subfolders, or a naming convention. **Check the actual
build tooling before picking** — don't assume subfolders are free. Here,
`vite.config.ts`'s asset scanner (`readdirSync(ASSETS_SRC).filter(isFile)`)
is **non-recursive**, so anything placed in an `src/assets/` subfolder would
silently never reach the manifest. That ruled out subfolders for assets,
and the same convention was applied to components too, for consistency
rather than mixing schemes.

The convention adopted:

- A feature's own files (components **and** assets) are prefixed with the
  feature's name — `sound-button.ts`, `sound-controller.ts`,
  `sound-unlock-audio.ts`, `sound-start.webp`, etc.
- Files that are genuinely generic — reusable by any feature, not owned by
  one — stay unprefixed or keep a neutral prefix (`ar-button.ts`,
  `ar-button-manager.ts`, `no-frustum-cull.ts`), **even if only one feature
  currently uses them**. Don't retroactively feature-prefix something just
  because nothing else needs it yet.
- Per-feature guides (`<FEATURE>-FEATURE-GUIDE.md`) live in `guides/`.
- **Cross-feature reference docs live in `cross-feature-reference-docs/`**
  — anything that touches on features and functionality but brings a
  broader perspective the project needs and can't be pinned to one
  specific feature (e.g. `cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md`, which
  spans Render Order, Mesh Render Order, LOD + Billboard, Material
  Properties, Dither Material, Proximity Fade, and Proximity Cutout — no
  single one of those guides is the right home for it). Put every future
  doc of this shape there too, not at the repo root and not inside
  `guides/`. Link to it from the "Incompatibilities" section of every
  feature guide it applies to (see step 12), the same way the existing one
  already is.
- Everything else genuinely project-wide and not tied to one feature —
  this file, `README.md`, `FEATURE-CATALOG.md`, `QUICK_START_GUIDE.md`,
  `AGENTS.md` — stays at the repo root.

This means adopting a feature is always a flat file copy into the same
folders a project already has — never a path change or a move. Document the
convention itself once (currently in the comment above the `components` map
in `src/manifest.ts`); each new feature just follows it.

## 5. Decide which assets are integral to the feature

Not everything a feature touches belongs in the universalized version —
if porting, not everything the source branch ships in `src/assets/`
belongs either. Split:

- **Integral, feature-defining assets** — needed for the feature's own code
  to function, and generic enough that any project would want the same
  ones (or could reasonably use them as-is). The sound feature's four
  play/pause/stop/restart icons are this: `sound-controller`'s GUI panel
  code references them by id directly, and a restart/stop/play/pause icon
  set isn't specific to any one project's content. If porting, these get
  copied over for real (`git checkout <source-branch> -- <path>`), renamed
  to the naming convention, and committed. If original, you're authoring
  them fresh — same bar applies: would this asset make sense shipped as
  part of the generic feature, or is it really just placeholder content?
- **Artistic / project-specific content** — 3D models, recorded audio
  clips, anything that's *what this particular project's feature instance
  happens to play or show*. The sound feature's exhibit models and
  German/English narration clips are this — they don't travel. They only
  appear as illustrative placeholder ids in example markup (`#Exhibit`,
  `#EnglishNarration`, ...), clearly explained as stand-ins a real project
  replaces with its own content, not real shipped assets.

When in doubt: would a *different* project using this feature plausibly want
the exact same file? If yes, it's integral. If it's "content," it's not.

Once an asset is confirmed integral, consider whether it's worth
compressing before committing (`npm run compress-assets`) — see
`cross-feature-reference-docs/ASSET-COMPRESSION-GUIDE.md`. Not mandatory
for every asset (a small icon doesn't need it), but a multi-megabyte
`.glb` shipped uncompressed adds real load time to every project that
copies the feature in.

## 6. Implement components, register in `manifest.ts` with a minimal diff

Write the components in `src/a-frame-components/`. Register them in
`src/manifest.ts` **additively** — import the new components, add entries
to the existing `components` map — without touching whatever else is
already registered there (image targets, other features' entries, etc.).
The diff for adding a whole feature's components to the manifest should be
small and obviously additive, easy to review in isolation from everything
else in the file.

## 7. Demonstrate usage with example files — don't touch `ArModule.vue`

`ArModule.vue` is the one file every fork is expected to hand-edit with its
own scene content; `feature_template`'s copy must stay generic/untouched so
it doesn't fight with whatever a project already put there. (The one
established exception: genuine template-baseline infrastructure that isn't
a pick-and-choose feature at all, like the loading bar/spinner — that's
deliberately built into `ArModule.vue` itself, not an example, and needs
explicit sign-off before touching it that way.) For an actual feature,
instead add files under `examples/` (outside `src/`/`lib/`, so they're
excluded from `tsconfig`'s `include` and never touched by the Vite build —
pure reference text, not compiled or served):

- **3D usage example** — scene markup showing every component/attribute
  combination that matters, with a full attribute reference as comments at
  the end (`examples/ar-button-usage.html`).
- **GUI/2D-overlay example**, if the feature has one — a copy/paste block
  (Vue SFC syntax, even if kept as a `.html` file for readability) with
  explicit instructions *in the file's own top comment* for where each
  piece goes in a real `ArModule.vue`, what the module root entity needs,
  and what assets it depends on (`examples/sound-gui-panel.html`).

If a feature is complex enough to need both, keep them as separate files
(3D wiring and a 2D GUI overlay are conceptually different integration
points) rather than one combined example.

## 8. Verify

After each meaningful change: `npx vue-tsc --noEmit` (fast typecheck) and a
full `npm run build` (exercises the actual Vite asset pipeline — this is
what caught, for example, that the icon assets were correctly picked up
under their new prefixed names). Delete the generated `dist-platform/`
output before committing — it's gitignored, but there's no reason to leave
build output sitting in the working tree either.

## 9. Write the per-feature guide

One `<FEATURE>-FEATURE-GUIDE.md` per feature, in `guides/`, covering — in
this order, matching `guides/SOUND-FEATURE-GUIDE.md`:

1. **Step-by-step setup** — a literal checklist for copying the feature
   into a fresh project: which files to copy, how to register them in
   `manifest.ts`, how to wire the scene, how to integrate any GUI pieces,
   how to verify it worked. Written for someone who's never seen the
   internals.
2. **Entities & attributes** — every custom element/attribute the feature
   adds, as a reference table: name, type, default, meaning. Include events
   emitted, and a full worked example.
3. **Under the hood** — how the components are structured and why (what's
   generic vs feature-specific and why it was split that way), the key
   algorithms/state machines, and the non-obvious "why" behind any design
   decision — inherited from a source branch and changed during a port, or
   made from scratch for an original feature.
4. **Incompatibilities, risks & troubleshooting** — see step 12; this
   section's content comes directly out of that check.

## 10. Update `FEATURE-CATALOG.md`

`FEATURE-CATALOG.md` is the quick-lookup index across every feature on
this branch — one line of "what it does" per feature, then a components
table and an assets table, each with a one-line description and (for
assets) where they're used. It exists so someone can find "which file
implements X" or "what is this asset for" without opening every guide.
Add the new feature's entry following the existing ones as a template:

- One row in the top **Index** table (feature name, one-line description,
  **tags** — see below — **source branch**, and link to its guide). For a
  ported feature this is step 1's source branch, e.g. `Jakob_module`. For
  an original feature with no source branch, use `feature_template`
  (original) — see `Image Tracking`'s row for the closest existing
  precedent (`main`, its own template-baseline origin rather than a
  project fork).
- A "Guide: ... · Source: `<branch>`" line at the top of the feature's own
  section, matching the Index row.
- **Assign 1–3 tags** — short, poignant labels more general than the
  one-line description, meant for at-a-glance scanning. Check
  `FEATURE-CATALOG.md`'s [Tags](FEATURE-CATALOG.md#tags) section (at the
  very end of the file) for the current full list — currently `sound`,
  `proximity`, `motion`, `animation`, `random`, `distribution`, `utility`,
  `visual-effect`, `procedural`, `material-properties`, `transparency`,
  `dither`, `render-order`, `LOD`, `interaction`, `image-tracking`, but
  that list only grows, so treat it as a starting point, not the full set.
  Reuse an existing tag whenever the feature genuinely shares that theme
  with something already tagged that way — the whole point is that
  multiple features share tags. You're free to invent a new one when a new
  component genuinely calls for it and nothing existing fits — make sure
  it names something real and important about the feature (or the thing
  several related features share), not a restatement of its name.
- **Update the Index table's tag cell AND the [Tags](FEATURE-CATALOG.md#tags)
  section** — both need to change together, every time, not just the
  Index:
  - In the Index row, link each tag to its section:
    `` [`tagname`](#tag-tagname) ``.
  - Under each tag you used in the `## Tags` section, add a bullet linking
    the new feature (`- [Feature Name](#feature-anchor)`) — most tags will
    already exist there since you're reusing one; just extend its list.
  - If you invented a brand-new tag, add a new `### Tag: \`tagname\`` entry
    to `## Tags` **in alphabetical order** among the existing ones, with
    the new feature as its first bullet.
  - Heading text must stay `### Tag: \`tagname\`` (not bare `` `tagname` ``)
    — several tags share a name with an existing feature-section anchor
    (`sound`, `image-tracking`, `render-order`, `material-properties` all
    do), and the `Tag: ` prefix is what keeps `#tag-sound` from colliding
    with the `## Sound` feature section's own `#sound` anchor. Follow the
    same prefix for any new tag too, even ones that don't currently
    collide with anything — a later feature might reuse the bare name.
- **Re-derive the table's row order** (and move the feature's own section
  to match, so the deep-dive sections stay in the same order as the
  Index) so that features sharing tags end up as close together as
  possible. This is a judgment call, not a mechanical sort — a feature
  usually has more than one tag, and its neighbors on each side will each
  share a *different* one, so there is rarely a placement that's
  simultaneously ideal for every tag at once. Weigh which shared tag is
  more specific/significant for that feature (a generic tag like
  `utility` is a weaker pull than a specific one like `dither`) and place
  it nearer whichever existing feature(s) it has the strongest thematic
  overlap with. When two placements seem equally good on tags alone,
  prefer the one that also keeps same-**source-branch** features
  together — that's how they were originally connected, and it's a
  reasonable tiebreaker, but tags come first if they conflict with it. An
  original feature has no source branch pulling it toward any particular
  neighbor, so tags alone decide its placement.
  This may require moving other existing rows/sections too, not just
  inserting the new one at the end.
- If the feature introduced a genuinely generic building block (like
  `ar-button`), add it to the **Shared building blocks** table instead of
  under the feature section, with an "Introduced by" note naming which
  feature's port (or original design) it was written during — these
  blocks are usually written fresh/generalized during a port rather than
  copied verbatim, so say that rather than implying they came from the
  source branch as-is — and update that block's "Used by" column for any
  *other* existing entry that also turns out to depend on it.
- A features section: one-line description, a components table (name,
  file, one-line description — mark non-component helper files, e.g. a
  `-shared.ts` factory or a `-unlock-audio.ts` utility, with `—` in the
  component-name column rather than omitting them), and an assets table
  (asset, which example/component uses it, one-line function) or "none."
- Cross-link related features that consume each other (as Mirror Shard and
  Liquid Texture do) in both directions.

Keep every description on this page to one line — it's an index, not a
guide; the linked `<FEATURE>-FEATURE-GUIDE.md` (in `guides/`) is where the
detail belongs.

## 11. Check whether `QUICK_START_GUIDE.md` needs updating

Unlike `FEATURE-CATALOG.md`, this is **not** an every-feature update —
`QUICK_START_GUIDE.md` deliberately never names or lists individual
features (it points to `FEATURE-CATALOG.md` for that), so adding a routine
feature that fits the existing pattern (copy files, add lines to
`manifest.ts`, paste example markup into `ArModule.vue`) usually needs no
change there at all. Only revisit it if this feature (or the work around
it) changed something the guide asserts about the *template itself* —
e.g. a new top-level doc other artists should know about, a changed/added
`npm run` command, a change to what goes in `src/manifest.ts` or how
`ArModule.vue`/`examples/`/`src/assets/` are meant to be used, or a new
rule of thumb worth adding. That guide is written for non-programmers, so
if you do touch it: keep it short, avoid code detail, and don't let it
grow into a second feature list.

## 12. Check for incompatibilities — against *everything* already there

This has to be redone, in full, every time a feature is added to
`feature_template` — ported or original — not just against the feature
being added, but against **every feature already on the branch and
everything already in `main`** (the image-target/`xrextras-play-video`
example from the sound feature's guide is exactly this: `main` had that
before any feature work started, and it turned out to matter). Concretely
check:

- **A-Frame component name collisions.** The host (and
  `lib/host-runtime.ts`, which mirrors it) registers manifest components by
  name and **skips duplicates** — if two features (or two forks both using
  this template) register the same component name with *different*
  behavior, whichever mounts first silently wins for both, project-wide.
  Read `lib/host-runtime.ts`'s `registerManifestComponents` before assuming
  otherwise.
- **Shared global listeners/state.** Anything that adds `document`-level
  event listeners (pointer, click, keyboard, ...) or touches a page-wide
  singleton (the shared `THREE.AudioContext`, `document.activeElement`,
  etc.) needs to be checked against every other feature doing the same —
  do they filter their target tightly enough not to double-fire on each
  other's taps? Do they assume they're the only thing playing audio /
  reading input?
- **The shared `<a-camera>`.** `CAMERA_PROPS_FORBIDDEN` in
  `lib/manifest.types.ts` already blocks the worst case (a module
  relocating or hijacking input for the shared camera), but a feature can
  still *read* camera state in ways that assume it's the only one doing so
  — check for that.
- **Visual/interaction overlap.** Two features' interactive trigger zones
  (or a feature's zone and `main`'s existing tappable content) occupying
  the same screen space in a real scene — even without any code conflict,
  a single tap can satisfy both independently.
- **Don't assume — read the actual dependency source.** The
  `xrextras-play-video` finding in `guides/SOUND-FEATURE-GUIDE.md` came
  from grepping `node_modules/@8thwall/xrextras/dist/xrextras.js` directly,
  not from guessing at what a bundled third-party component probably does.
  Do the same for any other vendored component a new feature might
  interact with.

Fold whatever this check finds into the new feature's own guide (step 9,
section 4) **and** go back and update any earlier feature's guide if the
new feature reveals a risk that also applies to it.

## 13. Commit

Only when explicitly asked. Stage exactly the feature's files — leave out
unrelated local/untracked clutter that happens to be sitting in the working
tree. Write a commit message that explains *why* the restructuring
happened (e.g. the generic/feature-specific split), not just a file list.
