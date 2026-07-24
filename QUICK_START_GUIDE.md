# Quick start guide

This is a short, plain-language starting point for **artists and other
non-programmers** building an AR project on top of `feature_template`. It
does **not** explain any individual feature or how any component works —
for that, see [FEATURE-CATALOG.md](FEATURE-CATALOG.md) (what's available)
and the matching `<FEATURE>-FEATURE-GUIDE.md` (how to use it). This page is
only about: what kind of file to open, what to do with it, and which
command to run.

## What is `feature_template`?

A collection of ready-made AR effects (sound buttons, fade effects, a
shard-shatter effect, ...) that any project built from this template can
pick and choose from. It isn't a finished artwork by itself — it's a
starting point you copy pieces out of into your own scene.

## Starting your own project, or just trying something out

Don't build directly on the `feature_template` branch itself — it's the
shared library every project starts from, and it needs to stay generic and
uncluttered for the next person too. Create your **own branch (or fork)
from `feature_template`**, and do all your project-specific work there:
your own scene content, your own assets, any testing or experimenting.
That's true whether you're starting a real project or just trying a
feature out to see what it looks like.

## Working with an AI coding agent?

If you're using an AI agent (Claude Code, Cursor, or similar) to help you
build your scene, point it at [AGENTS.md](AGENTS.md) *first*, before
asking it to do anything else. It's written for the agent, not for you —
dense, technical, and not meant to be pleasant reading — but having it
read that file first gets it oriented on this project's structure and
rules before it touches anything, the same way this page gets you oriented.

## The files you'll actually work with

| File / folder | What it's for |
|---|---|
| `src/ArModule.vue` | **Your scene.** Everything the visitor sees and hears — 3D objects, lights, and any feature you add — goes in here, inside the `<template>` section. |
| `examples/*.html` | Copy-paste reference snippets, one (or a few) per feature. These are never run or edited directly — open one, copy the parts you need, paste them into `ArModule.vue`. Each file's own comments explain exactly what to copy and where it goes. |
| `src/assets/` | Drop your images, sounds, and 3D models (`.glb`, `.png`, `.mp3`, ...) here. Every file becomes usable in your scene automatically, by its file name (a picture named `logo.png` becomes usable as `#logo`) — no extra setup. |
| `src/manifest.ts` | The "switchboard" that turns a feature on for your project — a short list of one import + one line per feature you've copied in. A feature's own guide tells you exactly what to add here; you don't need to understand the file beyond that. |

Everything else in the project (the `lib/` folder especially) is shared
internal plumbing — you shouldn't need to open or edit it. One exception
worth knowing about: the top of `ArModule.vue` and the very end of its
`<template>` section contain the loading bar + spinner shown while your
scene's assets are still downloading — you don't need to touch this either
(it works automatically for any assets you add), just don't delete it when
editing the rest of the file.

If your `.glb` files or images end up large enough to slow down loading,
run `npm run compress-assets` — it walks you through compressing them
(step by step, nothing to configure by hand) and always keeps your
original files safe in a local `uncompressed-assets/` folder first.

## Adding a feature to your scene

1. Open [FEATURE-CATALOG.md](FEATURE-CATALOG.md), find the feature you
   want, and click through to its guide.
2. Follow that guide's first section (always called "step-by-step") — it's
   a short checklist: which files to copy into `src/a-frame-components/`,
   what to add to `src/manifest.ts`, and which images/sounds (if any) to
   drop into `src/assets/`.
3. Open that feature's example file in `examples/` and copy the markup
   into `ArModule.vue`'s `<template>` section. Some features (like Sound)
   also have a second on-screen-button snippet to paste in the same way —
   the example file says so if there is one.
4. Save, and look at it (see below).

If you're combining more than one feature in the same scene, skim the
"Incompatibilities, risks & troubleshooting" section near the end of each
one's guide first — that's where anything to watch out for when using them
together is written down.

## Checking your work

- `npm install` — once, after first opening the project.
- `npm run dev` — opens a live preview in a regular browser window,
  updating automatically as you save. No phone needed; good for a quick
  look while you work.
- `npm run dev:ar` — the same, but using your phone's camera for real AR
  (open the printed link on your phone).
- `npm run build` — packages the whole project into the one file that gets
  published for the real installation. Run this once you're ready to hand
  a piece off — if it finishes without red error text, it worked.

You don't need to understand how these commands work internally — just run
them and look at the result.

## Contributing a feature back to `feature_template`

If something you built on your own project turns out generic and useful
enough that future projects should have it too, you can propose adding it
to `feature_template` itself with a pull request. Before opening one,
make sure it's ready:

- **It's a finished feature, not a work-in-progress experiment.** Half-done
  code that only covers your own project's use case isn't ready to share
  yet.
- **It doesn't duplicate something already there.** Check
  [FEATURE-CATALOG.md](FEATURE-CATALOG.md) first — if something close
  already exists, extend that instead of adding a near-identical second
  version.
- **It's universally usable, not specific to your project.** No hardcoded
  values, ids, or assets that only make sense in your own scene — anything
  like that needs to become a setting/attribute someone else can change.
- **It follows [ADDING-FEATURES-WORKFLOW.md](ADDING-FEATURES-WORKFLOW.md)
  in full** — this is the actual checklist a new feature is judged
  against (design, file naming, the example file, the guide, the catalog
  entry with its tags, checking it doesn't conflict with anything already
  on the branch). Read it before you start, not after.
- **It should only *add* — new components, a new guide, a new example —
  not restructure or touch the template's basic structure** (`ArModule.vue`'s
  baseline content, `manifest.ts`'s existing entries, the overall folder
  layout). If you genuinely think the structure itself needs to change,
  raise that separately rather than folding it into a feature PR.

## Where to find more

| Document | When to read it |
|---|---|
| [README.md](README.md) | The full technical documentation — build details, project structure, how the module talks to the host app. Read this if you need more depth than this page or hit something technical this page doesn't cover. |
| [FEATURE-CATALOG.md](FEATURE-CATALOG.md) | The index of every available feature, with links to each one's guide. Start here when looking for a specific effect. |
| `guides/<FEATURE>-FEATURE-GUIDE.md` (one per feature) | How to use one specific feature: setup steps, every attribute you can set, and anything to watch out for. All per-feature guides live in the `guides/` folder — reach them via the link in `FEATURE-CATALOG.md` rather than guessing the filename. |
| `cross-feature-reference-docs/*.md` (e.g. `RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md`) | Not tied to one feature — covers a topic that spans several (like how draw order and see-through materials interact). Linked from the "Incompatibilities" section of any feature guide it applies to; only worth opening on its own if you're combining several features that touch the same thing (materials, draw order, ...). |
| [ADDING-FEATURES-WORKFLOW.md](ADDING-FEATURES-WORKFLOW.md) | Only relevant if you're the one *building a new feature into* this template — not needed just to use what's already here. |
| [AGENTS.md](AGENTS.md) | Not written for you — written for an AI agent. Point an AI coding agent at this file before asking it to work in this project; see "Working with an AI coding agent?" above. |
