import type { ComponentDefinition } from "aframe";

declare const AFRAME: any;

// Shared schema/ramp/target logic for proximity-fade.ts (true alpha
// transparency) and proximity-fade-dither.ts (dithered opaque-pass
// transparency) — the two components take identical attributes and compute
// the exact same opacity value each frame; they only differ in how a material
// is patched to actually display that opacity (see MaterialPatcher below).

// Fades an object's opacity based on how far the active camera is from it —
// ported from ar-hfg-template's `proximity-fade` (src/app.js), including its
// customizable `target` point (default 0 0 0). `target` is a LOCAL offset from
// this entity (like a child entity's `position` would be), converted to world
// space every frame via localToWorld — so it stays correct regardless of where
// the parent transform entity is placed/rotated/scaled, without needing a
// hand-tuned world coordinate kept in sync with it. The default 0 0 0 is just
// this entity's own origin, so it needs no special-casing. If you place a
// debug marker to visualize `target`, make it a child of this entity at the
// same local coordinates — that's the point being measured from.
//
// Models a single appear-then-disappear "window" as the camera moves from far
// away in toward `target`, using two independent ramps that combine (by
// multiplying) into the final opacity:
//   - fade-in (fadeInStart/fadeInEnd): fully transparent at the FARTHER of the
//     two values, fully opaque at the NEARER — whichever attribute holds which
//     number. `tick()` resolves the far/near anchors with Math.max/Math.min
//     rather than trusting fadeInStart to always be the larger one, so this
//     ramp behaves the same whichever order you set the two distances in.
//   - fade-out (fadeOutStart/fadeOutEnd): fully opaque at the FARTHER of the
//     two values, fully transparent at the NEARER — same order-independence,
//     resolved the same way. (fade-out's far/near map to opacity the other
//     way round from fade-in's — that's the actual difference between "fade
//     in as you approach" and "fade out as you get closer still", not
//     something either ramp special-cases internally.)
// Between fade-in's near anchor and fade-out's far anchor both ramps are
// pinned at 1, so the object simply stays fully opaque — the "plateau" while
// you're still approaching fade-out's far anchor. That plateau exists as long
// as fade-in's near anchor is at or beyond fade-out's far anchor; if it's
// nearer than that instead, there's a gap where neither ramp is at 1 and the
// object dips below full opacity in between (still a smooth, single dip —
// see the multiplication note below — just never reaching fully opaque).
// Only care about one ramp? Leave the other at its default — both fadeIn and
// fadeOut default to 0/0, a no-op, so either works standalone.
//
// Multiplying the two ramps together is also the safeguard for conflicting/
// overlapping ranges between fade-in and fade-out: since each ramp is
// independently clamped to [0, 1], their product is always bounded too,
// whatever the two ranges are set to relative to each other (overlapping,
// nested, non-overlapping) — there's no special-case precedence logic that
// can glitch, just a smooth (if occasionally non-full-opacity) curve. A
// degenerate ramp (its two values equal) would otherwise divide by zero;
// that case is treated as a hard step instead.
export const PROXIMITY_FADE_SCHEMA = {
  // Fade-in ramp: two distances from the camera, in either order — whichever
  // is farther is fully transparent, whichever is nearer is fully opaque.
  // Defaults to a no-op (0/0, i.e. always opaque w.r.t. this ramp) so it can
  // be left unset when only fade-out is wanted.
  fadeInStart: { type: "number", default: 0 },
  fadeInEnd: { type: "number", default: 0 },
  // Fade-out ramp: two distances from the camera, in either order —
  // whichever is farther is fully opaque, whichever is nearer (closer to
  // `target`) is fully transparent. Also defaults to a no-op (0/0) so it can
  // be left unset when only fade-in is wanted — either ramp works standalone
  // without the other silently zeroing the result.
  fadeOutStart: { type: "number", default: 0 },
  fadeOutEnd: { type: "number", default: 0 },
  // Local offset from this entity to measure distance from (converted to
  // world space every frame). Defaults to 0 0 0 — this entity's own origin.
  target: { type: "vec3", default: { x: 0, y: 0, z: 0 } }
} as const;

