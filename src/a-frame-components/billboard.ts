import type { ComponentDefinition } from "aframe";

declare const THREE: any;

// Spins the entity about its local Y axis so it always faces the camera.
//
// The camera's world position is converted into the parent's local space first,
// so any rotation/position/scale on the parent (e.g. a tilted object) is
// respected automatically — the local Y axis stays the spin axis however
// skewed it sits in the world.
export default {
  init() {
    const self = this as any;
    self.camWorldPos = new THREE.Vector3();
    self.localCamPos = new THREE.Vector3();
  },

  tick() {
    const self = this as any;
    const camera = self.el.sceneEl.camera;
    if (!camera) return;

    const obj = self.el.object3D;
    if (!obj.parent) return;

    camera.getWorldPosition(self.camWorldPos);

    self.localCamPos.copy(self.camWorldPos);
    obj.parent.worldToLocal(self.localCamPos);

    const dx = self.localCamPos.x - obj.position.x;
    const dz = self.localCamPos.z - obj.position.z;

    obj.rotation.y = Math.atan2(dx, dz);
  }
} as ComponentDefinition;
