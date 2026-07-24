import type { ComponentDefinition } from "aframe";

// Sets three.js `renderOrder` on individual NAMED meshes within a single
// loaded model, by mesh name (as authored in Blender/your DCC tool) — for
// one glb/gltf asset whose own overlapping/layered internal parts need a
// controlled draw order relative to EACH OTHER.
//
//   <a-entity gltf-model="#MyModel" mesh-render-order="PartA: 1; PartB: 2; PartC: 3"></a-entity>
//
// Different granularity from [render-order] (see
// guides/RENDER-ORDER-FEATURE-GUIDE.md), which sets ONE uniform value across an
// entire loaded model — that's the right tool when a whole object needs
// ordering relative to OTHER objects; this is the right tool when a single
// asset's own named sub-meshes need ordering relative to each other. Don't
// use both on the same entity — see
// guides/MESH-RENDER-ORDER-FEATURE-GUIDE.md's incompatibilities section,
// including a real conflict with [lod-object]/[lod-manager] this port
// found and documents rather than silently working around.
export default {
  schema: { type: "string", default: "" },

  init() {
    const self = this as any;
    self.orderByName = self.parseOrders(self.data);
    self.applyOrders = self.applyOrders.bind(self);
    // `object3dset` (A-Frame's generic "a mesh object3D was just set" event)
    // rather than gltf-model's own `model-loaded` — see
    // guides/RENDER-ORDER-FEATURE-GUIDE.md §3 for why this matters even though a
    // multi-named-mesh asset is realistically always a glTF, not a plain
    // primitive (consistency with every other component in this family, and
    // it costs nothing).
    self.el.addEventListener("object3dset", (e: any) => {
      if (e.detail.type === "mesh") self.applyOrders();
    });
    if (self.el.getObject3D("mesh")) self.applyOrders();
  },

  update(oldData: any) {
    const self = this as any;
    if (oldData === undefined) return; // init() already parsed + will apply once the mesh exists
    if (self.data === oldData) return;
    self.orderByName = self.parseOrders(self.data);
    self.applyOrders();
  },

  /**
   * Parses "MeshName: number; MeshName2: number; ..." into a lookup object.
   * A malformed entry (missing/non-numeric value) is skipped with a console
   * warning rather than discarding every other entry, so one typo doesn't
   * blank out the whole mapping.
   */
  parseOrders(raw: string): Record<string, number> {
    const out: Record<string, number> = {};
    if (!raw) return out;
    for (const entry of raw.split(";")) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) {
        console.warn(`[mesh-render-order] invalid entry "${trimmed}" — expected "MeshName: number"`);
        continue;
      }
      const name = trimmed.slice(0, colonIndex).trim();
      const value = Number(trimmed.slice(colonIndex + 1).trim());
      if (!name || !Number.isFinite(value)) {
        console.warn(`[mesh-render-order] invalid entry "${trimmed}" — expected "MeshName: number"`);
        continue;
      }
      out[name] = value;
    }
    return out;
  },

  applyOrders() {
    const self = this as any;
    const mesh = self.el.getObject3D("mesh");
    if (!mesh) return;
    mesh.traverse((node: any) => {
      if (node.isMesh && node.name in self.orderByName) {
        node.renderOrder = self.orderByName[node.name];
      }
    });
  }
} as ComponentDefinition;
