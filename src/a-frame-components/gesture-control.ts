import type { ComponentDefinition } from "aframe";

// Touch gestures for one entity in a single attribute: hold-and-drag along
// the ground, rotate, pinch to scale.
//
//   <a-entity gltf-model="#model" gesture-control></a-entity>
//   <a-entity gltf-model="#model"
//             gesture-control="rotate: one-finger; drag: false; minScale: 0.5; maxScale: 2"></a-entity>
//
// A thin layer: it sets (and on change/removal removes) three components on
// the same entity —
//   drag   → hold-drag (this template's, works inside transformed parents),
//   rotate → xrextras-two-finger-rotate or xrextras-one-finger-rotate,
//   scale  → xrextras-pinch-scale —
// so the gestures, their pitfalls and their defaults are configured in one
// place. The xrextras components come from xrextras, which the host and both
// previews load. All three need `xrextras-gesture-detector` on the scene
// (set by the host and lib/preview-ar.ts).
//
// Good to know (verified in @8thwall/xrextras' source):
//   - Rotate and pinch react to two-finger gestures ANYWHERE on the screen,
//     not just on the entity — every entity with them turns/scales at once.
//     Put gesture-control on one entity (or one group) per scene.
//   - Pinch scales around the entity's own origin, between minScale and
//     maxScale times the scale it had when gesture-control was set. Put it
//     on the model itself, not on a big group whose origin lies far away —
//     otherwise the model drifts while scaling.
//   - one-finger rotate and drag both use one finger: with rotate:
//     one-finger, the hold-to-drag still works (hold first, then move),
//     but a quick swipe rotates.
//
// Generalised from the gestures of the Augmented Bahnhofsviertel works
// (#1–3, #8–10, #14, #21).
export default {
  schema: {
    drag: { type: "boolean", default: true },
    rotate: { type: "string", default: "two-finger", oneOf: ["none", "one-finger", "two-finger"] },
    scale: { type: "boolean", default: true },
    ground: { type: "string", default: "" },
    riseHeight: { type: "number", default: 1 },
    dragDelay: { type: "number", default: 300 },
    rotateFactor: { type: "number", default: 5 },
    minScale: { type: "number", default: 0.33 },
    maxScale: { type: "number", default: 3 }
  },

  update(oldData: any) {
    const self = this as any;
    const d = self.data;
    const old = oldData ?? {};
    const el = self.el;

    if (d.drag) {
      const drag: Record<string, unknown> = { riseHeight: d.riseHeight, dragDelay: d.dragDelay };
      if (d.ground) drag.ground = d.ground;
      el.setAttribute("hold-drag", drag);
    } else {
      el.removeAttribute("hold-drag");
    }

    el.removeAttribute("xrextras-one-finger-rotate");
    el.removeAttribute("xrextras-two-finger-rotate");
    if (d.rotate !== "none") el.setAttribute(`xrextras-${d.rotate}-rotate`, { factor: d.rotateFactor });

    // xrextras-pinch-scale reads its base scale once in init, so it's only
    // re-created when its own settings change (not on every update, which
    // would make the already-pinched size the new base).
    if (d.scale !== old.scale || d.minScale !== old.minScale || d.maxScale !== old.maxScale) {
      el.removeAttribute("xrextras-pinch-scale");
      if (d.scale) el.setAttribute("xrextras-pinch-scale", { min: d.minScale, max: d.maxScale });
    }
  },

  remove() {
    const el = (this as any).el;
    el.removeAttribute("hold-drag");
    el.removeAttribute("xrextras-one-finger-rotate");
    el.removeAttribute("xrextras-two-finger-rotate");
    el.removeAttribute("xrextras-pinch-scale");
  }
} as ComponentDefinition;
