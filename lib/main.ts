import ArModule from "../src/ArModule.vue";

// The host imports this bundle and reads `mod.manifest` to wire the module up
// before mounting it: inject assets, apply camera settings, register A-Frame
// components, and configure image targets. See src/manifest.ts for the shape.
export { manifest } from "../src/manifest";

export default ArModule;
