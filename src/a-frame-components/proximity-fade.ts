import type { ComponentDefinition } from "aframe";
import { createProximityFadeComponent, MaterialPatcher } from "./proximity-fade-shared";

// Real alpha-blended transparency variant of proximity-fade — see
// proximity-fade-shared.ts for the shared schema/ramp/target behaviour (both
// this and proximity-fade-dither.ts take identical attributes and compute the
// same opacity; they only differ in how a material displays it). Alpha
// blending is order-dependent: if this object overlaps other transparent
// materials in the scene, expect sorting artefacts. Use proximity-fade-dither
// instead when that's a problem while the object IS visible; here, once
// opacity reaches exactly 0 the material is switched off (`visible = false`)
// rather than left blending at zero alpha — invisible either way, but this
// drops it out of the transparent render/sort list entirely instead of
// silently participating in sorting against other transparent objects.
interface TrueTransparencySnapshot {
  transparent: boolean;
  visible: boolean;
}

const trueTransparencyPatcher: MaterialPatcher<TrueTransparencySnapshot> = {
  patch(material: any): TrueTransparencySnapshot {
    const snapshot = { transparent: material.transparent, visible: material.visible };
    material.transparent = true;
    return snapshot;
  },
  restore(material: any, snapshot: TrueTransparencySnapshot): void {
    material.transparent = snapshot.transparent;
    material.visible = snapshot.visible;
  },
  applyOpacity(material: any, opacity: number): void {
    material.opacity = opacity;
    material.visible = opacity > 0;
  }
};

export default createProximityFadeComponent(trueTransparencyPatcher) as ComponentDefinition;
