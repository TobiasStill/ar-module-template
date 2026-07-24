import type { ComponentDefinition } from "aframe";

declare const THREE: any;

const DEG2RAD = Math.PI / 180;

// Base angular speed of the idle float (rad/s). Deliberately low so the drift is
// subtle; the three axes use slightly different multiples of it so they don't move
// in lockstep. Not exposed — only a single idle *radius* knob is exposed.
const IDLE_SPEED = 1.0;

// Per-instance proximity-triggered animation for a single entity. Works
// standalone on any one entity — put it directly on an entity with its own
// full set of parameters — or apply it to a whole group of entities at once
// with shared parameters via [proximity-wave-group] (see that component and
// guides/PROXIMITY-WAVE-FEATURE-GUIDE.md). Two motions, composed onto the transform
// every frame:
//
//   Wave  — a "someone nudged it" forward/back swing that fades in as the
//           camera approaches (waveNear/waveFar, smoothstep). It swings
//           along the azimuth the entity already leans toward (from its
//           base X/Z tilt), so it nods forward and back rather than side to
//           side. sin() drives it, so it eases naturally to a stop at each
//           far end of the swing.
//   Idle  — a subtle, always-on float in every direction (independent per-axis
//           phases/frequencies), bounded by idleRadius.
//
// It captures the base position/rotation authored on the entity once, then
// writes base + wave + idle straight to object3D each tick (cheap; no
// attribute reparsing).
export default {
  schema: {
    // Wave fades in across this distance band (metres, camera → entity).
    waveNear: { type: "number", default: 2 }, // ≤ this ⇒ full wave
    waveFar: { type: "number", default: 5 }, // ≥ this ⇒ no wave
    waveIntensity: { type: "number", default: 20 }, // peak swing each way (degrees)
    waveSpeed: { type: "number", default: 3 }, // swing rate (higher = faster)
    // Y offset of the wave pivot along the entity's own axis, in local units.
    // 0 = pivot at the entity's origin; negative lowers it (e.g. toward a
    // "base"), positive raises it. Only affects the wave, not the idle float.
    pivotY: { type: "number", default: 0 },
    // Idle float amplitude (local units). 0 disables the idle motion.
    idleRadius: { type: "number", default: 0.02 }
  },

  init() {
    const self = this as any;
    const el = self.el;

    // Base transform as already authored on this entity, captured before we animate it.
    const r = el.getAttribute("rotation") || { x: 0, y: 0, z: 0 };
    const p = el.getAttribute("position") || { x: 0, y: 0, z: 0 };
    self.baseRotX = r.x;
    self.baseRotY = r.y;
    self.baseRotZ = r.z;
    self.basePosX = p.x;
    self.basePosY = p.y;
    self.basePosZ = p.z;

    // Wave azimuth from the base lean. rot.x leans the entity along Z, rot.z along X;
    // adding the swing proportionally to this unit vector oscillates the lean
    // magnitude along one fixed azimuth (a forward/back nod). An upright entity has
    // no lean, so default to nodding about X (straight forward/back).
    const leanMag = Math.hypot(r.x, r.z);
    if (leanMag > 0.0001) {
      self.leanUX = r.x / leanMag;
      self.leanUZ = r.z / leanMag;
    } else {
      self.leanUX = 1;
      self.leanUZ = 0;
    }

    // Random per-instance phases so a group doesn't wave/float in unison.
    self.wavePhase = Math.random() * Math.PI * 2;
    self.idlePhaseX = Math.random() * Math.PI * 2;
    self.idlePhaseY = Math.random() * Math.PI * 2;
    self.idlePhaseZ = Math.random() * Math.PI * 2;

    // Wave pivot: a point pivotY (scaled by the instance scale) along the entity's
    // own axis that stays fixed while it waves. r0p is that pivot rotated by the
    // base orientation (its rest offset from the origin); each frame we shift the
    // origin by (r0p − currentRotation·pivot) so the pivot doesn't move.
    const sc = el.getAttribute("scale") || { x: 1, y: 1, z: 1 };
    self.pivotLocal = new THREE.Vector3(0, self.data.pivotY * sc.y, 0);
    self.hasPivot = self.pivotLocal.lengthSq() > 0;
    const baseQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(self.baseRotX * DEG2RAD, self.baseRotY * DEG2RAD, self.baseRotZ * DEG2RAD, "XYZ")
    );
    self.r0p = self.pivotLocal.clone().applyQuaternion(baseQuat);
    self.rp = new THREE.Vector3();

    self.camera = null;
    self.camPos = new THREE.Vector3();
    self.worldPos = new THREE.Vector3();
  },

  tick(time: number) {
    const self = this as any;
    const data = self.data;
    const obj = self.el.object3D;
    const t = time / 1000; // seconds

    // --- Wave: distance-gated forward/back swing along the lean azimuth ---
    let waveAngle = 0;
    if (data.waveIntensity > 0 && data.waveFar > data.waveNear) {
      if (!self.camera) {
        self.camera = self.el.sceneEl && self.el.sceneEl.camera;
      }
      if (self.camera) {
        obj.getWorldPosition(self.worldPos);
        self.camera.getWorldPosition(self.camPos);
        const dist = self.worldPos.distanceTo(self.camPos);

        let factor;
        if (dist <= data.waveNear) factor = 1;
        else if (dist >= data.waveFar) factor = 0;
        else {
          // smoothstep ramp (eased) as the camera closes in
          const x = 1 - (dist - data.waveNear) / (data.waveFar - data.waveNear);
          factor = x * x * (3 - 2 * x);
        }

        // sin() → zero velocity at the swing extremes = natural easing at both ends.
        waveAngle = factor * data.waveIntensity * Math.sin(t * data.waveSpeed + self.wavePhase);
      }
    }

    obj.rotation.set(
      (self.baseRotX + self.leanUX * waveAngle) * DEG2RAD,
      self.baseRotY * DEG2RAD,
      (self.baseRotZ + self.leanUZ * waveAngle) * DEG2RAD
    );

    // Keep the wave pivot fixed: shift the origin by (rest offset − current offset)
    // of the pivot point. Zero when pivotY is 0 (rotate about the origin).
    let compX = 0;
    let compY = 0;
    let compZ = 0;
    if (self.hasPivot) {
      self.rp.copy(self.pivotLocal).applyQuaternion(obj.quaternion);
      compX = self.r0p.x - self.rp.x;
      compY = self.r0p.y - self.rp.y;
      compZ = self.r0p.z - self.rp.z;
    }

    // --- Idle: subtle drift in every direction, independent per axis ---
    const r = data.idleRadius;
    const idleX = r > 0 ? r * Math.sin(t * IDLE_SPEED * 0.7 + self.idlePhaseX) : 0;
    const idleY = r > 0 ? r * Math.sin(t * IDLE_SPEED * 0.9 + self.idlePhaseY) : 0;
    const idleZ = r > 0 ? r * Math.sin(t * IDLE_SPEED * 1.1 + self.idlePhaseZ) : 0;

    obj.position.set(
      self.basePosX + idleX + compX,
      self.basePosY + idleY + compY,
      self.basePosZ + idleZ + compZ
    );
  }
} as ComponentDefinition;
