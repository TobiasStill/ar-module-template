// The module's manifest — the single object the host reads off the published
// bundle as `mod.manifest`. It bundles everything the host must wire up *before*
// mounting the component:
//
//   - assets       → injected into the scene's <a-assets> as <a-asset-item>
//   - camera       → attributes applied to the scene's <a-camera>
//   - components   → A-Frame components registered via AFRAME.registerComponent
//   - imageTargets → XR8 image-target data fed to XR8.XrController.configure
//
// `assets` is derived automatically from `src/assets/` by the Vite plugin
// (virtual:ar-manifest). `components` is automatic too (virtual:used-
// components): every file in src/a-frame-components/ with a default export
// is a component named after its file (`place-in-front.ts` →
// `place-in-front`), and exactly the ones the module uses — found by name in
// ArModule.vue and the other src/*.vue / src/*.ts files — are bundled and
// registered. Nothing to import or list here for that; see
// scripts/used-components.ts. `camera` and `imageTargets` are authored here
// by hand.
//
// Naming convention for src/a-frame-components/ and src/assets/, so files
// from different features can share these two flat folders (both are
// scanned by plain file name, non-recursively — subfolders silently don't
// work; and a component's file name IS its registered name) without needing to be sorted into subfolders or
// moved when copied into another project:
//   - a feature's own files are prefixed with its name, e.g. sound-*.ts /
//     sound-*.webp for everything specific to the sound-button feature —
//     this also groups them together under plain alphabetical sort.
//   - genuinely generic, feature-agnostic building blocks that any feature
//     may depend on keep an unprefixed or `ar-`-prefixed name instead (e.g.
//     ar-button.ts, ar-button-manager.ts, no-frustum-cull.ts) — don't give
//     these a feature prefix even if only one feature currently uses them.
import { manifest as assetManifest } from "virtual:ar-manifest";

import { usedComponents } from "virtual:used-components";
import type { Manifest } from "../lib/manifest.types";
import { patchGLTFLoaderWithMeshoptDecoder } from "../lib/gltf-meshopt-setup";

// Runs as soon as this module is imported — by the local previews AND by the
// production host, since both must import `manifest` to do anything with this
// module. Lets glb assets compressed with `scripts/compress-assets.ts`
// (gltfpack -c under the hood) actually load; see gltf-meshopt-setup.ts and
// cross-feature-reference-docs/ASSET-COMPRESSION-GUIDE.md for why this is
// necessary. Safe to call even if a project never compresses any assets —
// idempotent, and a no-op cost otherwise.
patchGLTFLoaderWithMeshoptDecoder();

export const manifest: Manifest = {
  // Auto-scanned from src/assets/; file name (sans extension) is the asset id.
  assets: assetManifest.assets,

  // Registered automatically: the components in src/a-frame-components/
  // this module uses (see the header). To register a component under a
  // name other than its file name — or one whose name is only built at
  // runtime — import it above and add it after the spread:
  //   components: { ...usedComponents, "my-name": myComponent }
  components: {
    ...usedComponents
  }

  // No image targets registered by default — see guides/IMAGE-TRACKING-FEATURE-GUIDE.md
  // for how to add one (an `imageTargets: [yourTarget]` entry here, importing
  // your own src/image-targets/*.json).
};

export default manifest;
