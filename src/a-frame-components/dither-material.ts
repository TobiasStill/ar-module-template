import type { ComponentDefinition } from "aframe";

// Ordered-dithering ("screen-door") transparency for a loaded model's
// materials — a manual, FIXED-opacity dither, not driven by camera distance
// (contrast with proximity-cutout and proximity-fade-dither, both of which
// drive this same kind of discard from camera proximity to a target point).
//
// A-Frame's bundled three.js predates native hashed-alpha support
// (material.alphaHash), so this injects a dither pattern into each
// material's fragment shader via onBeforeCompile: a fragment is discarded
// when its combined alpha (material opacity × vertex/texture alpha) falls
// below a per-pixel threshold. The mesh then renders in the OPAQUE pass
// (transparent=false, depthWrite=true) — no alpha blending, so no
// transparency sort artefacts, no draw-order flicker against the AR camera
// feed, and correct self-occlusion. The trade-off vs. true transparency is
// the visible dot pattern — which pattern, exactly, is what `ditherType`
// below controls; purely aesthetic, no functional difference between them.
//
//   <a-entity gltf-model="#glass" dither-material></a-entity>
//   <a-entity gltf-model="#glass" dither-material="opacity: 0.4"></a-entity>
//   <a-entity gltf-model="#glass" dither-material="ditherType: noise"></a-entity>
//
// Ported from Fanyu_module's dither-transparency.ts, renamed to fit this
// project's [x]-material naming (see unlit-material, material-properties)
// and to distinguish it from the two DISTANCE-DRIVEN dither variants
// already in this template. Two fixes made during the port:
//   - listens for object3dset (A-Frame's generic "a mesh object3D was just
//     set" event) instead of just gltf-model's own model-loaded, so this
//     also works on a plain A-Frame primitive — the same gap found and
//     fixed in every other material-mutating component on this branch (see
//     guides/RENDER-ORDER-FEATURE-GUIDE.md §3 for the original finding).
//   - clones each material before mutating it, which the source did not: a
//     glTF asset loaded via gltf-model shares one material object across
//     every instance of that asset (e.g. several random-field clones of the
//     same referenced entity) unless something clones it first — see
//     cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md §4.2. Without this fix, a
//     second dither-material instance on a shared asset would silently
//     no-op (guarded by the idempotency flag below, which the source set
//     directly on the shared material), and remove() on ANY one instance
//     would revert the dithered look for every other instance sharing that
//     material too. This port clones first, so the idempotency flag lives
//     on each instance's own private clone instead.
//
// ditherType was added after the port, not part of the source — three
// genuinely different-looking dither patterns, each reusing the EXACT
// formula already used elsewhere in this codebase for that pattern (rather
// than inventing new ones), so picking a type here matches the equivalent
// look already established by an existing feature:
//   bayer                (default) — ordered 8x8 Bayer matrix, same formula
//                         as proximity-fade-dither.ts. A visibly regular
//                         grid/crosshatch pattern.
//   noise                          — per-pixel pseudo-random hash, same
//                         formula as proximity-cutout.ts. Grainy, no
//                         repeating structure, but less evenly distributed
//                         than the other two (can clump).
//   interleaved-gradient           — the Jimenez interleaved gradient noise
//                         formula, same as lod-object.ts's
//                         setupDitherMaterial(). Soft diagonal streaks; the
//                         common real-time-rendering choice, a middle
//                         ground between the other two.

// GLSL injected after `#include <common>` (which sits after three's precision
// prefix, so function defs are legal there) — only the Bayer pattern needs
// helper functions; the other two are one-line inline hashes with nothing to
// inject here.
const DITHER_HELPERS: Record<string, string> = {
  bayer: `
float ditherBayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float ditherBayer4(vec2 a) { return ditherBayer2(0.5 * a) * 0.25 + ditherBayer2(a); }
float ditherBayer8(vec2 a) { return ditherBayer4(0.5 * a) * 0.25 + ditherBayer2(a); }
`,
  noise: "",
  "interleaved-gradient": ""
};

// Injected just before `#include <alphatest_fragment>`, where `diffuseColor`
// is in scope and already carries material opacity, vertex colour alpha,
// map alpha and alphaMap. Discards below the screen-space dither threshold.
const DITHER_DISCARD: Record<string, string> = {
  bayer: `
{
  float ditherThreshold = ditherBayer8(gl_FragCoord.xy);
  if (diffuseColor.a < ditherThreshold) discard;
}
`,
  // Same pseudo-random hash as proximity-cutout.ts.
  noise: `
{
  float ditherThreshold = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  if (diffuseColor.a < ditherThreshold) discard;
}
`,
  // Same Jimenez interleaved-gradient-noise formula as lod-object.ts's setupDitherMaterial().
  "interleaved-gradient": `
{
  float ditherThreshold = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (diffuseColor.a < ditherThreshold) discard;
}
`
};

