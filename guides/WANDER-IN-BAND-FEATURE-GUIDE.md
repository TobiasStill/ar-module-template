# Wander-in-band feature guide

Makes an entity continuously orbit within an annulus ("band") around a
center entity — a steady baseline circular orbit with a randomly
retargeted angular deviation layered on top, subtle vertical floating, soft
spiral-back at the band's edges, and gentle mutual avoidance of other
`wander-in-band` entities sharing the same DOM parent. Ported from
`Fanyu_module`, essentially unchanged — see
[3. Under the hood](#3-under-the-hood) for the one cosmetic normalization
made and why nothing else needed to change.

Files:

```
src/a-frame-components/wander-in-band.ts
examples/wander-in-band-usage.html   # scene wiring + full attribute reference
```

No assets. Independent of `follow-node` (see
`FOLLOW-NODE-FEATURE-GUIDE.md`) — both were ported from the same source
branch in the same batch, but neither depends on the other; the source
project just happened to use them side by side (a wandering creature
carrying a positional `sound`, with `follow-node` used elsewhere for the
main character's sound source).

## 1. Step-by-step: adding this to a new project

1. **Copy the file** — `wander-in-band.ts` — into your project's own
   `src/a-frame-components/`. No path changes, no data files.

2. **Register it** in your project's `src/manifest.ts`:

   ```ts
   import wanderInBand from "./a-frame-components/wander-in-band";

   export const manifest: Manifest = {
     assets: assetManifest.assets,
     components: {
       // ...whatever you already have...
       "wander-in-band": wanderInBand
     }
   };
   ```

3. **Wire it into the scene** — see
   [2. Entities & attributes](#2-entities--attributes) or copy directly
   from `examples/wander-in-band-usage.html` (including the
   mutual-avoidance pattern — see [4](#4-incompatibilities-risks--troubleshooting)
   for the scoping rule that depends on).

4. **Build and test** — `npm run build`, then `npm run dev` (a VR/desktop
   preview is enough to see the wandering motion; no phone needed).

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `center` | selector | — | Required. The entity the band is centered on. |
| `innerRadius` | number | `3` | Band's inner edge, metres from `center`. |
| `outerRadius` | number | `7` | Band's outer edge, metres from `center`. |
| `floatIntensity` | number | `0.15` | Amplitude (metres) of a subtle up/down bob around the entity's own starting Y (its "ground" height at spawn). |
| `speed` | number | `0.3` | Orbit speed, metres/second. |
| `chaos` | number | `0.5` (0-1) | How much and how often the heading deviates from a clean orbit — low traces a steady circle, high lets the entity turn sharply and temporarily abandon the orbit before smoothly resuming. |
| `yawOffset` | number | `0` (degrees) | Added to the computed heading, for a model whose forward axis isn't local +Z — try `180` first if a model appears to walk backwards. |

```html
<a-entity id="centerPoint" position="0 0 -10"></a-entity>

<a-entity
    gltf-model="#MyCreature"
    wander-in-band="center: #centerPoint; innerRadius: 6; outerRadius: 12; speed: 0.35; chaos: 0.15">
</a-entity>
```

Nothing to call — once `center` resolves, the entity starts wandering
immediately from a random spawn point inside the band. Whatever static
`position`/`rotation` you authored in markup is only an initial pose; this
component owns `position` and `rotation.y` from `init()` onward. Two
entities with identical attribute values still wander independently — each
seeds its own random heading/timing/orbit-direction once, at `init()`.

## 3. Under the hood

### What changed from the source

Only one thing, and it's cosmetic: the source accessed three.js via
`declare const AFRAME: any; const THREE = (AFRAME as any).THREE;`; this
port uses the bare `declare const THREE: any;` every other component on
this branch already uses (the same global object `AFRAME.THREE` points
at). No behavior change. Nothing else was touched — see the note below on
why.

### The movement model

The baseline heading always follows the *tangent* of the circle at the
entity's current position, rotated consistently by a per-instance
`orbitDir` (seeded once, ±1) — so "keep turning slightly" and "eventually
complete the loop" are automatic consequences of ordinary circular motion,
not something bolted on separately. `chaos` then adds a randomly
retargeted angular *deviation* from that tangent: both how large the
deviation can get and how often it's retargeted scale with `chaos` (from a
calm ~4°, retargeted every 4-8s at `chaos: 0`, up to ~150°, retargeted
every 0.8-2s at `chaos: 1`), smoothly blended toward rather than snapped.

Near the band's inner/outer edges, a gentle spiral-back bias blends into
the tangent itself — within a tolerance zone (40% of the band's width,
minimum 0.5m) *before* any hard correction — so drifting past the nominal
radius doesn't cause a sudden snap-turn. A hard position clamp still exists
beyond that tolerance zone as a safety net (e.g. against spawn overlap or
an extreme chaos spike), but the soft steering is what normally keeps the
entity in bounds. Height is a simple sine bob around the entity's own
spawn-time Y (`floatIntensity` scales the amplitude only — frequency is
fixed); `rotation.y` follows the computed heading directly (plus
`yawOffset`), so the model visibly faces its direction of travel.

### Why no functional changes were needed

Checked deliberately, not skipped: every tunable (radii, float, speed,
chaos, yaw) is a freely-set schema attribute with sensible defaults, none
hardcoded to a specific model or scene. The "avoid overlapping with
similar entities" behavior is scoped by DOM parent (see below) — a
generically reasonable authoring convention (group wanderers you want
mutually aware of each other under one wrapper entity), not a hidden
project-specific assumption. The component was already exactly as generic
as this port needed it to be.

## 4. Incompatibilities, risks & troubleshooting

### Mutual avoidance is scoped by DOM parent — know this before nesting

The "gently avoid other wanderers" behavior only looks at
`[wander-in-band]` entities that share this entity's *exact* parent
element (`self.el.parentEl?.querySelectorAll("[wander-in-band]")`, cached
once on first tick). Two wanderers under *different* wrapper entities
wander with zero awareness of each other, even if their bands overlap in
space — put every wanderer that should avoid the others under one shared
wrapper entity (see `examples/wander-in-band-usage.html`'s Example 2). This
also means adding a new wanderer to a group *after* an existing one's
first tick won't be picked up by that existing one's already-cached
sibling list — if you add wanderers dynamically at runtime rather than all
at once in markup, expect one-directional avoidance until everyone's had a
chance to (re-)query.

### Real conflict with `attach-to` (and `ground-decal` with `live: true`) — do not combine on the same entity

Only ever writes this entity's own `position`/`rotation.y`, every tick,
with no awareness of anything else doing the same. Combining with
[`attach-to`](ATTACH-TO-FEATURE-GUIDE.md) (or
[`ground-decal`](GROUND-DECAL-FEATURE-GUIDE.md) with `live: true`) on the
*same* entity means whichever component's `tick()` runs last —
same-element registration order, the rule documented in
[RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §5.2](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md#52-multiple-components-mutating-nodematerial-on-the-same-element--order-matters)
for materials, applies identically to transform writes — simply overwrites
whatever the other one just set, with no composition. If you need
"wander around a point that itself moves", put `attach-to` on a parent
entity and `wander-in-band` on a child of it instead.

### No other interaction found with any other feature on this branch

No `document`-level listeners, no shared/global state, no material
patches, no camera reads — free to combine with `ar-button`,
`sound-button`, `follow-node`, `trim-loop-clip`, or anything else not
mentioned above. If you want a wandering entity to also be
tappable (e.g. with `ar-button`'s bounding-box trigger zone), that's a
plain co-location — `wander-in-band` moving the entity every frame doesn't
interfere with `ar-button`'s own per-frame raycast, since that raycast
already reads the entity's *current* transform each tick regardless of
what's driving it.

### `center` resolving late, or not at all

If `center` doesn't resolve to anything (typo in the selector, or the
center entity not yet in the DOM when this component initializes), this
logs one console warning (`[wander-in-band] no "center" entity resolved —
staying put.`) and the entity simply doesn't move — not a crash. Once
`center` does resolve on some later tick, wandering starts from that point
on, from whatever position the entity happened to be sitting at (not a
fresh random spawn — the random-spawn logic only runs once, in `init()`).
