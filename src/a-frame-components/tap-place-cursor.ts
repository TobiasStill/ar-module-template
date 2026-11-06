import type { ComponentDefinition } from "aframe";
import { onSceneTap } from "./scene-tap-shared";

declare const THREE: any;

// A placement cursor: the entity (typically a flat ring) follows the point
// where the centre of the screen hits the ground; every tap on the scene
// moves the `target` entity there and shows it.
//
//   <a-entity tap-place-cursor="target: #my-model">
//     <a-ring rotation="-90 0 0" radius-inner="0.15" radius-outer="0.2"></a-ring>
//   </a-entity>
//   <a-entity id="my-model" gltf-model="#model"></a-entity>
//
// (The visible ring is a child: the cursor entity's own rotation.y is
// driven by followYaw, which would tilt a ring rotated on the same entity.)
//
// Ground: the `ground` entity's meshes if given (raycast), otherwise the
// horizontal plane y = 0 of the cursor's parent — so it works inside any
// transformed parent (a place-in-front scene, the host's module root)
// without an extra ground object. The hit point is converted into the
// parent's local space before it's written, so cursor and target land
// correctly inside transformed parents; `target` should share the cursor's
// parent. The cursor sits `lift` above the ground (parent units) and turns
// with the camera's heading (`followYaw`).
//
// Taps: iOS-safe pointer-based detection (scene-tap-shared.ts) — not the
// scene `click`, which iOS swallows behind xrextras-gesture-detector. Each
// placement emits `tap-place-cursor-placed` ({ position }) on the cursor.
// `hideTargetUntilPlaced` keeps the target invisible until the first tap.
//
// Generalised from #5 Unwetter am Steg (augmented-bahnhofsviertel), whose
// original tap-place-cursor.js hardcoded #model/#ground, wrote world
// coordinates into the local position and listened for the scene click.
export default {
  schema: {
    target: { type: "selector" },
    ground: { type: "selector" },
    lift: { type: "number", default: 0.01 },
    followYaw: { type: "boolean", default: true },
    hideTargetUntilPlaced: { type: "boolean", default: true },
    smoothing: { type: "number", default: 0.4 }
  },

  init() {
    const self = this as any;
    self.raycaster = new THREE.Raycaster();
    self.screenCentre = new THREE.Vector2(0, 0);
    self.cursorLocation = new THREE.Vector3();
    self.hasHit = false;
    if (self.data.target && self.data.hideTargetUntilPlaced) self.data.target.object3D.visible = false;
    self.disposeTap = onSceneTap(self.el.sceneEl, () => {
      const target = self.data.target;
      if (!target || !self.hasHit) return;
      target.object3D.position.copy(self.el.object3D.position);
      target.object3D.position.y -= self.data.lift;
      target.object3D.visible = true;
      self.el.emit("tap-place-cursor-placed", { position: target.object3D.position.clone() }, false);
    });
  },

  tick() {
    const self = this as any;
    const camera = self.el.sceneEl.camera;
    if (!camera) return;
    const obj = self.el.object3D;
    const parent = obj.parent;
    self.raycaster.setFromCamera(self.screenCentre, camera);

    let worldPoint: any = null;
    if (self.data.ground) {
      const hits = self.raycaster.intersectObject(self.data.ground.object3D, true);
      if (hits.length > 0) worldPoint = hits[0].point.clone();
    } else {
      // The parent's own y = 0 plane, in world space.
      const normal = new THREE.Vector3(0, 1, 0);
      const point = new THREE.Vector3();
      if (parent) {
        parent.updateWorldMatrix(true, false);
        normal.transformDirection(parent.matrixWorld);
        point.setFromMatrixPosition(parent.matrixWorld);
      }
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
      const hit = new THREE.Vector3();
      if (self.raycaster.ray.intersectPlane(plane, hit)) worldPoint = hit;
    }
    if (worldPoint) {
      self.cursorLocation.copy(parent ? parent.worldToLocal(worldPoint) : worldPoint);
      self.cursorLocation.y += self.data.lift;
      self.hasHit = true;
    }
    if (self.hasHit) obj.position.lerp(self.cursorLocation, self.data.smoothing);

    if (self.data.followYaw) {
      const camQuat = new THREE.Quaternion();
      camera.getWorldQuaternion(camQuat);
      const camYaw = new THREE.Euler().setFromQuaternion(camQuat, "YXZ").y;
      const parentQuat = new THREE.Quaternion();
      (parent ?? self.el.sceneEl.object3D).getWorldQuaternion(parentQuat);
      const parentYaw = new THREE.Euler().setFromQuaternion(parentQuat, "YXZ").y;
      obj.rotation.y = camYaw - parentYaw;
    }
  },

  remove() {
    const self = this as any;
    self.disposeTap?.();
  }
} as ComponentDefinition;
