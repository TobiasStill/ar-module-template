# Headless AR testing (fake camera + emulated phone)

<!-- overview -->
## Introduction

AR scenes are normally tested by walking around with a phone in hand. That
isn't always possible — for instance when an AI assistant, which has no
phone and no hands, is supposed to check whether a scene works. This guide
describes a stand-in: a computer pretends to be an iPhone, and instead of a
real camera it is shown a short, generated video in which the scene's
target picture drifts gently back and forth, as if a hand were holding the
phone. The AR engine sees that "camera image", recognises the picture and
places the scene on it, and a screenshot plus the error log show whether
everything appeared as it should.

It's a quick health check, not a replacement for the real thing: walking
around, real phone speed and how a scene feels in the hand can only be
judged on an actual device.

<!-- /overview -->

## About this guide

How to check a scene in a real 8th Wall AR session (`dev:ar`) without a
phone: headless Chromium via Playwright, an emulated iPhone, and a
generated video of the image target fed in as the camera. Mainly meant
for AI agents, which can't hold a phone but can read screenshots and
console output. Not tied to one feature, so it lives here rather than in
a feature guide.

<!-- project-specific -->
### Project context: `animationssystem-wanderer`

Verified 29.09.2026 on `animationssystem-wanderer`: the `an-alle-target`
image target was detected, the scene anchored on it and rendered
(wanderers, rings, tutorial overlay), console free of real errors. That
branch is a good test candidate (target in `src/image-targets/`). On
`feature_template`, copy the demo target from `examples/image-targets/` into
`src/image-targets/` for the test and remove it afterwards.

<!-- /project-specific -->

## What this can and cannot verify

Can: the image target is detected and the scene anchors on it; the scene
renders (models, materials, overlays, tutorial/UI text, layout at phone
viewport size); console errors and uncaught exceptions; basic tap
interactions.

Cannot: SLAM/world tracking driven by real device motion (no IMU, the
"camera" is a flat video), real-device performance (WebGL runs on
SwiftShader, a software renderer, so frame rate and GPU-specific bugs say
nothing), WebXR `immersive-ar` sessions, how interaction actually feels.
Those still need a test on a real phone (`npm run dev:ar`, open the LAN
URL, see README.md).

## Branch

`feature_template` has no visible scene content of its own (its start
scene is a light and a shadow-only floor), so it shows the camera feed and
nothing else. Test on a branch with an actual scene. With an image target
in `src/image-targets/`, the check also covers detection and anchoring
(the procedure below; keep the target inside `world-origin`). Without one,
world-tracked content usually stays out of the screenshot (no device
motion, the camera never looks down at the floor), but the console works
and placement can still be checked by numbers: read world positions in a
`page.evaluate` (e.g. `el.object3D.getWorldPosition(...)` for the camera,
`#module-root`, `#scene-root` and your content). That's how the
measurements in [SCENE-PLACEMENT-GUIDE.md](SCENE-PLACEMENT-GUIDE.md#6-measurements)
were taken.

## Prerequisites (once per machine)

- `npm install` (Playwright is already a devDependency).
- `npx playwright install chromium`: browser build matching the repo's
  Playwright version.
- `ffmpeg` (e.g. `brew install ffmpeg`) to generate the camera video.

## 1. Generate the fake camera video

Chromium's fake capture device plays a `.y4m` file as the camera. A
static frame of the target was not what we verified; a slowly moving
target (like a hand-held phone drifting) is. Use the target's
`_luminance.png` from `src/image-targets/`, placed smaller than the frame
on a neutral background, portrait:

```sh
ffmpeg -loglevel error -y \
  -f lavfi -i color=c=0x707070:s=720x960:r=30:d=10 \
  -loop 1 -i src/image-targets/<target>_luminance.png \
  -filter_complex "[1:v]scale=520:-1[t];[0:v][t]overlay=x='100+30*sin(2*PI*t/5)':y='(H-h)/2+30*cos(2*PI*t/5)':shortest=1,format=yuv420p" \
  /tmp/target-moving.y4m
```

`.y4m` is uncompressed: 10 s at this size is ~300 MB. Keep it outside
the repo (never commit it) and delete it afterwards.

## 2. Start the AR dev server

```sh
npx vite --mode ar --port 5199
```

Same as `npm run dev:ar` minus `--open` (no browser window to pop up),
on a fixed port for the script below. Serves https with a self-signed
cert.

## 3. Run the check

Save outside the repo, e.g. `/tmp/ar-check.mjs`, adjust the two
absolute paths, run with `node /tmp/ar-check.mjs`:

```js
import { chromium, devices } from '/ABS/PATH/TO/ar-module-template/node_modules/playwright/index.mjs';

const VIDEO = '/tmp/target-moving.y4m';
const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${VIDEO}`,
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const ctx = await browser.newContext({
  ...devices['iPhone 15 Pro'],
  ignoreHTTPSErrors: true, // self-signed dev cert
  permissions: ['camera'],
});
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', e => logs.push(`PAGEERROR: ${e.message}`));

await page.goto('https://localhost:5199/ar.html');
await page.waitForTimeout(4000);
await page.mouse.click(196, 426);     // tap mid-screen: dismisses tap-to-start overlays (e.g. sound unlock)
await page.waitForTimeout(12000);     // engine start + target detection
await page.screenshot({ path: '/tmp/ar-check.png' });
console.log(logs.join('\n'));
await browser.close();
```

Then look at `/tmp/ar-check.png`: target detected means the scene sits
on the (tinted) target in the frame; only the raw camera image means it
was not detected (wrong branch, wrong target image, or wait longer).

The import uses an absolute path because a script outside the repo
can't resolve the repo's `node_modules` by package name (ES modules
ignore `NODE_PATH`).

## Expected console noise (not errors)

Seen on a working scene, safe to ignore: `GPU stall due to ReadPixels`
and `CONTEXT_LOST_WEBGL: loseContext` (SwiftShader/engine internals),
`THREE.WebGLRenderer: ... useLegacyLights has been deprecated`, Vue's
`compilerOptions ... runtime-only build` warning, `core:schema:warn
Default value 0 does not match type color`, `meshopt_decoder is using
experimental SIMD support`. Anything tagged `PAGEERROR` or `error:` is
worth a look.

## Cleanup

Stop the dev server, delete the `.y4m`, the script and the screenshot
(all outside the repo), and switch back to the branch you started on.
