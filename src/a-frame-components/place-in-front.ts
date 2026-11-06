import type { ComponentDefinition } from "aframe";
import { onSceneTap } from "./scene-tap-shared";

declare const THREE: any;

// Places its entity on the floor in front of the camera, facing the way the
// camera looks — once the camera has a usable pose, and again on every
// recenter. Module-local: only this entity moves, never the shared camera or
// XR8's world origin, so other content and the host's UI stay put.
//
//   <a-entity place-in-front="distance: 2; tapRecenter: true">
//     … the scene, authored with its origin as the spot in front of the viewer …
//   </a-entity>
//
// The target pose is computed in WORLD space (floor at world y = floorHeight,
// rotation only around the vertical axis) and converted into the parent's
// local space, so it's right no matter which wrappers the host or the
// previews put above the module (the host and lib/preview-ar.ts both mount it
// under an offset root) — a fixed offset would only fit one of them.
//
// Scale: by default the entity keeps the scale it was authored with. With
// `referenceHeight` > 0 the content is scaled to the viewer instead:
// scale = cameraHeight / referenceHeight, for scenes authored "as seen from a
// camera referenceHeight units above the floor" (8th Wall's `responsive`
// convention: the camera's start height is the real device height — the old
// Augmented Bahnhofsviertel projects used a camera at 0 8 8, i.e.
// referenceHeight 8, distance 8). `distance` is in content units and scales
// along, so the content keeps its proportions to the viewer.
//
// When scaled, world-unit properties inside are scaled along so the scene
// keeps its authored proportions (each can be switched off):
//   - scaleShadows: directional lights' shadow cameras (bounds and near/far;
//     three.js keeps them in world units — unscaled, they cover a far bigger
//     area at a fraction of the resolution, and depth precision drops into
//     shadow acne),
//   - scaleSounds: positional sounds' refDistance/maxDistance,
//   - scaleLights: point/spot lights' `distance` range.
//
// Recenter: send `place-in-front-place` to the entity (e.g. from a button —
// see ArOverlay.vue), or set `tapRecenter: true` to re-place on every tap on
// the scene (iOS-safe tap detection, see scene-tap-shared.ts). Every detected
// tap is also re-emitted as `place-in-front-tap`, whether or not tapRecenter
// is on. After each placement the entity emits `place-in-front-placed`
// ({ scale }).
//
// Without a camera height (stock-A-Frame `npm run dev`, where nothing moves
// the camera off y = 0) it places after `fallbackAfter` seconds — with XR8
// after `xrFallbackAfter`, since the engine can take a while to start — at
// `fallbackScale` (only used with referenceHeight).
export default {
  schema: {
    distance: { type: "number", default: 2 },
    referenceHeight: { type: "number", default: 0 },
    floorHeight: { type: "number", default: 0 },
    auto: { type: "boolean", default: true },
    hideUntilPlaced: { type: "boolean", default: true },
    tapRecenter: { type: "boolean", default: false },
    fallbackAfter: { type: "number", default: 3 },
    xrFallbackAfter: { type: "number", default: 15 },
    fallbackScale: { type: "number", default: 0.2 },
    scaleShadows: { type: "boolean", default: true },
    scaleSounds: { type: "boolean", default: true },
    scaleLights: { type: "boolean", default: true }
  },

  init() {
    const self = this as any;
    self.placed = false;
    self.waited = 0;
    self.scale = 1;
    self.authoredScale = self.el.object3D.scale.clone();
    self.shadowBase = new Map();
    self.lightBase = new Map();
    if (self.data.hideUntilPlaced) self.el.object3D.visible = false;

    self.onPlace = () => self.place();
    self.el.addEventListener("place-in-front-place", self.onPlace);
    self.onSoundLoaded = () => {
      if (self.placed && self.data.scaleSounds) self.scaleSoundDistances(self.scale);
    };
    self.el.addEventListener("sound-loaded", self.onSoundLoaded);
    self.disposeTap = onSceneTap(self.el.sceneEl, (tap) => {
      if (!self.placed) return;
      if (self.data.tapRecenter) self.place();
      self.el.emit("place-in-front-tap", tap, false);
    });
  },

  tick(_time: number, delta: number) {
    const self = this as any;
    if (self.placed || !self.data.auto) return;
    self.waited += (delta || 0) / 1000;
    const camera = self.el.sceneEl.camera;
    if (!camera) return;
    const pos = new THREE.Vector3();
    camera.getWorldPosition(pos);
    const wait = (window as any).XR8 ? self.data.xrFallbackAfter : self.data.fallbackAfter;
    if (pos.y - self.data.floorHeight > 0.01 || self.waited >= wait) self.place();
  },

  place() {
    const self = this as any;
    const data = self.data;
    const camera = self.el.sceneEl.camera;
    if (!camera) return;

    const camPos = new THREE.Vector3();
    const camQuat = new THREE.Quaternion();
    camera.getWorldPosition(camPos);
    camera.getWorldQuaternion(camQuat);

    const camHeight = camPos.y - data.floorHeight;
    const s = data.referenceHeight > 0
      ? (camHeight > 0.01 ? camHeight / data.referenceHeight : data.fallbackScale)
      : 1;

    // Heading: where the camera looks, flattened onto the floor. Held (almost)
    // straight down or up, use the screen's top edge instead — the direction
    // the phone "points" while held flat.
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat).setY(0);
    if (forward.lengthSq() < 0.04) forward.set(0, 1, 0).applyQuaternion(camQuat).setY(0);
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    const yaw = Math.atan2(-forward.x, -forward.z);
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    const origin = new THREE.Vector3(camPos.x, data.floorHeight, camPos.z)
      .addScaledVector(forward, data.distance * s);
    const scale = self.authoredScale.clone().multiplyScalar(s);

    const world = new THREE.Matrix4().compose(origin, rotation, scale);
    const obj = self.el.object3D;
    const parent = obj.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      world.premultiply(new THREE.Matrix4().copy(parent.matrixWorld).invert());
    }
    world.decompose(obj.position, obj.quaternion, obj.scale);
    obj.updateMatrixWorld(true);

    self.scale = s;
    if (data.scaleShadows) self.scaleShadowCameras(s);
    if (data.scaleSounds) self.scaleSoundDistances(s);
    if (data.scaleLights) self.scaleLightRanges(s);
    self.placed = true;
    obj.visible = true;
    self.el.emit("place-in-front-placed", { scale: s }, false);
  },

  scaleShadowCameras(s: number) {
    const self = this as any;
    self.el.object3D.traverse((node: any) => {
      if (!node.isDirectionalLight || !node.shadow?.camera) return;
      const cam = node.shadow.camera;
      if (!self.shadowBase.has(node)) {
        self.shadowBase.set(node, { left: cam.left, right: cam.right, top: cam.top, bottom: cam.bottom, near: cam.near, far: cam.far });
      }
      const base = self.shadowBase.get(node);
      cam.left = base.left * s;
      cam.right = base.right * s;
      cam.top = base.top * s;
      cam.bottom = base.bottom * s;
      cam.near = base.near * s;
      cam.far = base.far * s;
      cam.updateProjectionMatrix();
    });
  },

  scaleLightRanges(s: number) {
    const self = this as any;
    self.el.object3D.traverse((node: any) => {
      if (!(node.isPointLight || node.isSpotLight)) return;
      if (!self.lightBase.has(node)) self.lightBase.set(node, node.distance);
      const base = self.lightBase.get(node);
      if (base > 0) node.distance = base * s;
    });
  },

  scaleSoundDistances(s: number) {
    const self = this as any;
    self.el.querySelectorAll("[sound]").forEach((el: any) => {
      const sound = el.components?.sound;
      if (!sound?.data?.positional) return;
      (sound.pool?.children ?? []).forEach((audio: any) => {
        if (!audio.setRefDistance) return;
        audio.setRefDistance(sound.data.refDistance * s);
        audio.setMaxDistance(sound.data.maxDistance * s);
      });
    });
  },

  remove() {
    const self = this as any;
    self.el.removeEventListener("place-in-front-place", self.onPlace);
    self.el.removeEventListener("sound-loaded", self.onSoundLoaded);
    self.disposeTap?.();
  }
} as ComponentDefinition;
