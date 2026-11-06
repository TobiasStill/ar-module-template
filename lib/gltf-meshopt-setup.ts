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

/**
 * Idempotent: safe to call from every entry point (previews, host bundle).
 *
 * If THREE isn't there yet, retries every frame until it is. In the host,
 * A-Frame is loaded before any module is imported, so the first call
 * patches. In `npm run dev:ar`, ar.html injects 8frame dynamically and the
 * module bundle (which calls this from manifest.ts) can evaluate first —
 * measured: manifest.ts at ~65 ms, THREE at ~160 ms — and a one-shot check
 * silently skipped the patch, so every compressed .glb failed with
 * "setMeshoptDecoder must be called before loading compressed files".
 * Models only start loading once the scene and the module are up, well
 * after 8frame, so patching on a later frame is still in time.
 */
export function patchGLTFLoaderWithMeshoptDecoder(retryUntil = performance.now() + 30000): void {
  const w = window as any;
  const T = w.THREE;
  if (!T?.GLTFLoader) {
    if (performance.now() < retryUntil) {
      requestAnimationFrame(() => patchGLTFLoaderWithMeshoptDecoder(retryUntil));
    }
    return;
  }
  if (T.GLTFLoader.__meshoptPatched) return;

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
