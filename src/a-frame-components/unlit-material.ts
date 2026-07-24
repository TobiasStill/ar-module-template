import type { ComponentDefinition } from "aframe";

// A-Frame exposes three.js as a global (set by aframe.min.js). Use it rather than
// importing the `three` package, so materials/instanceof checks share A-Frame's
// single THREE instance.
declare const THREE: any;

// Replaces a loaded model's PBR materials with flat MeshBasicMaterials, so it
// renders fully lit regardless of scene lighting — used for neon/glow meshes and
// the billboard PNG. Ported from the prototype's `unlit-material`, hardened so it:
//   - converts even if `model-loaded` already fired before this component's init
//     (otherwise a preloaded/cached model can stay a lit — and in a dim scene,
//     black — MeshStandardMaterial),
//   - is idempotent, so running twice (or after another component re-clones the
//     material) never double-wraps,
//   - falls back to the emissive texture when there's no base-colour texture, so a
//     mesh whose artwork lives in an emission shader still shows it.
//   - can force an alphaTest cutout (`alphaTest`) and/or preserve the
//     original mesh's shadow behavior (`keepShadowBehavior`), found and
//     added while verifying this against a full-character unlit-shaded
//     model with alphaMode: BLEND materials — see this component's section
//     in guides/LOD-BILLBOARD-FEATURE-GUIDE.md for why either might matter for a
//     given asset, and examples/unlit-material-usage.html for a standalone
//     (non-LOD) worked example.
export default {
  schema: {
    // Fold a material's emissive glow into the flat base color, so effects like
    // neon leuchten survive the conversion to an unlit material.
    keepEmissive: { type: "boolean", default: true },
    // Uniform multiplier on the flat colour (after the emissive fold). 1 = as-is;
    // < 1 darkens (e.g. 0.5 = half as bright); 0 = black. Since the material is
    // unlit, this is the only way to dim it.
    brightness: { type: "number", default: 1 },
    // Optional hex colour (e.g. "#ff2d55") multiplied into the flat colour, after
    // the emissive fold and brightness. Empty (default) = no tint. Multiplying
    // rather than replacing keeps any texture/emissive shading on the mesh
    // intact — a white/grey source material (e.g. HaloSphere) takes the tint
    // directly, since multiplying by white is a no-op.
    tint: { type: "string", default: "" },
    // Forces a specific alphaTest cutout on the converted material, instead
    // of preserving whatever the original material's own alphaTest was
    // (the default, -1, means "don't override"). Real-world need: a
    // material authored as alphaMode: BLEND (real alpha blending, no
    // meaningful alphaTest of its own) can still want a hard cutout once
    // converted to unlit — e.g. to discard very-transparent fringes and
    // reduce transparency-sorting artifacts on effects like flames/foliage,
    // at the cost of a hard edge instead of a soft blended one.
    alphaTest: { type: "number", default: -1 },
    // If true, leaves this mesh's castShadow/receiveShadow exactly as they
    // already are (e.g. from a `shadow` component on the same entity)
    // instead of forcing both off. Default false matches the original
    // behavior here (correct for the common case — a flat/glow-style unlit
    // surface, like an LOD billboard, usually shouldn't cast or receive
    // shadows) — set true for something like a full unlit-shaded character
    // model that should still ground itself with a cast shadow.
    keepShadowBehavior: { type: "boolean", default: false }
  },

  init() {
    const self = this as any;
    self.applyUnlit = self.applyUnlit.bind(self);
    // The mesh may already be present (event fired before we initialised); if so,
    // convert now. Always (re)listen so a later load / re-parse is handled too.
    // `object3dset` (A-Frame's generic "a mesh object3D was just set" event)
    // rather than gltf-model's own `model-loaded` — also fires for a plain
    // A-Frame primitive (box/plane/sphere/...), which has no glTF-specific
    // event of its own.
    if (self.el.getObject3D("mesh")) self.applyUnlit();
    self.el.addEventListener("object3dset", (e: any) => {
      if (e.detail.type === "mesh") self.applyUnlit();
    });
  },

  applyUnlit() {
    const self = this as any;
    const mesh = self.el.getObject3D("mesh");
    if (!mesh) return;

    mesh.traverse((node: any) => {
      if (!node.isMesh) return;

      const mats = Array.isArray(node.material) ? node.material : [node.material];
      const newMats = mats.map((oldMat: any) => {
        // Idempotent: leave a material we already converted alone.
        if (oldMat && oldMat.isMeshBasicMaterial && oldMat.userData && oldMat.userData.unlit) {
          return oldMat;
        }

        // Prefer the base-colour texture; fall back to the emissive texture so a
        // model that carries its artwork purely in an emission shader still shows it
        // instead of converting to a flat (often black) base colour.
        const map = oldMat.map || oldMat.emissiveMap || null;

        const basicMat = new THREE.MeshBasicMaterial({
          map,
          color: oldMat.color ? oldMat.color.clone() : new THREE.Color(0xffffff),
          transparent: oldMat.transparent,
          opacity: oldMat.opacity,
          side: oldMat.side,
          alphaTest: oldMat.alphaTest,
          depthWrite: oldMat.depthWrite,
          vertexColors: oldMat.vertexColors
        });

        // Carry an emissive glow over as color so the visual effect survives.
        // Guard on the emissive being an actual (non-black) colour: a plain
        // base-colour material has emissive = black with emissiveIntensity 1, and
        // lerping toward black would turn the flat colour — and thus the whole
        // textured billboard — black. That's exactly what happened to the
        // base-colour-only PNGs while emissive ones (AESPA) were unaffected.
        const e = oldMat.emissive;
        const emissiveLit = e && (e.r > 0 || e.g > 0 || e.b > 0) && oldMat.emissiveIntensity > 0;
        if (self.data.keepEmissive && emissiveLit) {
          basicMat.color.lerp(e, Math.min(oldMat.emissiveIntensity, 1));
        }

        // Optional uniform dim (default 1 = no change).
        if (self.data.brightness !== 1) {
          basicMat.color.multiplyScalar(Math.max(0, self.data.brightness));
        }

        // Optional per-instance tint (default "" = no change).
        if (self.data.tint) {
          basicMat.color.multiply(new THREE.Color(self.data.tint));
        }

        // Optional forced alphaTest cutout (default -1 = leave whatever was
        // already carried over from oldMat.alphaTest above untouched).
        if (self.data.alphaTest >= 0) {
          basicMat.alphaTest = self.data.alphaTest;
        }

        basicMat.userData.unlit = true;
        return basicMat;
      });

      node.material = Array.isArray(node.material) ? newMats : newMats[0];
      if (!self.data.keepShadowBehavior) {
        node.castShadow = false; // unlit objects sensibly cast no shadow…
        node.receiveShadow = false; // …and receive none either
      }
    });
  }
} as ComponentDefinition;