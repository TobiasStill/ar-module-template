// Shared "host" wiring used by the local previews so they mount a module exactly
// like the production host (frontend/src/components/ArModule.vue) does: register
// the manifest's A-Frame components, apply its camera settings, and configure its
// image targets — then tear them all down again. Each apply* returns a teardown
// fn so previews can clean up on hot-reload / unmount, mirroring the host.
import {CAMERA_PROPS_FORBIDDEN, Manifest, ManifestAsset} from './manifest.types';

declare const AFRAME: any;

const VIDEO_EXT = ["mp4", "webm", "m4v", "mov", "ogv"];
const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"];
const AUDIO_EXT = ["mp3", "wav", "aac", "m4a", "ogg"];

/**
 * The right <a-assets> child for an asset, chosen by file extension. A-Frame
 * needs media as the matching element type — a `<video>` for clips (so
 * `xrextras-play-video="video: #id"` has something playable), an `<img>` for
 * textures/thumbs, an `<audio>` for sound — and `<a-asset-item>` for everything
 * else (glTF, bin, …). Injecting everything as `<a-asset-item>` loads videos as
 * opaque blobs that can't play.
 */
export function assetElement(a: ManifestAsset): { tag: string; attrs: Record<string, unknown> } {
  const ext = (a.src.split(".").pop() ?? "").toLowerCase();
  if (VIDEO_EXT.includes(ext)) {
    return {
      tag: "video",
      attrs: { id: a.id, src: a.src, loop: true, muted: true, playsinline: true, preload: "auto", crossorigin: "anonymous" }
    };
  }
  if (IMAGE_EXT.includes(ext)) {
    return { tag: "img", attrs: { id: a.id, src: a.src, crossorigin: "anonymous" } };
  }
  if (AUDIO_EXT.includes(ext)) {
    return { tag: "audio", attrs: { id: a.id, src: a.src, preload: "auto", crossorigin: "anonymous" } };
  }
  return { tag: "a-asset-item", attrs: { id: a.id, src: a.src } };
}

/** Register every component the manifest declares, skipping any already present. */
export function registerManifestComponents(manifest: Pick<Manifest, "components">): void {
  for (const [name, def] of Object.entries(manifest.components ?? {})) {
    if (AFRAME?.components?.[name]) continue;
    AFRAME.registerComponent(name, def);
  }
}

/**
 * Apply camera settings to an <a-camera>, returning a teardown that restores the
 * camera to its previous attributes (so switching/unmounting a module resets it).
 */
export function applyCameraSettings(
  camera: Element | null,
  settings: Manifest["camera"]
): () => void {
  if (!camera) return () => {};
  const previous: Record<string, unknown> = {};
  for (const [attr, value] of Object.entries(settings ?? {})) {
    if(CAMERA_PROPS_FORBIDDEN.includes(attr as unknown as any)){
      continue;
    }
    previous[attr] = camera.getAttribute(attr);
    camera.setAttribute(attr, value);
  }
  return () => {
    for (const [attr, value] of Object.entries(previous)) {
      if (value === null || value === undefined) camera.removeAttribute(attr);
      else camera.setAttribute(attr, value as any);
    }
  };
}

/**
 * Switch the host's own scene lights (the `#host-lights` group) off while the
 * module is shown if its manifest says `hostLights: false`, returning a
 * teardown that switches them back on — mirrors the host's ArModule.vue.
 * Hidden, not removed: three.js skips invisible lights, shadows included.
 */
export function applyHostLights(manifest: Pick<Manifest, "hostLights">): () => void {
  if (manifest.hostLights !== false) return () => {};
  const hostLights = document.getElementById("host-lights");
  if (!hostLights) return () => {};
  hostLights.setAttribute("visible", "false");
  return () => hostLights.setAttribute("visible", "true");
}

/**
 * Feed image targets to the 8th Wall controller, returning a teardown that clears
 * them again. No-ops without XR8 (e.g. the stock-A-Frame VR preview).
 */
export function configureImageTargets(xr: any, imageTargets: unknown[]): () => void {
  if (!xr?.XrController?.configure || !imageTargets?.length) return () => {};
  try {
    xr.XrController.configure({ imageTargetData: imageTargets });
  } catch (e) {
    // A malformed target must not take the camera pipeline down with it.
    console.error("[ar-module] image-target configure failed", e);
    return () => {};
  }
  return () => {
    try {
      xr.XrController.configure({ imageTargetData: [] });
    } catch { /* engine already torn down */ }
  };
}
