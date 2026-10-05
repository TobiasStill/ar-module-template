// Type definitions for the module manifest (see manifest.ts for the authored
// values). Kept separate so both manifest.ts and host-runtime.ts can import
// the types without pulling in the manifest's runtime dependencies
// (virtual:ar-manifest, component/target imports).
import type { ComponentDefinition } from "aframe";

export interface ManifestAsset {
  id: string;
  src: string;
}

/** Attribute → value pairs recognised on the scene's <a-camera> element. */
export interface CameraProps {
  /** DOM id of the <a-camera> element. */
  id?: string;
  /** `position` component: "x y z". */
  position?: string;
  /** `rotation` component: "x y z" in degrees. */
  rotation?: string;
  /** Built-in `camera` component config string, e.g. "fov: 80; zoom: 1; active: true". */
  camera?: string;
  /** `look-controls` component config string, e.g. "" or "enabled: false". */
  "look-controls"?: string;
  /** `wasd-controls` component config string, e.g. "acceleration: 30". */
  "wasd-controls"?: string;
  /** `cursor` component config string, e.g. "fuse: false; rayOrigin: mouse;". */
  cursor?: string;
  /** `raycaster` component config string, e.g. "objects: .cantap". */
  raycaster?: string;
}

export const CAMERA_PROPS_FORBIDDEN = ["id", "position", "cursor", "raycaster"] as const;

/** Attribute → value pairs applied to the scene's <a-camera> before mount. */
export type CameraSettings = Omit<CameraProps, (typeof CAMERA_PROPS_FORBIDDEN)[number]>;

export interface Manifest {
  assets?: ManifestAsset[];
  camera?: CameraSettings;
  /** A-Frame component name → definition, registered before the module mounts. */
  components?: Record<string, ComponentDefinition>;
  /** XR8 image-target descriptors (the JSON exported by the 8th Wall target tool). */
  imageTargets?: unknown[];
  /**
   * Factor for the intensity of the host's own scene lights while this module
   * is shown (restored on unmount) — e.g. 0.3 for a module that brings its
   * complete lighting. Default 1 = untouched. Applied by lib/main.ts; see
   * lib/host-lights.ts.
   */
  hostLightScale?: number;
}
