import { createApp, h, ref, nextTick } from "vue";
// The module root the host mounts (src/ArModule.vue + the template's global
// per-module setup, e.g. hostLightScale) — not ArModule.vue directly.
import ArModule from "./main";
import { manifest } from "../src/manifest";
import { registerManifestComponents, applyCameraSettings, assetElement } from "./host-runtime";
import { disableFrustumCulling } from "./frustum-culling";

const mockArModule = {
  id: "preview-1",
  text: "Hello from preview",
  url: "preview://local",
  author: "Dev",
  location: { lat: 50.1109, lng: 8.6821 },
  assets: manifest.assets,
  components: [] as { name: string; url: string }[],
  createdAt: new Date().toISOString()
};

// Mount the module only once the scene (and its <a-assets>) has finished loading.
// Otherwise `gltf-model="#id"` parses its selector before the dynamically
// rendered <a-asset-item> is registered and A-Frame reports "asset not found".
// This mirrors the host, which injects the asset items before mounting a module.
const assetsReady = ref(false);

const PreviewApp = {
  render() {
    const children = [
      // Mirror the host: declare the manifest's assets up front so the module
      // can reference them by id (served from src/assets/ by the dev plugin).
      h(
        "a-assets",
        { timeout: "10000" },
        manifest.assets && manifest.assets.map((a) => {
          const el = assetElement(a);
          return h(el.tag, el.attrs);
        })
      ),
      // The host's two always-on scene lights (frontend/src/components/
      // ArScene.vue in ar-demo-backend), so the module previews under the
      // light it gets in the app — and `hostLightScale` has something to scale.
      h("a-light", { type: "ambient", color: "#BBB" }),
      h("a-light", { type: "directional", color: "#FFF", intensity: "0.6", "cast-shadow": "true", position: "-0.5 1 1" }),
      h("a-camera", {
        id: "camera",
        position: "0 0 0",
        raycaster: "objects: .cantap",
        cursor: "fuse: false; rayOrigin: mouse;",
        "wasd-controls": "acceleration: 30",
        "look-controls": ""
      })
    ];

    if (assetsReady.value) {
      children.push(
        h("a-entity", { position: "0 1.5 0" }, [h(ArModule, { arModule: mockArModule })])
      );
    }

    return h("a-scene", { background: "color: #1e293b" }, children);
  }
};

const app = createApp(PreviewApp);
app.config.compilerOptions = {
  ...(app.config.compilerOptions ?? {}),
  isCustomElement: (tag: string) => tag.startsWith("a-")
};
app.mount("#app");

nextTick(() => {
  const scene = document.querySelector("a-scene") as (Element & { hasLoaded?: boolean }) | null;
  if (!scene) return;

  // We arm mount() via two independent triggers (below) because neither is
  // reliable alone — but mount() is NOT idempotent: applyCameraSettings snapshots
  // the camera's current attributes as "previous", so a second run would capture
  // the already-applied manifest values and a later teardown would restore the
  // wrong state. Guard so only the first trigger wins.
  let mounted = false;
  const mount = () => {
    if (mounted) return;
    mounted = true;
    // Mirror the host: register the manifest's A-Frame components and apply its
    // camera settings before the module renders (the template uses them).
    registerManifestComponents(manifest);
    applyCameraSettings(document.querySelector("a-camera"), manifest.camera);
    assetsReady.value = true;
  };

  // Mounting on the next frames guarantees the <a-asset-item> elements are in
  // the DOM (and registered) before the module's `gltf-model="#id"` resolves its
  // selector — without depending on the scene's `loaded` event, which some
  // runtimes emit late or not at all.
  if (scene.hasLoaded) mount();
  else scene.addEventListener("loaded", mount);
  requestAnimationFrame(() => requestAnimationFrame(mount));

  // Keep animated skinned meshes from being frustum-culled (see the helper).
  // model-loaded bubbles, so one delegated listener on the scene covers all.
  scene.addEventListener("model-loaded", (e: any) => disableFrustumCulling(e.target));
});
