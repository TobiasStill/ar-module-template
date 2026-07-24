import type { ComponentDefinition } from "aframe";

declare const THREE: any;

// Keeps a decal plane flat on the ground directly under its parent's pivot,
// regardless of how the parent is rotated/tilted, and excludes it from scene fog
// so it doesn't fade with distance.
//
// Ported from Gyumin_module. Two fixes made during this port:
//   - listens for object3dset (A-Frame's generic "a mesh object3D was just
//     set" event) instead of just gltf-model's own model-loaded, so the
//     fog exclusion also applies to a plain A-Frame primitive — the same
//     gap found and fixed in every other material-touching component on
//     this branch (see guides/RENDER-ORDER-FEATURE-GUIDE.md §3 for the original
//     finding).
//   - clones each material before setting `fog = false` on it, which the
//     source did not. A glTF asset loaded via gltf-model shares one
//     material object across every instance of that asset unless something
//     clones it first (see cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.2) —
//     without this fix, two ground-decal instances using the same decal
//     asset at different distances would incorrectly share one fog
//     setting: disabling fog on the near one would silently also disable
//     it on the far one.
export default {
  schema: {
    groundY: { type: "number", default: 0 }, // world-Y height of the ground
    live: { type: "boolean", default: false } // true = recompute every frame (for moving/rotating parents)
  },

  init() {
    const self = this as any;
    // Target world rotation: flat, texture up. -90° about X rotates a default
    // plane (normal defaults to +Z) so it faces +Y (up). If your plane exports
    // from Blender with a different starting orientation, adjust this (e.g. +90°
    // if it ends up upside-down).
    self.desiredWorldQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

    self.parentWorldQuat = new THREE.Quaternion();
    self.parentWorldPos = new THREE.Vector3();
    self.desiredWorldPos = new THREE.Vector3();

    self.applied = false;

    // Takes this decal's materials out of the scene's fog computation so
    // it isn't dimmed with distance the way ordinary geometry is.
    self.disableFog = self.disableFog.bind(self);
    if (self.el.getObject3D("mesh")) self.disableFog();
    self.el.addEventListener("object3dset", (e: any) => {
      if (e.detail.type === "mesh") self.disableFog();
    });
  },

  disableFog() {
    const self = this as any;
    const mesh = self.el.getObject3D("mesh");
    if (!mesh) return;
    mesh.traverse((node: any) => {
      if (!node.isMesh) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      const newMats = mats.map((mat: any) => {
        if (mat.userData?.groundDecalOwner === self) return mat; // already our own clone
        const owned = mat.clone();
        owned.userData = owned.userData || {};
        owned.userData.groundDecalOwner = self;
        owned.fog = false;
        return owned;
      });
      node.material = Array.isArray(node.material) ? newMats : newMats[0];
    });
  },

  tick() {
    const self = this as any;
    if (!self.data.live && self.applied) return; // in "static" mode, apply once only

    const obj = self.el.object3D;
    const parent = obj.parent;
    if (!parent) return;

    // --- Rotation: always flat, independent of the parent's rotation ---
    parent.getWorldQuaternion(self.parentWorldQuat);
    obj.quaternion.copy(self.parentWorldQuat).invert().multiply(self.desiredWorldQuat);

    // --- Position: exactly under the parent pivot, at the fixed ground height ---
    parent.getWorldPosition(self.parentWorldPos);
    self.desiredWorldPos.set(self.parentWorldPos.x, self.data.groundY, self.parentWorldPos.z);
    parent.worldToLocal(self.desiredWorldPos); // convert the world point to local coords
    obj.position.copy(self.desiredWorldPos);

    self.applied = true;
  }
} as ComponentDefinition;
