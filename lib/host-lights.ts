// Scales the intensity of the lights the scene already has when a module
// mounts — i.e. the host's own lights — and restores them on unmount.
//
// The host (frontend/src/components/ArScene.vue in ar-demo-backend) keeps
// an ambient (#BBB) and a directional (0.6) light on permanently, so a
// module's own lights always add on top of them. A module that brings its
// complete lighting (e.g. a scene ported from an old 8th Wall project) comes
// out brighter than authored. three.js can't exclude a light per object (no
// light linking; a light on a layer the camera doesn't see is off for every
// object), so the module scales the host's lights while it is shown.
//
// Opt-in per module via `hostLightScale` in src/manifest.ts (default 1 =
// untouched). Called by the module root in lib/main.ts, before the module's
// own content (and its lights) exist — so every light found here belongs to
// the host. Nothing in src/ needs to call this.
//
// A light entity that hasn't finished loading yet (the previews create the
// host lights in the same render pass as the module) is scaled once its
// `loaded` event fires.
export function scaleSceneLights(scale: number | undefined): () => void {
  if (scale === undefined || scale === 1) return () => {};
  const scene = document.querySelector("a-scene");
  if (!scene) return () => {};

  const scaled: { el: any; intensity: number }[] = [];
  const pending: { el: any; listener: () => void }[] = [];
  const apply = (el: any) => {
    const intensity = el.getAttribute("light")?.intensity;
    if (typeof intensity !== "number") return;
    scaled.push({ el, intensity });
    el.setAttribute("light", "intensity", intensity * scale);
  };

  scene.querySelectorAll("[light]").forEach((el: any) => {
    if (el.hasLoaded) {
      apply(el);
      return;
    }
    const listener = () => {
      el.removeEventListener("loaded", listener);
      apply(el);
    };
    el.addEventListener("loaded", listener);
    pending.push({ el, listener });
  });

  return () => {
    for (const { el, listener } of pending) el.removeEventListener("loaded", listener);
    for (const { el, intensity } of scaled) {
      if (el.isConnected) el.setAttribute("light", "intensity", intensity);
    }
  };
}
