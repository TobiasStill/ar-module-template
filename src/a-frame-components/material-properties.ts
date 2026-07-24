import type { ComponentDefinition } from "aframe";

declare const THREE: any;

// Manually tunes a loaded model's PBR material properties — roughness,
// metalness, opacity, and emissive intensity/tint — directly on whatever
// material the glTF/primitive already has (typically MeshStandardMaterial),
// without discarding it the way unlit-material does.
//
//   <a-entity gltf-model="#Statue" material-properties="metalness: 1; roughness: 0.1"></a-entity>
//   <a-entity gltf-model="#Glass" material-properties="opacity: 0.4"></a-entity>
//   <a-entity gltf-model="#Glow" material-properties="emissiveIntensity: 2; emissiveTint: #ff2d55; disableShadow: true"></a-entity>
//
// Combines two needs into one component rather than shipping them
// separately: manual roughness/metalness/opacity control (no equivalent
// existed anywhere across this project's source branches) and
// Gyumin_module's emissive-material (emissive glow tuning, including a real
// KHR_materials_emissive_strength workaround — see below). Merged because
// both operate on the same real PBR material via the same traverse/clone
// step; keeping them as two separate components would double that
// clone/traversal cost and double the registration-order surface documented
// in cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §5.2 for no real benefit — the
// same reasoning unlit-material's own attribute set already grew from.
//
// KHR_materials_emissive_strength: these models' materials may use this
// glTF extension (set in Blender) to push emissiveIntensity above the
// extension's un-boosted 0..1 range — but A-Frame's bundled three.js
// predates that extension's native GLTFLoader support. On an unsupported
// extension, GLTFLoader still preserves the raw values on
// material.userData.gltfExtensions instead of applying them, so
// emissiveIntensity silently stays at its 1.0 default and the glow reads as
// dim/flat rather than the boosted brightness the artist authored. This is
// reapplied by hand from the preserved raw data, unconditionally — a
// correctness fix, not an opt-in behaviour, exactly like the source.
export default {
  schema: {
    // -1 ("don't override") vs. a real value: every numeric override here
    // uses the same sentinel convention already established by
    // unlit-material's own `alphaTest` attribute.
    roughness: { type: "number", default: -1 },
    metalness: { type: "number", default: -1 },
    // >= 0 forces material.opacity to this value and, if it's < 1, forces
    // transparent: true too (opacity alone does nothing visually unless the
    // material is also flagged transparent). Leaves transparent as-is when
    // opacity ends up >= 1, so re-authoring back to fully opaque doesn't
    // fight whatever else set transparent on this material.
    opacity: { type: "number", default: -1 },
    // Multiplier on top of the resolved emissiveIntensity (the extension's
    // boosted value when present, otherwise whatever the glTF authored).
    // 1 = as-resolved, no change.
    emissiveIntensity: { type: "number", default: 1 },
    // Optional hex colour (e.g. "#ff2d55") multiplied into the emissive
    // colour. Empty (default) = no tint.
    emissiveTint: { type: "string", default: "" },
    // Forces castShadow/receiveShadow off. Default false — unlike the
    // source emissive-material (which always forced both off, correct only
    // for its one specific "glowing light part" use case), a generic
    // material-tuning component shouldn't silently disable shadows for
    // every use case (e.g. tuning metalness/roughness on an ordinary
    // shadow-casting statue). Opt in explicitly for a glow-style part that
    // shouldn't cast/receive shadows of its own light.
    disableShadow: { type: "boolean", default: false }
  },

  init() {
    const self = this as any;
    self.applyProperties = self.applyProperties.bind(self);
    // The mesh may already be present (event fired before we initialised); if
    // so, apply now. Always (re)listen so a later load / re-parse is handled
    // too. object3dset (A-Frame's generic "a mesh object3D was just set"
    // event) rather than gltf-model's own model-loaded, so this also works
    // on a plain A-Frame primitive.
    if (self.el.getObject3D("mesh")) self.applyProperties();
    self.el.addEventListener("object3dset", (e: any) => {
      if (e.detail.type === "mesh") self.applyProperties();
    });
  },

  update(oldData: any) {
    const self = this as any;
    if (oldData === undefined) return; // init() already handles the first apply once the mesh exists
    self.applyProperties();
  },

  applyProperties() {
    const self = this as any;
    const mesh = self.el.getObject3D("mesh");
    if (!mesh) return;

    mesh.traverse((node: any) => {
      if (!node.isMesh) return;

      const mats = Array.isArray(node.material) ? node.material : [node.material];
      const newMats = mats.map((mat: any) => {
        // Clone once, on first apply, and mark our own clone as "owned" —
        // later runtime attribute changes (via update()) then mutate that
        // owned clone directly rather than re-cloning (which would discard
        // whatever a previous apply already set). A fresh, never-seen
        // material (e.g. a glTF asset shared across several random-field
        // clones of the same referenced entity, still carrying the
        // pristine loader-parsed material — see
        // cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.2) always gets its own
        // independent clone, so tuning one instance never leaks onto
        // another instance sharing the same source asset.
        const alreadyOwned = mat.userData?.materialPropertiesOwner === self;
        const owned = alreadyOwned ? mat : mat.clone();
        owned.userData = owned.userData || {};
        owned.userData.materialPropertiesOwner = self;

        if (self.data.roughness >= 0 && "roughness" in owned) owned.roughness = self.data.roughness;
        if (self.data.metalness >= 0 && "metalness" in owned) owned.metalness = self.data.metalness;

        if (self.data.opacity >= 0) {
          owned.opacity = self.data.opacity;
          owned.transparent = self.data.opacity < 1 || owned.transparent;
        }

        if ("emissive" in owned) {
          // Resolve and snapshot the BASE emissive intensity/colour exactly
          // once, on first ownership — everything below derives from that
          // fixed base plus the current attribute values, computed fresh
          // every apply. Multiplying/tinting owned.emissiveIntensity or
          // owned.emissive in place instead would compound further on every
          // later update() (e.g. re-authoring emissiveIntensity from 2 to 3
          // at runtime would yield base*2*3, not base*3).
          if (!alreadyOwned) {
            const strength = mat.userData?.gltfExtensions?.KHR_materials_emissive_strength?.emissiveStrength;
            owned.userData.baseEmissiveIntensity =
              typeof strength === "number" && owned.emissiveIntensity === 1 ? strength : owned.emissiveIntensity;
            owned.userData.baseEmissiveColor = owned.emissive.clone();
          }
          owned.emissiveIntensity = owned.userData.baseEmissiveIntensity * self.data.emissiveIntensity;
          owned.emissive.copy(owned.userData.baseEmissiveColor);
          if (self.data.emissiveTint) {
            owned.emissive.multiply(new THREE.Color(self.data.emissiveTint));
          }
        }

        owned.needsUpdate = true;
        return owned;
      });

      node.material = Array.isArray(node.material) ? newMats : newMats[0];
      if (self.data.disableShadow) {
        node.castShadow = false;
        node.receiveShadow = false;
      }
    });
  }
} as ComponentDefinition;
