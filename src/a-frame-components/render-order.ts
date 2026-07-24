import type { ComponentDefinition } from "aframe";

// Sets three.js `renderOrder` on every mesh of the loaded model, so the scene can
// control draw order for overlapping transparent surfaces (higher = drawn later,
// i.e. on top). Single-property schema: `render-order="2"`.
//
// If this entity is also a `.lod-mesh`/`.lod-billboard` child inside an
// [lod-object] group (see lod-object.ts/lod-manager.ts), this value means
// something slightly different: lod-object reads it back off this DOM
// attribute as a *local* order within that one group, and lod-manager
// recomputes the actual runtime renderOrder every frame (offset by a
// camera-distance-ranked band per group) — this component's own write above
// still runs, but gets immediately superseded, harmlessly, the next time
// lod-manager ticks. See cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md for the full
// mental model (why draw order matters at all, and how it composes with LOD).
export default {
  schema: { type: "number", default: 0 },
  init() {
    const self = this as any;
    self.applyRenderOrder = () => {
      const mesh = self.el.getObject3D("mesh");
      if (!mesh) return;
      mesh.traverse((node: any) => {
        if (node.isMesh) node.renderOrder = self.data;
      });
    };
    // `object3dset` (A-Frame's generic "a mesh object3D was just set" event)
    // rather than gltf-model's own `model-loaded` — this needs to work on
    // "any entity" (a plain A-Frame primitive like a-box/a-plane included,
    // not just a gltf-model), and a primitive has no glTF-specific event of
    // its own. Also check immediately in case the mesh is already present
    // (e.g. a primitive, whose geometry/material components may finish
    // before this component's own init() runs).
    self.el.addEventListener("object3dset", (e: any) => {
      if (e.detail.type === "mesh") self.applyRenderOrder();
    });
    if (self.el.getObject3D("mesh")) self.applyRenderOrder();
  }
} as ComponentDefinition;
