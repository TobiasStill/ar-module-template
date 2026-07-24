import type { ComponentDefinition } from "aframe";

declare const AFRAME: any;

// Dithered cutout sphere centred on the active camera — ported from
// ar-hfg-template's `proximity-cutout` (src/app.js), same shader/algorithm.
// Every frame the camera's world position is written into a shader uniform, so
// fragments within `radius` (minus a dithered `feather` band) of the camera are
// discarded: as the camera approaches the object, a hole opens up around it
// (dithered rather than a hard edge), letting the camera "cut into" the model.
// Reads the camera's world position only; never touches the `<a-camera>`
// element itself, so it works the same regardless of who owns/drives the camera.
//
// Put it on a transform entity that wraps one or more `gltf-model` children —
// `model-loaded` bubbles, so this single component patches materials on every
// descendant model as each one loads (see no-frustum-cull for the same pattern).
//
//   <a-entity proximity-cutout="radius: 12; feather: 5">
//     <a-entity gltf-model="#Aussen1"></a-entity>
//     ...
//   </a-entity>
export default {
  schema: {
    // Distance from the camera within which fragments are cut away.
    radius: { type: "number", default: 12 },
    // Width of the dithered transition band, inside `radius`.
    feather: { type: "number", default: 5 }
  },

  init() {
    const self = this as any;
    self.centerVec = new AFRAME.THREE.Vector3();
    self.materials = [] as any[];
    // Original onBeforeCompile/customProgramCacheKey per patched material, so
    // remove() can hand them back exactly as found (mirrors the restore()
    // half of proximity-fade-shared.ts's MaterialPatcher) — without this, a
    // dynamically removed/toggled-off cutout entity would leave every
    // material it touched permanently running the cutout shader.
    self.store = new Map<any, { onBeforeCompile: any; customProgramCacheKey: any; side: any }>();

    self.onModelLoaded = (e: any) => {
      const mesh = e.target.getObject3D("mesh");
      if (!mesh) return;
      mesh.traverse((node: any) => {
        if (!node.isMesh) return;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((mat: any) => {
          if (self.store.has(mat)) return; // already patched (shared material, e.g. multiple instances of one glTF)
          self.store.set(mat, { onBeforeCompile: mat.onBeforeCompile, customProgramCacheKey: mat.customProgramCacheKey, side: mat.side });
          mat.side = AFRAME.THREE.DoubleSide;
          self.patchMaterial(mat);
        });
      });
    };
    self.el.addEventListener("model-loaded", self.onModelLoaded);
  },

  patchMaterial(material: any) {
    const self = this as any;
    material.onBeforeCompile = (shader: any) => {
      shader.uniforms.uCenter = { value: self.centerVec };
      shader.uniforms.uRadius = { value: self.data.radius };
      shader.uniforms.uFeather = { value: self.data.feather };

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           varying vec3 vWorldPos;`
        )
        .replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>
           vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
                varying vec3 vWorldPos;
                uniform vec3 uCenter;
                uniform float uRadius;
                uniform float uFeather;`
        )
        .replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
                float dist = distance(vWorldPos, uCenter);
                float cutoff = smoothstep(uRadius - uFeather, uRadius, dist);
                float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
                if (cutoff < noise) discard;`
        );

      material.userData.shader = shader;
    };
    // A-Frame 1.3.0's three.js (r137) doesn't fold onBeforeCompile into the
    // program cache key, so without a distinct key a patched material could be
    // handed a program compiled for an unpatched one with otherwise matching
    // parameters (see dither-transparency for the same fix).
    material.customProgramCacheKey = () => "proximity-cutout";
    material.needsUpdate = true;
    self.materials.push(material);
  },

  tick() {
    const self = this as any;
    if (!self.materials.length) return;

    const camera = self.el.sceneEl.camera;
    if (!camera) return;
    camera.getWorldPosition(self.centerVec);

    self.materials.forEach((mat: any) => {
      if (mat.userData.shader) {
        mat.userData.shader.uniforms.uRadius.value = self.data.radius;
        mat.userData.shader.uniforms.uFeather.value = self.data.feather;
      }
    });
  },

  remove() {
    const self = this as any;
    self.el.removeEventListener("model-loaded", self.onModelLoaded);
    self.store.forEach((snapshot: any, mat: any) => {
      mat.onBeforeCompile = snapshot.onBeforeCompile;
      mat.customProgramCacheKey = snapshot.customProgramCacheKey;
      mat.side = snapshot.side;
      mat.needsUpdate = true;
    });
    self.store.clear();
    self.materials.length = 0;
  }
} as ComponentDefinition;
