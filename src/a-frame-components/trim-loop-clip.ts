import type { ComponentDefinition } from "aframe";

// Trim a glTF animation's dead lead-in/tail and play it on a loop.
//
// Blender's glTF exporter bakes keyframe *times* from the scene timeline: if you
// export only a preview range that starts at, say, frame 100, the first keyframe
// lands at ~100/fps seconds, not at 0. A plain `animation-mixer` then plays from
// t=0 and just holds that first frame for those seconds — the "big pause before
// the animation starts". There's no trim knob on `animation-mixer` for this.
//
// This component takes the loaded clips and shifts every track so the earliest
// keyframe sits at t=0, then clamps the clip duration to the span that actually
// contains keyframes. What's left is only the moving part, which it plays with a
// LoopPingPong (back-and-forth) loop. Use it INSTEAD of `animation-mixer` on the
// same entity as `gltf-model`:
//
//   <a-entity gltf-model="#AnimatedCharacter" trim-loop-clip="timeScale: 0.4"></a-entity>
//   <a-entity gltf-model="#AnimatedProp" trim-loop-clip="loop: repeat"></a-entity>
//
// When a model has multiple clips (e.g. a rig animation plus a separately
// keyed submesh), each clip's own trimmed duration is rarely identical —
// looping them independently via the mixer's normal per-action bookkeeping,
// each bounces/wraps at its own length and drifts out of phase a little more
// every cycle, even though they start in sync. (three.js's built-in
// `AnimationAction.syncWith()` looks like the fix for exactly this, but in
// practice its synced relationship resets at every loop boundary when the
// clip lengths differ, producing a step-drift once per master cycle instead
// of none.) So with more than one clip, this component takes over time
// advancement itself: every action is driven directly off ONE shared clock —
// the *longest* clip's duration sets the loop period, and every action's
// `.time` is that same raw elapsed value, clamped to its own (possibly
// shorter) duration. This plays each clip at its natural authored rate
// rather than stretching it to fit the master's length — stretching a
// slightly-shorter clip to always finish exactly when the master does makes
// it play a little slower than 1:1, which reads as "lagging behind" for the
// whole cycle. A clip that finishes early just holds its final pose until
// the shared clock (and the master with it) also completes and reflects.
//
// Ported from Fanyu_module essentially unchanged — already fully generic in
// the source (no naming-convention or asset-specific logic). One addition:
// an immediate check for a model that finished loading before this
// component's own init() ran (the source only listened for a future
// `model-loaded`), matching the same "don't miss an event that already
// fired" pattern every other model-loaded-driven component on this branch
// already follows.

declare const AFRAME: any;
const THREE = (AFRAME as any).THREE;

const LOOP_MODES: Record<string, number> = {
  once: THREE.LoopOnce,
  repeat: THREE.LoopRepeat,
  pingpong: THREE.LoopPingPong
};

// Shift all tracks so the earliest keyframe is at t=0 and shrink the clip to the
// keyframed span. Idempotent — a second pass shifts by 0.
//
// CAUTION: glTF samplers that share one input accessor (e.g. every bone in a rig
// keyed on the same frames) end up sharing ONE `times` array, because GLTFLoader
// caches accessors. So we must NOT subtract in place — that would shift the
// shared array once per track referencing it (27× for this rig), pushing its
// keyframes far out of range and freezing those tracks. Instead give each track
// a fresh times array derived from the original values.
function trimClipLeadIn(clip: any): void {
  if (!clip.tracks.length) return;

  let firstTime = Infinity;
  let lastTime = -Infinity;
  for (const track of clip.tracks) {
    const times = track.times;
    if (!times.length) continue;
    firstTime = Math.min(firstTime, times[0]);
    lastTime = Math.max(lastTime, times[times.length - 1]);
  }
  if (!isFinite(firstTime)) return;

  if (firstTime > 0) {
    for (const track of clip.tracks) {
      const shifted = track.times.slice(); // fresh array — never touch the shared original
      for (let i = 0; i < shifted.length; i++) shifted[i] -= firstTime;
      track.times = shifted;
    }
  }
  clip.duration = lastTime - firstTime;
}

