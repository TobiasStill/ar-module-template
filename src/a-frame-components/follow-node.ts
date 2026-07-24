import type { ComponentDefinition } from "aframe";

// Makes this entity's position continuously track a *named node inside
// another entity's loaded glTF* — e.g. a bone, empty, or (as with the
// shapekey-driven objects some of this project's animations use) a mesh
// object that the imported animation moves. Useful for attaching something
// A-Frame-level (a `sound` component, a light, a marker) to a specific part
// of an animated model rather than the model's overall (static) entity
// transform.
//
//   <a-entity gltf-model="#MainCharacter3" trim-loop-clip="..." id="mainEntity"></a-entity>
//   <a-entity follow-node="target: #mainEntity; node: shapekey_object"
//             sound="src: #Main; positional: true; ...">
//   </a-entity>
//
// `target`'s animation (driven by trim-loop-clip's AnimationMixer, or any
// other mixer) only updates the *local* transform of its nodes each tick;
// `matrixWorld` is normally refreshed later, during the renderer's own scene
// traversal. Reading world position here immediately after would be a frame
// stale, so this force-recomputes the node's world matrix (and its ancestors')
// on demand every tick instead of waiting for that.
declare const THREE: any;

export default {
  schema: {
    // Entity whose loaded glTF contains the node to track.
    target: { type: "selector" },
    // Name of the node (THREE.Object3D#name) within that glTF, e.g. a mesh,
    // empty, or bone name as authored in Blender.
    node: { type: "string" }
  },

  init() {
    const self = this as any;
    self.targetNode = null;
    self.tmpPos = new THREE.Vector3();
    self.warnedNotFound = false;

    self.resolveNode = () => {
      const model = self.data.target?.getObject3D?.("mesh");
      self.targetNode = model?.getObjectByName(self.data.node) ?? null;
      if (!self.targetNode && !self.warnedNotFound) {
        console.warn(`[follow-node] node "${self.data.node}" not found on target's model.`, self.el);
        self.warnedNotFound = true;
      }
    };
    self.onModelLoaded = () => self.resolveNode();

    self.data.target?.addEventListener("model-loaded", self.onModelLoaded);
    // Covers the case where target's model already finished loading before
    // this component initialised (e.g. DOM/attribute ordering).
    if (self.data.target?.getObject3D?.("mesh")) self.resolveNode();
  },

  update(oldData: any) {
    const self = this as any;
    if (oldData.target && oldData.target !== self.data.target) {
      oldData.target.removeEventListener("model-loaded", self.onModelLoaded);
    }
    if (self.data.target && self.data.target !== oldData.target) {
      self.targetNode = null;
      self.warnedNotFound = false;
      self.data.target.addEventListener("model-loaded", self.onModelLoaded);
      if (self.data.target.getObject3D?.("mesh")) self.resolveNode();
    }
  },

  tick() {
    const self = this as any;
    if (!self.targetNode) return;

    // Force an up-to-date world matrix: the animation mixer only just wrote
    // this node's local position/quaternion this frame, and matrixWorld
    // otherwise wouldn't reflect that until the renderer's own traversal.
    self.targetNode.updateWorldMatrix(true, false);
    self.targetNode.getWorldPosition(self.tmpPos);

    const parent = self.el.object3D.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(self.tmpPos);
    }
    self.el.object3D.position.copy(self.tmpPos);
  },

  remove() {
    const self = this as any;
    self.data.target?.removeEventListener("model-loaded", self.onModelLoaded);
  }
} as ComponentDefinition;
