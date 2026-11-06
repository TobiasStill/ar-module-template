import type { ComponentDefinition } from "aframe";

declare const THREE: any;

// Makes an entity follow another entity's world position (+ a world-space
// offset), each frame. A stand-in for 8th Wall's `xrextras-attach`, used so
// something can track the host-provided camera (`target: #camera`) or any
// other scene entity (`target: #someId`) even though it isn't a DOM child
// of it.
//
// Position only — rotation/scale are left untouched. The target is
// resolved lazily on every tick (not cached at init) so it works even if
// the target entity (e.g. the camera) mounts after this one.
//
// Ported from Gyumin_module unchanged — already fully generic in the
// source (no naming-convention or asset-specific logic). Writes
// object3D.position directly, every tick — see
// guides/ATTACH-TO-FEATURE-GUIDE.md's incompatibilities section before combining
// with wander-in-band, proximity-wave, or anything else that also writes
// this entity's position every tick.
//
// `space` (added from the Augmented Bahnhofsviertel ports' legacy-attach):
// where `offset` is measured. `world` (default, the original behaviour):
// world units and axes. `parent`: this entity's parent space — the offset
// is added after converting the target's position into the parent, so it
// scales and turns with the parent. That's what 8th Wall's
// `xrextras-attach` effectively did for elements under the same parent, and
// what a scaled scene (e.g. place-in-front with referenceHeight) needs to
// keep "1 unit above the camera" in its own units.
export default {
  schema: {
    target: { type: "selector" },
    offset: { type: "vec3", default: { x: 0, y: 0, z: 0 } },
    space: { default: "world", oneOf: ["world", "parent"] }
  },

  init() {
    const self = this as any;
    self.worldPos = new THREE.Vector3();
  },

  tick() {
    const self = this as any;
    const targetEl = self.data.target;
    if (!targetEl || !targetEl.object3D) return;

    targetEl.object3D.getWorldPosition(self.worldPos);
    const { offset, space } = self.data;
    if (space === "world") {
      self.worldPos.x += offset.x;
      self.worldPos.y += offset.y;
      self.worldPos.z += offset.z;
    }

    // Convert the desired world position into this entity's parent space, so it
    // lands correctly regardless of any parent transform.
    const parent = self.el.object3D.parent;
    if (parent) parent.worldToLocal(self.worldPos);
    if (space === "parent") {
      self.worldPos.x += offset.x;
      self.worldPos.y += offset.y;
      self.worldPos.z += offset.z;
    }
    self.el.object3D.position.copy(self.worldPos);
  }
} as ComponentDefinition;
