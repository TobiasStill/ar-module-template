// Ambient type for the asset manifest the Vite plugin generates from
// `src/assets/` (see `arModuleAssets()` in vite.config.ts). This declares ONLY
// the auto-derived asset list. The full, authored manifest (assets + camera +
// components + image targets) lives in `src/manifest.ts`, which imports this.
declare module "virtual:ar-manifest" {
  /** Asset descriptors derived from files in `src/assets/` at build time. */
  export interface ManifestAsset {
    id: string;
    src: string;
  }
  export interface AssetManifest {
    assets: ManifestAsset[];
  }
  export const manifest: AssetManifest;
  export default manifest;
}

// The A-Frame components this module uses, imported and keyed by name
// (file name in src/a-frame-components/) — see autoComponents() in
// vite.config.ts and scripts/used-components.ts.
declare module "virtual:used-components" {
  import type { ComponentDefinition } from "aframe";
  export const usedComponents: Record<string, ComponentDefinition>;
  export default usedComponents;
}
