import type { ComponentDefinition } from "aframe";

declare const THREE: any;

// Puts this entity at the scene's world origin, whatever its parents do: its
// own transform is set to the inverse of its parent's world matrix, so its
// world matrix is the identity.
//
// Why: the host mounts every module inside an entity at `0 1.6 -3`
// (`AR_MODULE_POSITION` in ar-demo-backend's ArScene.vue), and so does
// `npm run dev:ar` (lib/preview-ar.ts). Content whose pose 8th Wall writes
// in WORLD terms — `xrextras-named-image-target` sets its own local
// position/rotation from the tracked image — ends up shifted by that offset.
// Wrap it in an entity with `world-origin` and the offset cancels:
//
//   <a-entity world-origin>
//     <xrextras-named-image-target name="my-target">…</xrextras-named-image-target>
//   </a-entity>
//
// Unlike a fixed counter-offset (`position="0 -1.6 3"`, used on earlier
// project branches), this stays right if the host ever stops applying the
// offset, and in any preview with a different module root. Re-checked every
// tick (one matrix inverse; written only when the parent moved), so it also
// follows a root that is set or changed after init.
//
// Writes this entity's position/rotation/scale — don't combine with another
// transform writer (place-in-front, gesture-control, attach-to, …) on the
// same entity; put those on children. See guides/IMAGE-TRACKING-FEATURE-GUIDE.md
// and README "Where a module sits".
export default {
  init() {
    const self = this as any;
    self.inverse = new THREE.Matrix4();
    self.lastParent = new THREE.Matrix4();
    self.hasLast = false;
  },

  tick() {
    const self = this as any;
    const obj = self.el.object3D;
    const parent = obj.parent;
    if (!parent) return;
    parent.updateWorldMatrix(true, false);
    if (self.hasLast && self.lastParent.equals(parent.matrixWorld)) return;
    self.lastParent.copy(parent.matrixWorld);
    self.hasLast = true;
    self.inverse.copy(parent.matrixWorld).invert();
    self.inverse.decompose(obj.position, obj.quaternion, obj.scale);
    obj.updateMatrixWorld(true);
  }
} as ComponentDefinition;