// Ramps 0 -> 1 as dist goes from `distAtZero` to `distAtOne` (either may be
// larger), clamped to [0, 1]. A degenerate (distAtZero === distAtOne) range is
// treated as a hard step rather than dividing by zero.
export function rampFactor(dist: number, distAtZero: number, distAtOne: number): number {
  if (distAtOne === distAtZero) return dist >= distAtZero ? 1 : 0;
  return AFRAME.THREE.MathUtils.clamp((dist - distAtZero) / (distAtOne - distAtZero), 0, 1);
}

// Applies/reverts whatever technique a material needs to actually render the
// opacity value proximity-fade computes each frame (real alpha blending vs.
// dithered opaque-pass discard). `patch` runs once per material, on
// `model-loaded`; `restore` undoes it on the component's `remove()`.
// `applyOpacity` runs every tick with the freshly computed opacity — the
// default (`material.opacity = opacity`) is all the dither variant needs
// (the discard reads `material.opacity` via `diffuseColor.a`), but a patcher
// can override it, e.g. to also toggle `material.visible` at 0.
export interface MaterialPatcher<S> {
  patch(material: any): S;
  restore(material: any, snapshot: S): void;
  applyOpacity?(material: any, opacity: number): void;
}

function defaultApplyOpacity(material: any, opacity: number): void {
  material.opacity = opacity;
}

// Builds the actual A-Frame component: collects materials from every
// descendant `gltf-model` (via bubbled `model-loaded`, so one instance on a
// transform entity covers all its children — see no-frustum-cull for the same
// pattern), tracks camera distance to `target`, and drives each material's
// `opacity` from the combined fade-in/fade-out ramp. Reads the camera's world
// position only; never touches the `<a-camera>` element itself, so it works
// the same regardless of who owns/drives the camera.
export function createProximityFadeComponent<S>(patcher: MaterialPatcher<S>): ComponentDefinition {
  return {
    schema: PROXIMITY_FADE_SCHEMA,

    init() {
      const self = this as any;
      self.materials = [] as any[];
      self.store = new Map<any, S>();
      self.cameraPos = new AFRAME.THREE.Vector3();
      self.targetPos = new AFRAME.THREE.Vector3();

      self.onModelLoaded = (e: any) => {
        const mesh = e.target.getObject3D("mesh");
        if (!mesh) return;
        mesh.traverse((node: any) => {
          if (!node.isMesh || !node.material) return;
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach((mat: any) => {
            if (!self.store.has(mat)) self.store.set(mat, patcher.patch(mat));
            self.materials.push(mat);
          });
        });
      };
      self.el.addEventListener("model-loaded", self.onModelLoaded);
    },

    tick() {
      const self = this as any;
      if (!self.materials.length) return;

      const camera = self.el.sceneEl.camera;
      if (!camera) return;
      camera.getWorldPosition(self.cameraPos);

      const { x, y, z } = self.data.target;
      self.targetPos.set(x, y, z);
      self.el.object3D.localToWorld(self.targetPos);

      const dist = self.cameraPos.distanceTo(self.targetPos);

      // Resolve each ramp's own far/near anchors from the actual values
      // rather than trusting fadeInStart/fadeOutStart to always be the
      // larger one — see the header comment above. fade-in: far -> 0 (fully
      // transparent), near -> 1 (fully opaque). fade-out: near -> 0, far -> 1
      // (the opposite mapping — that's the difference between the two
      // ramps, not an order-dependence bug).
      const fadeInFar = Math.max(self.data.fadeInStart, self.data.fadeInEnd);
      const fadeInNear = Math.min(self.data.fadeInStart, self.data.fadeInEnd);
      const fadeOutFar = Math.max(self.data.fadeOutStart, self.data.fadeOutEnd);
      const fadeOutNear = Math.min(self.data.fadeOutStart, self.data.fadeOutEnd);

      const fadeIn = rampFactor(dist, fadeInFar, fadeInNear);
      const fadeOut = rampFactor(dist, fadeOutNear, fadeOutFar);
      const opacity = fadeIn * fadeOut;

      const applyOpacity = patcher.applyOpacity ?? defaultApplyOpacity;
      self.materials.forEach((mat: any) => {
        applyOpacity(mat, opacity);
      });
    },

    remove() {
      const self = this as any;
      self.el.removeEventListener("model-loaded", self.onModelLoaded);
      self.store.forEach((snapshot: S, mat: any) => patcher.restore(mat, snapshot));
      self.store.clear();
      self.materials.length = 0;
    }
  } as ComponentDefinition;
}
