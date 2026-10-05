import { createApp, h, ref, nextTick } from "vue";
import ArModule from "../src/ArModule.vue";
import { manifest } from "../src/manifest";
import {
  registerManifestComponents,
  applyCameraSettings,
  applyHostLights,
  configureImageTargets,
  assetElement
} from "./host-runtime";
import { disableFrustumCulling } from "./frustum-culling";

// Same data shape the host injects.
const mockArModule = {
  id: "preview-1",
  text: "Hello from AR preview",
  url: "preview://local",
  author: "Dev",
  location: { lat: 50.1109, lng: 8.6821 },
  assets: manifest.assets,
  components: [] as { name: string; url: string }[],
  createdAt: new Date().toISOString()
};

// Mirror @8thwall/engine-binary's tiny entry: resolve once the engine (xr.js,
// loaded via the script tag in ar.html) has booted. Inlined so the module's
// TypeScript/library build never has to depend on the engine package — only its
// dist/ is needed at runtime (copied to /external/xr by vite-plugin-static-copy).
const XR8Promise: Promise<any> = new Promise((resolve) => {
  const w = window as any;
  if (w.XR8) resolve(w.XR8);
  else window.addEventListener("xrloaded", () => resolve(w.XR8), { once: true });
});

const xrReady = ref(false);
const assetsReady = ref(false);

// Pre-flight the camera permission (8th Wall then takes over the stream). Matches
// the host's usePermissions.requestCamera so the prompt fires reliably.
navigator.mediaDevices
  ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
  .then((s) => s.getTracks().forEach((t) => t.stop()))
  .catch(() => { /* user can still grant when xrweb prompts */ });

XR8Promise.then((XR8: any) => {
  // Image targets are a session capability: they must be present in the FIRST
  // configure() — before <a-scene xrweb> starts the session. Passing them later
  // (in mount) is rejected with "Image Targets are not supported in the current
  // session", so declare them up-front here.
  XR8.XrController.configure({ imageTargetData: manifest.imageTargets });
  xrReady.value = true;
});

const ArPreviewApp = {
  render() {
    if (!xrReady.value) {
      return h(
        "div",
        { style: "color:#94a3b8;font-family:sans-serif;padding:24px" },
        "Initializing 8th Wall AR…"
      );
    }

    const children = [
      // Same asset injection as the VR preview / host.
      h(
        "a-assets",
        { timeout: "10000" },
        manifest.assets && manifest.assets.map((a) => {
          const el = assetElement(a);
          return h(el.tag, el.attrs);
        })
      ),
      // The host's two scene lights, grouped as in the host (ArScene.vue in
      // ar-demo-backend), so the module previews under the light it gets in
      // the app — and `hostLights: false` (applyHostLights) can switch them off.
      h("a-entity", { id: "host-lights" }, [
        h("a-light", { type: "ambient", color: "#BBB" }),
        h("a-light", { type: "directional", color: "#FFF", intensity: "0.6", "cast-shadow": "true", position: "-0.5 1 1" })
      ]),
      h("a-camera", {
        id: "camera",
        position: "0 0 0",
        raycaster: "objects: .cantap",
        cursor: "fuse: false; rayOrigin: mouse;"
      })
    ];

    if (assetsReady.value) {
      // Placed like the host (AR_MODULE_POSITION) so the module previews where it
      // would actually appear in the app.
      children.push(
        h("a-entity", { id: "module-root", position: "0 1.6 -3" }, [
          h(ArModule, { arModule: mockArModule })
        ])
      );
    }

    return h(
      "a-scene",
      {
        "xrextras-loading": "",
        "xrextras-runtime-error": "",
        "xrextras-gesture-detector": "",
        xrweb: "disableWorldTracking: false",
        "xr-mode-ui": "enabled: false",
        renderer: "colorManagement: true"
      },
      children
    );
  }
};

const app = createApp(ArPreviewApp);
app.config.compilerOptions = {
  ...(app.config.compilerOptions ?? {}),
  isCustomElement: (tag: string) => tag.startsWith("a-")
};
app.mount("#app");

nextTick(() => {
  const waitForScene = () => {
    const scene = document.querySelector("a-scene") as (Element & { hasLoaded?: boolean }) | null;
    if (!scene) {
      requestAnimationFrame(waitForScene);
      return;
    }
    // Two independent triggers arm mount() (below); neither is reliable alone.
    // But mount() is NOT idempotent: applyCameraSettings snapshots the camera's
    // current attributes as "previous", so a second run would capture the
    // already-applied manifest values and a later teardown would restore the
    // wrong state. Guard so only the first trigger wins.
    let mounted = false;
    const mount = () => {
      if (mounted) return;
      mounted = true;
      // Mirror the host: register the manifest's A-Frame components, apply its
      // camera settings, and feed its image targets to XR8 before mounting.
      registerManifestComponents(manifest);
      applyCameraSettings(document.querySelector("a-camera"), manifest.camera || {});
      applyHostLights(manifest);
      configureImageTargets((window as any).XR8, manifest.imageTargets || []);
      assetsReady.value = true;
    };
    // Mount the module after the scene/assets register, so `gltf-model="#id"`
    // resolves its selector (avoids "asset not found").
    if (scene.hasLoaded) mount();
    else scene.addEventListener("loaded", mount);
    requestAnimationFrame(() => requestAnimationFrame(mount));

    // Keep animated skinned meshes from being frustum-culled (see the helper).
    // model-loaded bubbles, so one delegated listener on the scene covers all.
    scene.addEventListener("model-loaded", (e: any) => disableFrustumCulling(e.target));
  };
  waitForScene();
});
