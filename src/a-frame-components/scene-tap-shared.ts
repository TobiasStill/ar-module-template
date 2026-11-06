// Shared, iOS-safe "tap on the scene" detection — not a component, a helper
// used by place-in-front (tapRecenter) and tap-place-cursor.
//
// Why not the scene's `click`: iOS Safari suppresses the synthetic click once
// xrextras-gesture-detector (on the host's and both previews' <a-scene>) has
// called preventDefault() on the touch (see guides/SOUND-FEATURE-GUIDE.md §4),
// so a click-based tap never fires on an iPhone. A tap is detected from
// pointer events instead: exactly one pointer, on the scene's canvas (not on
// DOM UI — a module's own Vue overlay is mounted inside <a-scene> too), up
// within TAP_MAX_MS and moved less than TAP_MAX_MOVE_PX. Pinches, drags and
// taps on buttons don't count.
//
// Listens in the capture phase on window, so it sees the tap even if
// something else on the canvas stops propagation.
const TAP_MAX_MS = 350;
const TAP_MAX_MOVE_PX = 12;

export interface SceneTap {
  clientX: number;
  clientY: number;
}

/** Calls onTap for every detected scene tap; returns a dispose function. */
export function onSceneTap(sceneEl: any, onTap: (tap: SceneTap) => void): () => void {
  const pointers = new Map<number, { x: number; y: number; t: number }>();
  let multiTouch = false;

  const down = (e: PointerEvent) => {
    if (pointers.size > 0) multiTouch = true;
    // Taps off the canvas are still tracked (t = -Infinity never qualifies),
    // so a second finger on DOM UI still marks the gesture as multi-touch.
    const onCanvas = e.target === sceneEl.canvas;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: onCanvas ? performance.now() : -Infinity });
  };
  const up = (e: PointerEvent) => {
    const start = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    const wasMulti = multiTouch;
    if (pointers.size === 0) multiTouch = false;
    if (!start || wasMulti) return;
    if (performance.now() - start.t > TAP_MAX_MS) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_MAX_MOVE_PX) return;
    onTap({ clientX: e.clientX, clientY: e.clientY });
  };
  const cancel = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) multiTouch = false;
  };

  window.addEventListener("pointerdown", down, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", cancel, true);
  return () => {
    window.removeEventListener("pointerdown", down, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", cancel, true);
  };
}
