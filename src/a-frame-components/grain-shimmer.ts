import type { ComponentDefinition } from "aframe";

declare const THREE: any;

// A grainy, shimmering surface look: fine grain on a model that sparkles
// as the viewer (or the model) moves — the look of #20 Solid Dream Level
// (augmented-bahnhofsviertel), made available for any model.
//
//   <a-entity gltf-model="#model" grain-shimmer></a-entity>
//   <a-entity gltf-model="#model" grain-shimmer="grain: 0.5; grainScale: 400; animated: true"></a-entity>
//   <a-entity gltf-model="#sprayed" grain-shimmer="grain: 0"></a-entity>   <!-- filter only -->
//
// Where #20's shimmer comes from: its textures are pixel-fine spray-paint
// grain, and its glTF sampler has `minFilter: LINEAR` without mipmaps. When
// a texture is drawn smaller than it is, every screen pixel then picks one
// grain at random instead of an average — and with every small movement a
// different one, so the surface sparkles. With mipmaps the grain would blur
// into a calm mixed colour.
//
// Two independent knobs:
//   1. `filter` — the sampling: `linear` (default) or `nearest` (harder,
//      more pixelated) turn mipmaps off on the model's textures; `mipmap`
//      leaves them as they are. On its own this already makes any fine-
//      grained texture shimmer.
//   2. `grain` (0–1, default 0.35) — a grain pattern added in the shader,
//      for models whose textures are smooth: brightness noise fixed to the
//      surface (`grainScale` cells per local unit; object space, so it
//      sticks to the model and sparkles with movement). `animated: true`
//      re-seeds it `speed` times a second, so it also trickles when nothing
//      moves (film grain). `grain: 0` = no shader change.
//
// Materials and textures are cloned before they're changed (glTF instances
// share them — AGENTS.md §5) and restored on remove(). Applies on
// `object3dset` (type mesh), so primitives and models swapped later work.
// The shader patch chains any onBeforeCompile already on the material and
// extends customProgramCacheKey, so it composes with other patches (dither,
// proximity effects) instead of replacing them.
export default {
  schema: {
    filter: { default: "linear", oneOf: ["linear", "nearest", "mipmap"] },
    grain: { type: "number", default: 0.35 },
    grainScale: { type: "number", default: 300 },
    animated: { type: "boolean", default: false },
    speed: { type: "number", default: 24 }
  },

  init() {
    const self = this as any;
    self.originals = new Map(); // mesh -> original material(s)
    self.uniforms = {
      grainStrength: { value: self.data.grain },
      grainScale: { value: self.data.grainScale },
      grainSeed: { value: 0 }
    };
    self.elapsed = 0;
    self.onObject3DSet = (e: any) => {
      if (e.detail?.type === "mesh") self.apply();
    };
    self.el.addEventListener("object3dset", self.onObject3DSet);
    // A-Frame primitives load their `material` texture asynchronously and set
    // it on A-Frame's own material object — re-apply once it arrives.
    self.onTextureLoaded = () => {
      self.restore();
      self.apply();
    };
    self.el.addEventListener("materialtextureloaded", self.onTextureLoaded);
  },

  update(oldData: any) {
    const self = this as any;
    self.uniforms.grainStrength.value = self.data.grain;
    self.uniforms.grainScale.value = self.data.grainScale;
    const structural = !oldData || oldData.filter !== self.data.filter || (oldData.grain > 0) !== (self.data.grain > 0);
    if (structural) {
      self.restore();
      self.apply();
    }
  },

  apply() {
    const self = this as any;
    const root = self.el.getObject3D("mesh");
    if (!root) return;
    root.traverse((node: any) => {
      if (!node.isMesh || self.originals.has(node)) return;
      self.originals.set(node, node.material);
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      const patched = mats.map((m: any) => (m ? self.patchMaterial(m) : m));
      node.material = Array.isArray(node.material) ? patched : patched[0];
    });
  },

  patchMaterial(original: any) {
    const self = this as any;
    const d = self.data;
    const material = original.clone();
    // Keep another component's shader patch (clone() drops it).
    if (original.onBeforeCompile && d.grain <= 0) {
      material.onBeforeCompile = original.onBeforeCompile;
      if (Object.prototype.hasOwnProperty.call(original, "customProgramCacheKey")) {
        material.customProgramCacheKey = original.customProgramCacheKey;
      }
    }

    if (d.filter !== "mipmap") {
      const minFilter = d.filter === "nearest" ? THREE.NearestFilter : THREE.LinearFilter;
      for (const key of ["map", "emissiveMap", "roughnessMap", "metalnessMap", "aoMap", "normalMap", "alphaMap"]) {
        const tex = material[key];
        if (!tex) continue;
        const own = tex.clone(); // shares the image, not the sampler settings
        own.minFilter = minFilter;
        if (d.filter === "nearest") own.magFilter = THREE.NearestFilter;
        own.generateMipmaps = false;
        own.needsUpdate = true;
        material[key] = own;
      }
    }

    if (d.grain > 0) {
      // material.clone() doesn't copy onBeforeCompile / customProgramCacheKey,
      // so another component's shader patch on the original is taken over
      // explicitly and chained.
      const prev = original.onBeforeCompile;
      const ownKey = Object.prototype.hasOwnProperty.call(original, "customProgramCacheKey")
        ? original.customProgramCacheKey.bind(original)
        : null;
      material.onBeforeCompile = (shader: any, renderer: any) => {
        if (prev) prev.call(material, shader, renderer);
        Object.assign(shader.uniforms, self.uniforms);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vGrainPos;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGrainPos = transformed;");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", `#include <common>
varying vec3 vGrainPos;
uniform float grainStrength;
uniform float grainScale;
uniform float grainSeed;
float grainHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419) + grainSeed);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}`)
          .replace("#include <map_fragment>", `#include <map_fragment>
diffuseColor.rgb *= 1.0 + (grainHash(floor(vGrainPos * grainScale)) - 0.5) * 2.0 * grainStrength;`);
      };
      material.customProgramCacheKey = () => `${ownKey ? ownKey() : ""}|grain-shimmer`;
    }
    material.needsUpdate = true;
    return material;
  },

  restore() {
    const self = this as any;
    self.originals.forEach((original: any, node: any) => {
      const current = Array.isArray(node.material) ? node.material : [node.material];
      current.forEach((m: any) => {
        if (!m) return;
        for (const key of ["map", "emissiveMap", "roughnessMap", "metalnessMap", "aoMap", "normalMap", "alphaMap"]) {
          const origMats = Array.isArray(original) ? original : [original];
          if (m[key] && !origMats.some((o: any) => o?.[key] === m[key])) m[key].dispose();
        }
        m.dispose();
      });
      node.material = original;
    });
    self.originals.clear();
  },

  tick(_t: number, delta: number) {
    const self = this as any;
    if (!self.data.animated || self.data.grain <= 0) return;
    self.elapsed += (delta || 0) / 1000;
    const step = 1 / Math.max(1, self.data.speed);
    if (self.elapsed >= step) {
      self.elapsed = 0;
      self.uniforms.grainSeed.value = Math.random() * 100;
    }
  },

  remove() {
    const self = this as any;
    self.el.removeEventListener("object3dset", self.onObject3DSet);
    self.el.removeEventListener("materialtextureloaded", self.onTextureLoaded);
    self.restore();
  }
} as ComponentDefinition;