const DEFAULT_DITHER_TYPE = "bayer";

function resolveDitherType(requested: string): string {
  if (requested in DITHER_DISCARD) return requested;
  console.warn(`[dither-material] unknown ditherType "${requested}" — falling back to "${DEFAULT_DITHER_TYPE}"`);
  return DEFAULT_DITHER_TYPE;
}

interface MaterialSnapshot {
  transparent: boolean;
  depthWrite: boolean;
  opacity: number;
  onBeforeCompile: any;
  customProgramCacheKey: any;
}

// Returns the material this node should use: either `material` itself
// (already our own owned clone from a previous apply on this same node,
// mutated in place with the current attribute values) or a freshly cloned
// and dithered copy of it.
function applyDither(
  material: any,
  opacityOverride: number,
  ditherType: string,
  store: Map<any, MaterialSnapshot>
): any {
  if (!material) return material;
  const alreadyOwned = material.userData?.__ditherMaterial === true;
  const owned = alreadyOwned ? material : material.clone();
  owned.userData = owned.userData || {};

  if (!alreadyOwned) {
    owned.userData.__ditherMaterial = true;
    // Snapshot for teardown (module switch / unmount restores the original
    // look) — captured once, before this component ever touches it.
    store.set(owned, {
      transparent: owned.transparent,
      depthWrite: owned.depthWrite,
      opacity: owned.opacity,
      onBeforeCompile: owned.onBeforeCompile,
      customProgramCacheKey: owned.customProgramCacheKey
    });
  }

  if (opacityOverride >= 0) owned.opacity = opacityOverride;
  owned.transparent = false; // dither handles see-through; keep it in the opaque pass
  owned.depthWrite = true;

  owned.onBeforeCompile = (shader: any) => {
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + DITHER_HELPERS[ditherType])
      .replace("#include <alphatest_fragment>", DITHER_DISCARD[ditherType] + "\n#include <alphatest_fragment>");
  };
  // three's default program cache key doesn't fold in onBeforeCompile edits,
  // so without a distinct key it could hand this material a program
  // compiled for a differently-dithered (or non-dithered) one with matching
  // parameters. The key includes ditherType specifically so switching type
  // at runtime (via update()) always gets its own freshly-compiled program
  // instead of silently reusing a cached one built for a different pattern.
  owned.customProgramCacheKey = () => "dither-material-" + ditherType;
  owned.needsUpdate = true; // force a recompile with the injected shader
  return owned;
}

export default {
  schema: {
    // < 0 keeps each material's own alpha; >= 0 overrides every material's opacity.
    opacity: { type: "number", default: -1 },
    // "bayer" | "noise" | "interleaved-gradient" — see the file header for
    // what each looks like. An unrecognised value falls back to "bayer"
    // with a console warning rather than silently doing nothing.
    ditherType: { type: "string", default: DEFAULT_DITHER_TYPE }
  },

  init() {
    const self = this as any;
    self.store = new Map();
    self.applyToMesh = self.applyToMesh.bind(self);
    if (self.el.getObject3D("mesh")) self.applyToMesh();
    self.el.addEventListener("object3dset", (e: any) => {
      if (e.detail.type === "mesh") self.applyToMesh();
    });
  },

  update(oldData: any) {
    const self = this as any;
    if (oldData === undefined) return; // init() already handles the first apply once the mesh exists
    // Re-run the full traversal: applyDither() detects already-owned clones
    // and mutates them in place with the current opacity/ditherType rather
    // than re-cloning from the (now stale) pristine originals — safe to
    // call again for any attribute change, not just opacity.
    self.applyToMesh();
  },

  applyToMesh() {
    const self = this as any;
    const mesh = self.el.getObject3D("mesh");
    if (!mesh) return;
    const ditherType = resolveDitherType(self.data.ditherType);
    mesh.traverse((node: any) => {
      if (!node.isMesh || !node.material) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      const newMats = mats.map((m: any) => applyDither(m, self.data.opacity, ditherType, self.store));
      node.material = Array.isArray(node.material) ? newMats : newMats[0];
    });
  },

  remove() {
    const self = this as any;
    self.store.forEach((orig: MaterialSnapshot, m: any) => {
      m.transparent = orig.transparent;
      m.depthWrite = orig.depthWrite;
      m.opacity = orig.opacity;
      m.onBeforeCompile = orig.onBeforeCompile;
      m.customProgramCacheKey = orig.customProgramCacheKey;
      if (m.userData) delete m.userData.__ditherMaterial;
      m.needsUpdate = true;
    });
    self.store.clear();
  }
} as ComponentDefinition;
