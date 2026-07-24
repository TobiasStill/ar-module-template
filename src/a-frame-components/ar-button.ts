import type { ComponentDefinition } from "aframe";

declare const THREE: any;

const PULSE_SPEED = 6; // rad/s — one full grow/shrink cycle roughly every second

// Declares an entity as a tappable/gazable 3D button. The trigger zone is an
// axis-aligned box in the entity's OWN local space — `zoneSize` centred on
// `zoneOffset` from this entity's pivot/origin — so any entity (a flat plane
// or an arbitrary 3D model) can be a button without needing a separate
// invisible hit-area mesh child. Raycasting is done by transforming the
// camera ray into this entity's local space (exact — respects the entity's
// own rotation/scale) rather than expanding the zone into a world-space
// AABB.
//
// Registers with the nearest ancestor [ar-button-manager] (normally the
// module root), which owns the actual gaze raycast and tap routing — this
// component only answers "does this ray hit my zone" (raycastZone) and
// animates itself (gaze pulse + distance fade). Anything that wants to react
// to a tap listens for the "ar-button-tap" event this emits on its own
// element (see sound-button.ts for an example) rather than reaching into
// this component directly.
//
// Fade/pulse are driven by object3D.scale, not material opacity — this is
// the single place either writes `object3D.scale`, so they compose
// (multiply) instead of stomping each other. Opacity-based fade fights with
// alpha-tested materials (crisp cutout icon edges): any value strictly
// between the alphaTest threshold and 1 is a partially-blended fragment that
// needs correct back-to-front sort order, which visibly breaks down with
// close, overlapping transparent planes. Shrinking never touches blending,
// so it can't reintroduce that problem.
export default {
  schema: {
    // Set false to exclude this button from the raycast/pulse without
    // removing it from the DOM (e.g. a used-up, one-shot button).
    enabled: { type: "boolean", default: true },
    // Size of the trigger-zone box, in this entity's own local units.
    zoneSize: { type: "vec3", default: { x: 1, y: 1, z: 1 } },
    // Centre of the trigger-zone box, offset from this entity's own
    // pivot/origin (not from its visible geometry's centre, if different).
    zoneOffset: { type: "vec3", default: { x: 0, y: 0, z: 0 } },
    // World-space metres. Full size at/inside `near`, shrunk to nothing
    // at/beyond `far`, smoothstep-fading between. 0/0 (the default)
    // disables distance fade entirely — always full size.
    near: { type: "number", default: 0 },
    far: { type: "number", default: 0 },
    // Uniform x/y/z scale bump applied while this button is the gazed one,
    // e.g. 0.15 = grows to 115% of its (faded) size at the pulse's peak.
    pulse: { type: "number", default: 0.15 }
  },

  init() {
    const self = this as any;
    self.pulsing = false;
    self.pulsePhase = 0;
    self.pulseScale = 1;
    self.fadeFactor = 1;
    self.baseScale = self.el.object3D.scale.clone();

    self.box = new THREE.Box3();
    self.invMatrix = new THREE.Matrix4();
    self.localRay = new THREE.Ray();
    self.hitPoint = new THREE.Vector3();
    self.camPos = new THREE.Vector3();
    self.worldPos = new THREE.Vector3();
    self.updateZone();

    const managerEl = self.el.closest("[ar-button-manager]");
    self.manager = managerEl ? managerEl.components["ar-button-manager"] : null;
    if (self.manager) self.manager.register(self);
    else console.warn("[ar-button] no ancestor [ar-button-manager] found; gaze/tap disabled");
  },

  update(oldData: any) {
    const self = this as any;
    if (!oldData) return; // init() already built the zone once
    if (self.data.zoneSize !== oldData.zoneSize || self.data.zoneOffset !== oldData.zoneOffset) {
      self.updateZone();
    }
  },

  remove() {
    const self = this as any;
    if (self.manager) self.manager.unregister(self);
  },

  updateZone() {
    const self = this as any;
    const { zoneSize, zoneOffset } = self.data;
    self.box.min.set(
      zoneOffset.x - zoneSize.x / 2,
      zoneOffset.y - zoneSize.y / 2,
      zoneOffset.z - zoneSize.z / 2
    );
    self.box.max.set(
      zoneOffset.x + zoneSize.x / 2,
      zoneOffset.y + zoneSize.y / 2,
      zoneOffset.z + zoneSize.z / 2
    );
  },

  tick(_time: number, delta: number) {
    const self = this as any;
    const obj = self.el.object3D;

    if (self.pulsing) {
      self.pulsePhase += delta / 1000;
      const osc = Math.sin(self.pulsePhase * PULSE_SPEED) * 0.5 + 0.5; // 0..1
      self.pulseScale = 1 + self.data.pulse * osc;
    } else if (self.pulseScale !== 1) {
      // Ease back to rest size instead of snapping, so the pulse stop reads
      // as a settle rather than a pop.
      self.pulseScale += (1 - self.pulseScale) * Math.min(delta / 150, 1);
    }

    self.fadeFactor = self.computeFadeFactor();

    const fade = self.fadeFactor;
    obj.scale.set(
      self.baseScale.x * fade * self.pulseScale,
      self.baseScale.y * fade * self.pulseScale,
      self.baseScale.z * fade
    );
  },

  computeFadeFactor(): number {
    const self = this as any;
    const { near, far } = self.data;
    if (near <= 0 && far <= 0) return 1; // fade disabled

    const camera = self.el.sceneEl && self.el.sceneEl.camera;
    if (!camera) return 1;

    camera.getWorldPosition(self.camPos);
    self.el.object3D.getWorldPosition(self.worldPos);
    const dist = self.worldPos.distanceTo(self.camPos);

    let factor = far <= near ? (dist <= near ? 1 : 0) : 1 - (dist - near) / (far - near);
    factor = Math.min(1, Math.max(0, factor));
    return factor * factor * (3 - 2 * factor); // smoothstep
  },

  // Buttons faded below 5% size are excluded from the raycast — can't be
  // gazed at or tapped — in addition to the explicit `enabled` schema flag.
  isEnabled(): boolean {
    const self = this as any;
    return self.data.enabled && self.fadeFactor > 0.05;
  },

  // What [ar-button-manager] raycasts against for gaze detection. Transforms
  // `ray` (world space) into this entity's local space and tests it against
  // the local-space trigger-zone box — exact even if this entity (or an
  // ancestor) is rotated/scaled, unlike testing against a world-space AABB.
  raycastZone(ray: any): { distance: number } | null {
    const self = this as any;
    const obj = self.el.object3D;
    obj.updateWorldMatrix(true, false);
    self.invMatrix.copy(obj.matrixWorld).invert();
    self.localRay.copy(ray).applyMatrix4(self.invMatrix);

    const hit = self.localRay.intersectBox(self.box, self.hitPoint);
    if (!hit) return null;

    self.hitPoint.applyMatrix4(obj.matrixWorld); // back to world space
    return { distance: self.hitPoint.distanceTo(ray.origin) };
  },

  startPulse() {
    const self = this as any;
    self.pulsing = true;
    self.pulsePhase = 0;
  },

  stopPulse() {
    (this as any).pulsing = false;
  }
} as ComponentDefinition;
