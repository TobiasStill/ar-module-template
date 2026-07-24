// Tracks how many of the manifest's assets have finished loading into the
// scene's <a-assets>. The host (and both local previews — see
// lib/host-runtime.ts's assetElement()) inject each manifest asset as an
// <img>, <audio>, <video>, or <a-asset-item> by id *before* this component
// mounts, so by the time ArModule.vue's onMounted() runs, every element
// already exists in the DOM — it just may not have finished fetching yet.
//
// Deliberately doesn't rely on <a-assets>'s own aggregate "loaded" event:
// that only fires once *everything* is done, which is enough to know when to
// hide a bar but not to drive one — this drives it per-asset instead of
// duplicating A-Frame's tracking, only observing it more granularly.
export interface TrackableAsset {
  id: string;
}

// Different element types signal "ready" differently, and — since our own
// onMounted() can run *after* a small/cached asset has already finished
// loading — each needs a synchronous "is it already done" check too, not
// just an event to wait for.
function readyState(el: Element): { ready: boolean; event: string } {
  const tag = el.tagName.toLowerCase();
  if (tag === "img") return { ready: (el as HTMLImageElement).complete, event: "load" };
  if (tag === "video" || tag === "audio") {
    return { ready: (el as HTMLMediaElement).readyState >= 2, event: "loadeddata" };
  }
  // a-asset-item (and anything else AFRAME manages) exposes `.hasLoaded`.
  return { ready: Boolean((el as unknown as { hasLoaded?: boolean }).hasLoaded), event: "loaded" };
}

/**
 * Starts tracking; calls onProgress(loaded, total) as each asset finishes
 * (success or error — a broken asset must not stall the bar forever) and
 * onDone() once everything has settled or `timeoutMs` elapses. Returns a
 * teardown to call on unmount (also stops tracking early, without calling
 * onDone, if the component unmounts before assets finish).
 */
export function trackAssetLoading(
  assets: TrackableAsset[],
  onProgress: (loaded: number, total: number) => void,
  onDone: () => void,
  timeoutMs = 10000
): () => void {
  const total = assets.length;
  if (total === 0) {
    onDone();
    return () => {};
  }

  let loaded = 0;
  let settled = false;
  const cleanups: Array<() => void> = [];

  const teardown = () => {
    if (settled) return;
    settled = true;
    for (const cleanup of cleanups) cleanup();
  };

  const bump = () => {
    loaded++;
    onProgress(loaded, total);
    if (loaded >= total) {
      teardown();
      onDone();
    }
  };

  for (const asset of assets) {
    const el = document.getElementById(asset.id);
    if (!el) {
      bump(); // never injected (shouldn't happen per the host contract) — don't hang on it
      continue;
    }
    const { ready, event } = readyState(el);
    if (ready) {
      bump();
      continue;
    }
    const onLoad = () => bump();
    el.addEventListener(event, onLoad, { once: true });
    el.addEventListener("error", onLoad, { once: true });
    cleanups.push(() => {
      el.removeEventListener(event, onLoad);
      el.removeEventListener("error", onLoad);
    });
  }

  // Mirrors <a-assets>'s own timeout (see ar.html / preview-ar.ts's
  // `timeout: "10000"`), so one slow/stuck asset can't leave the bar on
  // screen forever — declare done and let A-Frame keep loading in the
  // background.
  const timer = setTimeout(() => {
    teardown();
    onDone();
  }, timeoutMs);
  cleanups.push(() => clearTimeout(timer));

  return teardown;
}
