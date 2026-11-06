# Portal feature guide

<!-- overview -->
## Overview

A magic door into another world. From outside, the visitor sees a doorway
standing in the real street, and through it a glimpse of a different place
— but walking around it, there is nothing behind the frame. Step through
the door and the other world is suddenly all around them; looking back, a
round window may still show the real world they came from. The door can
start closed and spring open with a bouncy animation when the visitor taps
Start.

<!-- /overview -->

## Technical summary

A walk-through portal: from outside, another world is visible only through
a doorway; step through the door plane and you are inside it, all around —
optionally with a round window back to the real world, and a door that
springs open on a Start tap. Applicable to any entity — see
[3. Under the hood](#3-under-the-hood).

<!-- project-specific -->
### Project context: origin

Generalised from the Augmented Bahnhofsviertel ports
(`augmented-bahnhofsviertel`: `legacy-portal`, #22 Privileged I, #7 I
can't get no). The default opening animation is #7's springy 1.5 s door.

<!-- /project-specific -->

Files:

```
src/a-frame-components/portal.ts
examples/portal-usage.html   # scene wiring + attribute reference
```

No assets. The masking uses `xrextras-hider-material`, which the host and
both previews provide.

## 1. Step-by-step: adding this to a new project

1. **Copy** `portal.ts` into `src/a-frame-components/`.

2. **Nothing to register** — every component file in
   `src/a-frame-components/` is registered automatically under its file
   name as soon as the scene uses it (README, "The manifest"); unused ones
   aren't even bundled. Only a component registered under a different name,
   or one whose name is built at runtime, needs a manual entry in
   `src/manifest.ts`.

3. **Build the scene** (`examples/portal-usage.html`): an entity with
   `portal` whose origin is the door; behind it (−z) the `contents`, around
   them hider `walls`, optionally a `door` ring and a `portalWall`. Usually
   inside a [Placement](PLACEMENT-FEATURE-GUIDE.md) scene.

4. **Build and test** — `npm run dev:ar` on a phone: from outside you see
   the inside world only through the doorway; walk through it (or, in
   `npm run dev`, WASD through it) — the world surrounds you.

## 2. Entities & attributes

| Attribute | Type | Default | Meaning |
|---|---|---|---|
| `width` / `height` | number | `10` / `10` | Doorway size in local units: crossing counts only within \|x\| < width/2, y < height. |
| `contents` | selector | — | The world behind the door. |
| `walls` | selector | — | Hider walls masking `contents` from outside. |
| `portalWall` | selector | — | Optional hider shape at the door, shown only from inside (a window back out). |
| `door` | selector | — | Optional hider ring covering the doorway; opened/closed by events. |
| `openRadius` | number | `5` | Ring inner radius when open. |
| `openDuration` | number | `1500` | ms. |
| `openEasing` | string | `easeOutElastic` | A-Frame animation easing. |
| `hiderOrder` / `contentsOrder` | number | `1` / `2` | renderOrder for hiders (walls, portalWall, door) and contents. |

Events: **in** `portal-open`, `portal-close`; **out** `portal-enter`,
`portal-exit` when the camera crosses the door plane inside the doorway.

## 3. Under the hood

**Hider masking.** `xrextras-hider-material` writes depth but no colour —
the camera image shows through, and everything drawn *after* it and behind
it is hidden. Outside the door, the walls hide the contents everywhere
except through the doorway. Inside (after crossing the plane z = 0 within
the doorway), walls are switched off and the contents show all around; the
`portalWall` (if any) is switched on to keep a hole back to the real world.

**Draw order is pinned.** The hiders only work if they draw before the
contents. three r137 (8frame 1.3 — the host app) sorts opaque objects by
material id (creation order), r158 (8frame 1.5) by distance only — so
without explicit order the result flips with every camera move (e.g. a
video in front of the door turns invisible, the inside world flashes).
`portal` sets `renderOrder` on every mesh:
hiders 1, contents 2, everything else stays 0 and draws first. It re-applies
whenever a mesh appears below it (`object3dset` bubbles), so glTF contents
that load later are covered.

**Camera in the portal's space.** A module never owns the camera, and the
portal usually sits in a placed/scaled parent, so `portal` converts the
camera's world position into its own space every tick.

**Door.** A hider `a-ring` with `radius-inner` ≈ 0 covers the doorway;
`portal-open` animates the inner radius to `openRadius` (by default a
springy 1.5 s opening), `portal-close` back.

<!-- project-specific -->
#### Project context: Augmented Bahnhofsviertel

The draw-order flip was found on an Augmented Bahnhofsviertel work (a video
in front of the door invisible, the inside world flashing). The original
portal component sat on the camera and read its local position as scene
coordinates, which doesn't work for a module.

<!-- /project-specific -->

## 4. Incompatibilities, risks & troubleshooting

- **renderOrder of contents is overwritten.** Meshes inside `contents`,
  `walls`, `portalWall` and `door` get the portal's orders. Don't use
  [Render Order](RENDER-ORDER-FEATURE-GUIDE.md) /
  [Mesh Render Order](MESH-RENDER-ORDER-FEATURE-GUIDE.md) /
  [LOD + Billboard](LOD-BILLBOARD-FEATURE-GUIDE.md) inside the portal
  subtree — see [cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md](../cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md).
- **Transparent contents.** Transparent objects are sorted after opaque
  ones regardless of renderOrder groups' intent; a transparent object
  inside may show through the hiders. Keep portal contents opaque, or test
  carefully.
- **Hiders hide host content too.** Anything of the host's scene behind a
  hider (posts, strokes) disappears while the walls are visible. Keep the
  portal compact.
- **Crossing outside the doorway** (walking around the walls) doesn't
  switch to inside, by design — the walls stay.
- **Video in the contents** needs a tap to start with sound — use
  [Video](VIDEO-FEATURE-GUIDE.md)'s `video-control`.
