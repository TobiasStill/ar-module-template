import type { ComponentDefinition } from "aframe";
import { createProximityFadeComponent, MaterialPatcher } from "./proximity-fade-shared";

// Dithered opaque-pass transparency variant of proximity-fade — see
// proximity-fade-shared.ts for the shared schema/ramp/target behaviour (both
// this and proximity-fade.ts take identical attributes and compute the same
// opacity; they only differ in how a material displays it). Use this instead
// of plain proximity-fade when the object overlaps other transparent
// materials in the scene: real alpha blending is order-dependent and glitches
// (sorting artefacts, wrong occlusion) against other transparent objects.
// Dithering instead discards fragments in a Bayer pattern and renders in the
// OPAQUE pass (transparent: false, depthWrite: true), so it composites
// correctly regardless of what else is transparent — at the cost of a visible
// dot pattern during the transition. Same technique as dither-transparency.ts.
const BAYER_GLSL = `
float ditherBayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float ditherBayer4(vec2 a) { return ditherBayer2(0.5 * a) * 0.25 + ditherBayer2(a); }
float ditherBayer8(vec2 a) { return ditherBayer4(0.5 * a) * 0.25 + ditherBayer2(a); }
`;

// `diffuseColor.a` here already carries material.opacity × any texture/vertex
// alpha (three.js sets `diffuseColor = vec4(diffuse, opacity)` at the top of
// main(), then multiplies in map/vertex-color alpha) — so mutating
// `material.opacity` each tick (in the shared tick(), unchanged) drives this
// discard every frame with no extra uniform plumbing needed.
const DITHER_DISCARD = `
{
  float ditherThreshold = ditherBayer8(gl_FragCoord.xy);
  if (diffuseColor.a < ditherThreshold) discard;
}
`;

interface DitherSnapshot {
  transparent: boolean;
  depthWrite: boolean;
  onBeforeCompile: any;
  customProgramCacheKey: any;
}

const ditherPatcher: MaterialPatcher<DitherSnapshot> = {
  patch(material: any): DitherSnapshot {
    const snapshot: DitherSnapshot = {
      transparent: material.transparent,
      depthWrite: material.depthWrite,
      onBeforeCompile: material.onBeforeCompile,
      customProgramCacheKey: material.customProgramCacheKey
    };

    material.transparent = false; // dither handles see-through; keep it in the opaque pass
    material.depthWrite = true;

    material.onBeforeCompile = (shader: any) => {
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\n" + BAYER_GLSL)
        .replace("#include <alphatest_fragment>", DITHER_DISCARD + "\n#include <alphatest_fragment>");
    };
    // A-Frame 1.3.0's three.js (r137) doesn't fold onBeforeCompile into the
    // program cache key, so without a distinct key this material could be
    // handed a program compiled for a non-dithered one with matching parameters.
    material.customProgramCacheKey = () => "proximity-fade-dither";
    material.needsUpdate = true; // force a recompile with the injected shader

    return snapshot;
  },
  restore(material: any, snapshot: DitherSnapshot): void {
    material.transparent = snapshot.transparent;
    material.depthWrite = snapshot.depthWrite;
    material.onBeforeCompile = snapshot.onBeforeCompile;
    material.customProgramCacheKey = snapshot.customProgramCacheKey;
    material.needsUpdate = true;
  }
};

export default createProximityFadeComponent(ditherPatcher) as ComponentDefinition;
