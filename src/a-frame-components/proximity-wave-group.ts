import type { ComponentDefinition } from "aframe";

// Applies [proximity-wave] with ONE shared set of parameters to every direct
// child of this entity, so a whole group only needs tuning once instead of
// per-child. Works on any plain group of entities you've authored yourself,
// or on an entity that also carries [random-field] (its dynamically-created
// clones are direct children too, by the time this runs — see below) — put
// both components on the same entity:
//
//   <a-entity random-field="items: #propA; ..." proximity-wave-group="waveNear: 2; waveFar: 5; ..."></a-entity>
//
// A child that already has its own [proximity-wave] attribute is left
// alone — this only fills in children that don't have one, so a group-wide
// default and a per-child override can coexist.
//
// Children are scanned lazily on the first tick() rather than in init(),
// specifically so this works regardless of whether [random-field] (if
// present on the same entity) has finished creating its clones yet by the
// time this component's own init() runs — by the first tick, every
// same-frame synchronous DOM work is done (same pattern wander-in-band.ts
// uses for its own sibling scan). This does mean children added well after
// the first tick (e.g. from other dynamic scene changes) won't be picked up
// automatically — re-set this component's own attribute (e.g. to the same
// value) to force a re-scan if you add children later.
export default {
  schema: {
    waveNear: { type: "number", default: 2 },
    waveFar: { type: "number", default: 5 },
    waveIntensity: { type: "number", default: 20 },
    waveSpeed: { type: "number", default: 3 },
    pivotY: { type: "number", default: 0 },
    idleRadius: { type: "number", default: 0.02 }
  },

  init() {
    const self = this as any;
    self.applied = false;
  },

  update() {
    // A schema change re-applies to every current child (including ones
    // already carrying proximity-wave from a previous application of this
    // same group, since applyToChildren always overwrites what it itself
    // last set — see the ownership guard below).
    (this as any).applied = false;
  },

  tick() {
    const self = this as any;
    if (self.applied) return;
    self.applyToChildren();
    self.applied = true;
  },

  applyToChildren() {
    const self = this as any;
    const data = self.data;
    const params = {
      waveNear: data.waveNear,
      waveFar: data.waveFar,
      waveIntensity: data.waveIntensity,
      waveSpeed: data.waveSpeed,
      pivotY: data.pivotY,
      idleRadius: data.idleRadius
    };

    for (const child of Array.from(self.el.children) as any[]) {
      const ownedByUs = child.dataset && child.dataset.proximityWaveGroupOwned === "true";
      const hasOwn = child.hasAttribute("proximity-wave") && !ownedByUs;
      if (hasOwn) continue; // don't clobber a manually-authored per-child config

      child.setAttribute("proximity-wave", params);
      if (child.dataset) child.dataset.proximityWaveGroupOwned = "true";
    }
  }
} as ComponentDefinition;
