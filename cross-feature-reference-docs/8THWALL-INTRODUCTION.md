# 8th Wall introduction

<!-- overview -->
## Introduction

8th Wall is the part that makes the browser see. It switches on the
phone's camera, shows its picture as the background, and works out from
the moving image where the phone is and where the floor is — so that a
virtual object stays put in the room while the visitor walks around it. It
can also recognise a printed picture and attach content to it. All of this
runs in an ordinary web page; nobody has to install an app.

On AN ALLE! the platform runs 8th Wall for every work. A work doesn't
start or configure it — it uses what 8th Wall provides: the floor, the
camera's position, recognised pictures, the real-world brightness. This
introduction explains those pieces, what changed when 8th Wall became
open source in 2026, and what that means for working with the template.

<!-- /overview -->

## About this guide

For anyone whose scene depends on the camera, the floor or an image
target. Official documentation: [8thwall.org/docs](https://8thwall.org/docs/engine/overview).
How 8th Wall fits with A-Frame, Vue and the host:
[ARCHITECTURE-GUIDE.md](ARCHITECTURE-GUIDE.md).

## 1. What 8th Wall is now

- **Until February 2026** 8th Wall was a hosted service (by Niantic):
  accounts, an online editor, an online image-target tool, app keys.
- **Since 28 February 2026** the hosted platform is gone; 8th Wall
  continues as a free toolset at [8thwall.org](https://8thwall.org/)
  ([announcement](https://www.8thwall.com/blog/post/208587408737/8th-wall-open-source)).
  - The **engine with world tracking (SLAM)** is published as a
    *binary* — free to use, also commercially, under a limited-use licence,
    but not open source. That's `@8thwall/engine-binary`, which this
    template uses.
  - The **framework, image targets, xrextras, tools and examples** are
    open source (MIT) in [github.com/8thwall/8thwall](https://github.com/8thwall/8thwall).
- No account or app key is needed any more. Anything you read about the
  "8th Wall console", "Cloud Editor" or app keys is from before 2026.

## 2. The pieces in this project

| Piece | What it is | Where |
|---|---|---|
| **Engine** (`XR8`, `xr.js`) | Camera access, world tracking, image targets, light estimation. Loaded as a script; afterwards there's a global `XR8` object. | `@8thwall/engine-binary` 1.0.0 |
| **8frame** | 8th Wall's build of A-Frame with the engine integration. Must be the build that pairs with the engine binary (the old CDN build fails with "No valid session manager"). | host: 1.3.0; `dev:ar`: `lib/vendor/8frame-1.5.0.min.js` |
| **`xrweb`** | The A-Frame component on `<a-scene>` that starts world tracking and image targets. Newer docs pair it with `xrconfig`, which is added automatically if missing. | set by the host (and by `ar.html`) — never by a module |
| **xrextras** | Helper components: loading screen, error screen, `xrextras-gesture-detector` (two-finger gestures), `xrextras-named-image-target`, `xrextras-play-video`, … | `@8thwall/xrextras` 1.0.0 |

```
<a-scene xrweb …>            ← host: starts camera + tracking
  <a-camera …>               ← host: 8th Wall moves it with the phone
  <a-entity position="0 1.6 -3">   ← host: mount point
     … your module …
```

## 3. World tracking: floor, camera, scale

With world tracking (`xrweb`), 8th Wall:

- moves the `<a-camera>` with the phone (position and rotation),
- puts the **floor at y = 0** of the scene,
- uses **`scale: responsive`** (the default): the camera's start height in
  the scene stands for the phone's real height above the floor. The host
  starts the camera at `0 0.35 0.8`, so 0.35 units ≈ the phone's real
  height — units are not metres ([xrweb](https://8thwall.org/docs/api/engine/aframe/xrweb)).
  The start scene's `scene-root` rescales this with
  `place-in-front="referenceHeight: 1.5"`, so units inside are roughly
  metres.

Tracking needs a phone (rear camera, motion sensors) and a short movement
before the floor is found; a laptop webcam shows the picture but doesn't
track. To place content on the floor in front of the viewer, use
`place-in-front` — the start scene's `scene-root` does
([SCENE-PLACEMENT-GUIDE.md](SCENE-PLACEMENT-GUIDE.md)).

## 4. Image targets

An image target is a picture 8th Wall recognises in the camera image;
content can be attached to it.

1. **Make the target files** with the official command-line tool
   ([image-target-cli](https://github.com/8thwall/8thwall/tree/main/apps/image-target-cli)):
   ```sh
   npx @8thwall/image-target-cli@latest
   ```
   It asks for the image, the crop, the shape (flat, cylindrical, conical)
   and a name, and writes a `.json` plus `_original`, `_cropped`,
   `_thumbnail`, `_luminance` images. (The old online tool no longer
   exists.)
2. Put the files in `src/image-targets/` and list the `.json` in
   `src/manifest.ts` (`imageTargets: [myTarget]`).
3. In the scene:
   ```html
   <a-entity world-origin>
     <xrextras-named-image-target name="my-target">
       … content: the image is the floor, z is up …
     </xrextras-named-image-target>
   </a-entity>
   ```
   `name` must match the `name` in the JSON. `world-origin` cancels the
   host's mount offset.

Full walk-through, layout convention and debugging:
[Image Tracking guide](../guides/IMAGE-TRACKING-FEATURE-GUIDE.md).

## 5. Events

8th Wall reports what it's doing through events on the **`<a-scene>`**
element — not on `window`, as some older examples suggest
([event list](https://8thwall.org/docs/api/engine/aframeevents)):

| Event | When |
|---|---|
| `realityready` | engine started, first frame processed |
| `realityerror` | engine couldn't start (permission, device, setup) |
| `xrtrackingstatus` | tracking status changed (e.g. limited → normal) |
| `xrimagescanning` | image targets loaded, scanning |
| `xrimagefound` / `xrimageupdated` / `xrimagelost` | a target was found / moved / lost (`detail.name`) |

```js
document.querySelector("a-scene").addEventListener("xrimagefound", (e) => {
  console.log("found", e.detail.name);
});
```

## 6. Other things built on 8th Wall here

- **Light estimation** — `xr-light` follows the real brightness
  ([Light & Reflections](../guides/LIGHT-REFLECTIONS-FEATURE-GUIDE.md)).
- **Camera image as reflection** — `cubemap-realtime` (same guide).
- **Gestures** — `xrextras-gesture-detector` on the host's scene sends the
  two-finger events `gesture-control` uses ([Gestures](../guides/GESTURES-FEATURE-GUIDE.md)).

None of these do anything in `npm run dev` — there's no engine there.

## 7. Testing

- `npm run dev:ar` — real engine; open the printed **https** LAN address on
  a phone and accept the self-signed certificate. HTTPS is required for
  the camera on any address other than `localhost`.
- Without a phone: a headless browser with a generated camera video
  ([HEADLESS-AR-TESTING-GUIDE.md](HEADLESS-AR-TESTING-GUIDE.md)) — checks
  image targets and rendering, not walking around.
- Things that fail silently: the wrong 8frame build, `disableWorldTracking:
  true`, listening on `window` instead of the scene — see
  [Image Tracking §3–4](../guides/IMAGE-TRACKING-FEATURE-GUIDE.md#3-under-the-hood).

## Further reading (official)

- [Engine overview](https://8thwall.org/docs/engine/overview) — loading the engine, A-Frame integration, camera pipeline
- [`xrweb`](https://8thwall.org/docs/api/engine/aframe/xrweb) and [A-Frame events](https://8thwall.org/docs/api/engine/aframeevents)
- [Camera pipeline modules](https://8thwall.org/docs/api/engine/camerapipelinemodule) — for code that hooks into each camera frame
- [Troubleshooting](https://8thwall.org/docs/troubleshooting)
- [xrextras source](https://github.com/8thwall/8thwall/tree/main/packages/xrextras) — its README lists only a few components; the rest are documented in the code
