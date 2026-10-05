import { defineComponent, h, onBeforeMount, onUnmounted } from "vue";
import ArModuleContent from "../src/ArModule.vue";
import { manifest } from "../src/manifest";
import { scaleSceneLights } from "./host-lights";

// The host imports this bundle and reads `mod.manifest` to wire the module up
// before mounting it: inject assets, apply camera settings, register A-Frame
// components, and configure image targets. See src/manifest.ts for the shape.
export { manifest };

// The module root the host (and both previews) mount: src/ArModule.vue plus
// the template's global per-module setup, so a module never has to bring its
// own. Currently: scale the scene's existing (= the host's) lights by
// `manifest.hostLightScale` while the module is shown — see host-lights.ts.
// Props/attrs (`arModule`) pass straight through to ArModule.vue.
const ArModule = defineComponent({
  name: "ArModuleRoot",
  inheritAttrs: false,
  setup(_props, { attrs }) {
    let restoreLights = () => {};
    onBeforeMount(() => {
      restoreLights = scaleSceneLights(manifest.hostLightScale);
    });
    onUnmounted(() => restoreLights());
    return () => h(ArModuleContent as any, attrs);
  }
});

export default ArModule;
