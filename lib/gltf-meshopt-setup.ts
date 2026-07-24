// A-Frame 1.3.0 / 8th Wall's 8frame never wires a meshopt decoder into their
// internal THREE.GLTFLoader, so any .glb compressed with `gltfpack -c`
// (EXT_meshopt_compression) fails to load at all — three.js requires an
// explicit `loader.setMeshoptDecoder(...)` call before parsing such files, and
// nothing in this stack ever makes that call. This patches every
// THREE.GLTFLoader instance (however A-Frame constructs it) to have a decoder
// wired up automatically, so compressed assets just work.
//
// Vendored from three@0.137.0 (the version 8frame-1.3.0/aframe 1.3.0 bundle)
// — a self-contained ES module with the wasm decoder inlined, no dependency
// on the THREE global.
//
// See cross-feature-reference-docs/ASSET-COMPRESSION-GUIDE.md for the full
// picture: why this exists, how to actually produce meshopt-compressed
// assets (scripts/compress-assets.ts), and the pitfalls found while doing so
// on real projects.
import { MeshoptDecoder } from "./vendor/meshopt_decoder.module.js";

/** Idempotent: safe to call from every entry point (previews, host bundle). */
export function patchGLTFLoaderWithMeshoptDecoder(): void {
  const w = window as any;
  const T = w.THREE;
  if (!T?.GLTFLoader || T.GLTFLoader.__meshoptPatched) return;

  const OriginalGLTFLoader = T.GLTFLoader;
  function PatchedGLTFLoader(this: unknown, ...args: unknown[]) {
    const loader = new OriginalGLTFLoader(...args);
    loader.setMeshoptDecoder(MeshoptDecoder);
    return loader;
  }
  PatchedGLTFLoader.prototype = OriginalGLTFLoader.prototype;
  (PatchedGLTFLoader as any).__meshoptPatched = true;
  T.GLTFLoader = PatchedGLTFLoader;
}
