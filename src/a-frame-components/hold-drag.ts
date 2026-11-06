import type { ComponentDefinition } from "aframe";

declare const THREE: any;

// Tap-and-hold to pick an entity up and drag it along the ground — 8th
// Wall's `xrextras-hold-drag`, made to work inside transformed parents:
//
//   <a-entity gltf-model="#model" hold-drag></a-entity>
//   <a-entity gltf-model="#model" hold-drag="ground: #my-ground; riseHeight: 0.2"></a-entity>
//
// After holding for `dragDelay` ms the entity lifts to `riseHeight` and
// follows the finger across the ground; on release it drops back to y = 0.
// Ground: the `ground` entity's meshes if given, otherwise the horizontal
// plane y = 0 of the entity's parent (no extra ground object needed).
// `riseHeight` and the drop height are in the parent's units.
//
// Needs the host's cursor/raycaster to hit `.cantap` (the class is added
// here — the press arrives as `mousedown` from the host's cursor) and
// `xrextras-gesture-detector` on the scene for `onefingermove` /
// `onefingerend` (both are set by the host and by lib/preview-ar.ts).
// Usually set through `gesture-control` together with rotate/scale.
//
// Why not xrextras-hold-drag itself: it writes the ground hit point (world
// space) and a world-space riseHeight straight into the LOCAL position and
// measures the drag distance between the local position and the camera
// (verified in @8thwall/xrextras' source) — correct only for an entity whose
// parent sits untransformed at the scene origin. A module always sits under
// the host's offset root, so it jumps. Here every point is converted into
// the parent's local space. Also: `ground` is an optional selector instead of
// a required id (the original throws without a #ground), and the camera is
// the scene's active camera instead of a required #camera id. The
// original's `groundId` / `cameraId` are still accepted, so markup written
// for xrextras-hold-drag carries over unchanged (`groundId` is used when
// `ground` isn't set; `cameraId` is ignored).
//
// Ported from augmented-bahnhofsviertel's hold-drag.
export default {
  schema: {
    ground: { type: "selector" },
    groundId: { type: "string", default: "" },
    cameraId: { type: "string", default: "" },
    dragDelay: { type: "number", default: 300 },
    riseHeight: { type: "number", default: 1 }
  },

  init() {
    const self = this as any;
    self.groundEl = () => self.data.ground ?? (self.data.groundId ? document.getElementById(self.data.groundId) : null);
    self.state = { fingerDown: false, dragging: false, distance: 0, startDragTimeout: null, positionRaw: null };
    self.raycaster = new THREE.Raycaster();

    self.fingerDown = (e: any) => {
      self.state.fingerDown = true;
      self.state.startDragTimeout = setTimeout(self.startDrag, self.data.dragDelay);
      self.state.positionRaw = e.detail?.positionRaw ?? null;
    };
    self.startDrag = () => {
      const camera = self.el.sceneEl.camera;
      if (!self.state.fingerDown || !camera) return;
      self.state.dragging = true;
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      self.el.object3D.getWorldPosition(a);
      camera.getWorldPosition(b);
      self.state.distance = a.distanceTo(b);
    };
    self.fingerMove = (e: any) => {
      self.state.positionRaw = e.detail?.positionRaw ?? null;
    };
    self.fingerUp = () => {
      self.state.fingerDown = false;
      clearTimeout(self.state.startDragTimeout);
      self.state.positionRaw = null;
      if (self.state.dragging) {
        const p = self.el.object3D.position;
        self.el.setAttribute("animation__hold-drag-drop", {
          property: "position",
          to: `${p.x} 0 ${p.z}`,
          dur: 300,
          easing: "easeOutQuad"
        });
      }
      self.state.dragging = false;
    };

    self.el.addEventListener("mousedown", self.fingerDown);
    self.el.sceneEl.addEventListener("onefingermove", self.fingerMove);
    self.el.sceneEl.addEventListener("onefingerend", self.fingerUp);
    self.el.classList.add("cantap");
  },

  // The parent's y = 0 plane in world space (the default ground).
  parentFloorPlane() {
    const self = this as any;
    const parent = self.el.object3D.parent;
    const normal = new THREE.Vector3(0, 1, 0);
    const point = new THREE.Vector3();
    if (parent) {
      parent.updateWorldMatrix(true, false);
      normal.transformDirection(parent.matrixWorld);
      point.setFromMatrixPosition(parent.matrixWorld);
    }
    return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
  },

  tick() {
    const self = this as any;
    if (!self.state.dragging) return;
    const camera = self.el.sceneEl.camera;
    if (!camera) return;
    let worldPoint: any = null;
    if (self.state.positionRaw) {
      const x = (self.state.positionRaw.x / document.body.clientWidth) * 2 - 1;
      const y = (self.state.positionRaw.y / document.body.clientHeight) * 2 - 1;
      self.raycaster.setFromCamera(new THREE.Vector2(x, -y), camera);
      const ground = self.groundEl();
      if (ground) {
        const hits = self.raycaster.intersectObject(ground.object3D, true);
        if (hits.length > 0) {
          self.state.distance = hits[0].distance;
          worldPoint = hits[0].point.clone();
        }
      } else {
        const hit = new THREE.Vector3();
        if (self.raycaster.ray.intersectPlane(self.parentFloorPlane(), hit)) {
          self.state.distance = self.raycaster.ray.origin.distanceTo(hit);
          worldPoint = hit;
        }
      }
    }
    if (!worldPoint) {
      worldPoint = camera.localToWorld(new THREE.Vector3(0, 0, -self.state.distance));
    }
    const parent = self.el.object3D.parent;
    const target = parent ? parent.worldToLocal(worldPoint) : worldPoint;
    target.y = self.data.riseHeight;
    self.el.object3D.position.lerp(target, 0.2);
  },

  remove() {
    const self = this as any;
    self.el.removeEventListener("mousedown", self.fingerDown);
    self.el.sceneEl.removeEventListener("onefingermove", self.fingerMove);
    self.el.sceneEl.removeEventListener("onefingerend", self.fingerUp);
    if (self.state.fingerDown) self.fingerUp();
  }
} as ComponentDefinition;