// Maps unbounded elapsed time into a clip-relative 0..1 phase, replicating
// each THREE.Loop* mode's wrap behavior. Shared across every action so they
// can each be evaluated at `phase * ownDuration` and stay in lockstep.
function phaseFor(elapsed: number, mode: string): number {
  if (mode === "once") return Math.min(elapsed, 1);
  if (mode === "repeat") return elapsed % 1;
  // pingpong: 0→1→0→1… triangle wave over a period of 2.
  const t = elapsed % 2;
  return t <= 1 ? t : 2 - t;
}

export default {
  schema: {
    // Which clip(s) to play. '*' = all clips found on the model.
    clip: { type: "string", default: "*" },
    // Playback speed multiplier (matches animation-mixer's timeScale).
    timeScale: { type: "number", default: 1 },
    // 'once' | 'repeat' | 'pingpong'. Default ping-pong = play forward then reverse.
    loop: { type: "string", default: "pingpong", oneOf: ["once", "repeat", "pingpong"] },
    // Hold the final frame when a non-looping ('once') clip finishes.
    clampWhenFinished: { type: "boolean", default: false }
  },

  init() {
    const self = this as any;
    self.mixer = null;
    self.actions = [];
    self.masterDuration = 0;
    self.phaseElapsed = 0; // seconds, only used once there's >1 clip to sync

    self.onModelLoaded = (e: any) => {
      const model = e.detail?.model || self.el.getObject3D("mesh");
      const clips = model?.animations;
      if (!clips?.length) return;

      self.mixer = new THREE.AnimationMixer(model);
      self.play_(clips);
    };
    self.el.addEventListener("model-loaded", self.onModelLoaded);

    // The model may already be present (event fired before we initialised) —
    // if it already carries animations, start now instead of waiting for an
    // event that already happened.
    const existing = self.el.getObject3D("mesh");
    if (existing?.animations?.length) self.onModelLoaded({ detail: { model: existing } });
  },

  // (Re)build actions for the current schema. Called on load and on update.
  play_(clips: any[]) {
    const self = this as any;
    if (!self.mixer) return;

    self.mixer.stopAllAction();
    self.actions = [];
    self.phaseElapsed = 0;

    const wanted = self.data.clip === "*"
      ? clips
      : clips.filter((c: any) => c.name === self.data.clip);

    const loopMode = LOOP_MODES[self.data.loop] ?? THREE.LoopPingPong;

    for (const clip of wanted) {
      trimClipLeadIn(clip);
      const action = self.mixer.clipAction(clip);
      action.setLoop(loopMode, Infinity);
      action.clampWhenFinished = self.data.clampWhenFinished;
      action.reset();
      action.play();
      self.actions.push(action);
    }

    // With only one clip there's nothing to desync, so let the mixer drive
    // it the normal way. With more than one, this component owns time
    // advancement instead (see phaseFor / tick) — the longest clip sets the
    // shared loop period so nothing gets cut off early.
    self.masterDuration = self.actions.length > 1
      ? Math.max(...self.actions.map((a: any) => a.getClip().duration))
      : 0;
  },

  update(oldData: any) {
    // Rebuild if the schema changed after the model was already loaded.
    const self = this as any;
    if (oldData === undefined) return; // init() already handles the first load
    const model = self.el.getObject3D("mesh");
    if (self.mixer && model?.animations?.length) self.play_(model.animations);
  },

  tick(_time: number, timeDelta: number) {
    const self = this as any;
    if (!self.mixer) return;
    const dt = (timeDelta / 1000) * self.data.timeScale;

    if (self.masterDuration > 0) {
      self.phaseElapsed += dt;
      const phase = phaseFor(self.phaseElapsed / self.masterDuration, self.data.loop);
      const sharedTime = phase * self.masterDuration;
      for (const action of self.actions) action.time = Math.min(sharedTime, action.getClip().duration);
      self.mixer.update(0); // apply poses at the times just set, without further auto-advance
    } else {
      self.mixer.update(dt);
    }
  },

  remove() {
    const self = this as any;
    self.el.removeEventListener("model-loaded", self.onModelLoaded);
    if (self.mixer) {
      self.mixer.stopAllAction();
      const root = self.mixer.getRoot?.();
      if (root) self.mixer.uncacheRoot(root);
      self.mixer = null;
    }
    self.actions = [];
  }
} as ComponentDefinition;
