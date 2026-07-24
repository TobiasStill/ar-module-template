# Random field feature guide

Scatters clones of one or more referenced entities across a rectangular
area, using Poisson-disk (Bridson) sampling so both a minimum AND maximum
spacing between neighbours are honoured exactly, with a configurable copy
count per referenced entity. Ported from `Gyumin_module`'s
`glowstick-field`, substantially reworked — see
[3. Under the hood](#3-under-the-hood) for exactly what changed and why.

Files:

```
src/a-frame-components/random-field.ts
examples/random-field-usage.html   # scene wiring + full attribute reference
examples/random-field-lod-billboard-proximity-wave-scene.html # combined with
                                    # the other three Gyumin_module features
```

No assets. Independent of every other feature on this branch — it only
clones and places DOM subtrees, and knows nothing about what's inside them.
Combine it with [LOD + Billboard](LOD-BILLBOARD-FEATURE-GUIDE.md) (author
that structure on your referenced entity — clones inherit it automatically)
and/or [Proximity Wave](PROXIMITY-WAVE-FEATURE-GUIDE.md) (add
`proximity-wave-group` on the *same* entity as `random-field`) separately —
see `examples/random-field-usage.html`, or
`examples/random-field-lod-billboard-proximity-wave-scene.html` for all
three combined into one scene.

## 1. Step-by-step: adding this to a new project

1. **Copy the file** — `random-field.ts` — into your project's own
   `src/a-frame-components/`. No path changes, no data files.

2. **Register it** in your project's `src/manifest.ts`:

   ```ts
   import randomField from "./a-frame-components/random-field";

   export const manifest: Manifest = {
     assets: assetManifest.assets,
     components: {
       // ...whatever you already have...
       "random-field": randomField
     }
   };
   ```

3. **Author the entities you want scattered**, anywhere in your scene,
   each with its own `id`. A referenced entity can be a single mesh or a
   whole parent/child bundle (e.g. an `lod-object` group with its own
   billboard) — `random-field` deep-clones whatever it finds.

4. **Wire the field** — see [2. Entities & attributes](#2-entities--attributes)
   or copy directly from `examples/random-field-usage.html`.

5. **Build and test** — `npm run build`, then `npm run dev` for a quick
   VR/desktop preview of the placement (no phone needed to check spacing/
   copy count/randomization look right).

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `items` | selectorAll | — | Required. A CSS selector list (e.g. `"#propA, #propB"`) naming the entities to clone. Each can be a single mesh or a whole bundle. Every referenced entity is hidden (`visible: false`) once cloning starts. |
| `areaWidth` | number | `20` | FIXED width (metres, X axis), centred on this entity's own origin. No depth setting — depth grows automatically away from the viewer to fit however many copies there are. |
| `elevation` | number | `0` | Base Y height of every clone. |
| `elevationVariation` | number | `0` | ± random offset from `elevation`. |
| `yawMax` | number | `180` | Degrees. Each clone's Y rotation gets a random value in `[-yawMax, +yawMax]` **added** to its source entity's own authored Y rotation. `180` = fully random heading; `0` = no extra spin. |
| `tiltMin` / `tiltMax` | number | `0` / `0` | Degrees. X and Z each get an independent random tilt magnitude in this range (± direction), added to the source's own authored X/Z rotation. |
| `minDistance` | number | `2.5` | Hard minimum gap (metres) between any two clones. |
| `maxDistance` | number | `6` | Max gap to the nearest neighbour — both bounds honoured exactly. |
| `copies` | int | `1` | How many copies of **each** referenced entity (uniform across all of them). |
| `minCopyDistance` | number | `0` (disabled) | Minimum ground-plane gap between two copies of the *same* referenced entity. Only meaningful when `copies` > 1; degrades gracefully rather than failing if the area's too tight. |
| `scale` | number | `1` | Uniform multiplier on each clone's *own* authored scale (not a replacement). |

```html
<a-entity id="propA" gltf-model="#MyProp" scale="2 2 2"></a-entity>

<a-entity random-field="
    items: #propA;
    areaWidth: 15; minDistance: 2.5; maxDistance: 6; copies: 8
"></a-entity>
```

Position is always fully field-computed. Rotation and scale **compose**
with whatever the source entity already had authored (they don't replace
it) — see [3](#3-under-the-hood) for why.

See `examples/random-field-usage.html` for a multi-`items` example
(several distinct entities, including a parent/child bundle, placed in the
same field and shuffled together) and the `minCopyDistance` behavior.

## 3. Under the hood

### What changed from the source, and why

The source component did two jobs bundled together: (a) Poisson-disk
placement with spacing/copies, and (b) auto-discovering assets by a
`PREFIX_01`/`PREFIX_LICHT`/`PREFIX_PNG` naming convention and
*programmatically building* a whole LOD/billboard subtree from scratch for
each discovered type. This port keeps only (a). (b) is now entirely up to
the artist — author whatever structure you want (a single mesh, an LOD
group, anything) directly on a plain entity, give it an id, and reference
that id in `items`. This is a direct implementation of what was asked for
("choose the entities that go into the field by id"), not a judgment call —
see `ADDING-FEATURES-WORKFLOW.md`.

Two smaller, necessary consequences of switching from "build from scratch"
to "clone an existing, artist-authored entity":

- **Referenced entities are hidden after cloning** (confirmed design
  choice, not assumed) — otherwise the source entity would ALSO render at
  wherever it happens to be authored in the scene, in addition to every
  placed clone.
- **Rotation and scale compose with the source's own authored values**,
  rather than being set from scratch. The original had nothing to compose
  with (it built instances with no prior transform); once cloning an
  artist-authored entity, respecting whatever baseline transform that
  entity already has (e.g. a fixed correction tilt, or a scale the artist
  already tuned) is the more generically useful default — position is the
  one exception, since "where in the field" has no meaningful reading as
  an offset from wherever the source happens to sit in the editor, so it's
  still always fully field-computed.

The Poisson-disk sampling algorithm itself, the `minCopyDistance`
same-source-spacing logic, and the fixed-width/free-depth strip shape are
all unchanged from the source.

### Why cloning re-applies every component's live data, not just `cloneNode(true)`

`cloneItem()` doesn't just call `item.cloneNode(true)` and move on — it also
walks the cloned subtree in parallel with the source subtree and, for every
element pair, re-applies each of the source element's currently-attached
components' live `.data` onto the corresponding clone (via `setAttribute`),
before the field-computed position/rotation/scale/`visible` are set on the
root. This exists to fix a real, verified bug: `cloneNode(true)` only copies
whatever's literally still in the DOM at clone time, but A-Frame doesn't
necessarily keep an already-initialized component's raw HTML attribute in
sync with its live parsed data. For a referenced entity built from A-Frame's
own `geometry`/`material` components (e.g. a plain
`<a-entity geometry="primitive: cone; ...">`, as used in
`random-field-lod-billboard-proximity-wave-scene.html`), a bare
`cloneNode(true)` clone silently fell back to those components' schema
defaults instead of the authored shape/colour — verified directly by
inspecting a clone's `components.geometry.data`, which came back
`{"primitive":"box", ...}` and `components.material.data` with
`{"color":"#FFF", ...}` instead of the authored cone/orange, with no console
warning at all. `gltf-model`-sourced items (the more common case throughout
this template's other examples) weren't observed to hit this, but the fix
applies uniformly to every component on every element in the cloned
subtree, not just `geometry`/`material` specifically, so there's nothing
`items`-shape-specific left to work around.

### Placement algorithm

Bridson's algorithm: seed one point at the front-centre (z = 0, right in
front of the viewer), then repeatedly pick a random *active* point and try
up to 30 random candidate points in the annulus `[minDistance, maxDistance]`
around it, accepting the first one that both stays inside the width strip
and clears `minDistance` from every existing point. A point that can't
spawn any more valid neighbours after 30 tries is dropped from the active
set. Because depth is unbounded (the strip only has a fixed **width**), the
sampler never runs out of room — however many points are requested
(`copies × items.length`), the field just grows deeper to fit them at the
requested spacing. If the whole frontier stalls before reaching the
requested count (only possible in a degenerate case like `areaWidth`
narrower than `minDistance`), a safety net keeps placing straight back at
`maxDistance` spacing rather than silently placing fewer points than asked.

## 4. Incompatibilities, risks & troubleshooting

### Combining with LOD + Billboard

Just author the `.lod-mesh-group`/`.lod-mesh`/`.lod-billboard` structure
(see `LOD-BILLBOARD-FEATURE-GUIDE.md`) directly on the entity you reference
in `items` — `random-field` deep-clones the whole subtree as-is, LOD
structure included, and each clone registers with the ancestor
`lod-manager` independently once appended (A-Frame initializes
dynamically-added entities the same way as statically-authored ones).

### Combining with Proximity Wave

Put `proximity-wave-group` on the **same** entity as `random-field` (not a
separate wrapper) — see `PROXIMITY-WAVE-FEATURE-GUIDE.md` for why the
group component's children-scan is specifically designed to tolerate
running before or after `random-field`'s own clone creation on the same
entity.

### `minCopyDistance` and very constrained areas

If `areaWidth`/`minDistance`/`maxDistance`/`copies` combine to make the
area too tight to honour `minCopyDistance` for every copy of every
referenced entity, placement doesn't fail — it falls back to spreading
those copies as far apart as it can, best-effort. You won't get an error,
just tighter same-source clustering than requested; loosen the area or
distance settings if that's visible.

### No `items` resolved

If `items` doesn't resolve to anything (typo in the selector, or referenced
entities not yet in the DOM when this component initializes — `selectorAll`
is resolved once, synchronously, at `init()`, not lazily), this logs one
console warning (`[random-field] items resolved to nothing; nothing
placed`) and the field stays empty. Author your `items` entities *before*
the field entity in markup to guarantee they're already in the DOM.

### No interaction found with any other feature on this branch

Only ever creates/positions/hides plain entities — no `document` listeners,
no shared/global state, no material patches, no camera reads. Free to
combine with anything.
