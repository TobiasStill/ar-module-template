import type { ComponentDefinition } from "aframe";

// Makes an entity continuously orbit within an annulus ("band") around a
// center entity — inner/outer radius, slow forward-facing crawl, subtle Y
// floating, and soft avoidance of both the band's edges and other
// `wander-in-band` siblings. Use alongside (not instead of) `trim-loop-clip`:
// this component only ever touches the entity's own `position`/`rotation.y`,
// `trim-loop-clip` only touches the glTF's internal skeleton animation — they
// don't conflict, and everything parented under this entity (the model, its
// `sound` component's audio node) rides along for free.
//
//   <a-entity gltf-model="#Seed1" trim-loop-clip="..."
//             wander-in-band="center: #mainEntity; innerRadius: 3; outerRadius: 7;
//                             floatIntensity: 0.15; speed: 0.3; chaos: 0.5">
//   </a-entity>
//
// All schema values are shared across every entity carrying the component,
// but each instance seeds its own random heading/timing/orbit-direction state
// in init(), so three entities with identical props still wander independently.
//
// Movement model: the baseline heading always follows the *tangent* of the
// circle at the entity's current position — i.e. it behaves like an orbit, so
// "keep turning slightly" and "eventually complete the loop" are automatic
// consequences of ordinary circular motion, not something bolted on. `chaos`
// then adds a randomly-retargeted angular *deviation* from that tangent (both
// how large the deviation can get and how often it changes scale with
// `chaos`), so low chaos traces a clean circle and high chaos lets the entity
// turn sharply on itself and temporarily abandon the orbit. Near the band's
// edges a gentle spiral-back bias is blended in *within a tolerance zone*
// before any hard correction, so drifting past the nominal radius doesn't
// cause a sudden snap-turn. Forward is assumed to be the model's local +Z
// (rotation.y follows the heading directly, plus `yawOffset` — see below).

declare const THREE: any;

// Internal tuning, not exposed on the schema — the user-facing dial for
// "how chaotic" is `chaos`; these just define the range it interpolates over.
const RETARGET_INTERVAL_CALM: [number, number] = [4, 8]; // seconds, chaos = 0
const RETARGET_INTERVAL_WILD: [number, number] = [0.8, 2]; // seconds, chaos = 1
const DEVIATION_DEG_CALM = 4; // max random deviation from the tangent, chaos = 0 (~clean circle)
const DEVIATION_DEG_WILD = 150; // chaos = 1 (can turn sharply on itself)
const HEADING_SMOOTH_RATE = 1; // rad/s-ish exponential approach to target heading
// Speed variation is intentionally subtle and slow (see the class comment) —
// a small range, smoothed over several seconds so pace drifts rather than skips.
const SPEED_VARIATION_WILD = 0.3; // +/- fraction of base speed at chaos = 1
const SPEED_SMOOTH_RATE = 0.15;
// How far past inner/outerRadius the entity may drift before a firm
// correction kicks in, as a fraction of the band's width (min 0.5m).
const TOLERANCE_FRACTION = 0.4;
const BOUNDARY_TURN_RATE = 1.5; // gentle — spirals back in rather than snapping
const SEPARATION_RADIUS = 2; // meters; siblings closer than this repel gently
const SEPARATION_TURN_RATE = 3;
const FLOAT_FREQ = 0.6; // Hz-ish, fixed — floatIntensity controls amplitude only

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export default {
  schema: {
    // Entity the band is centered on (typically the main character).
    center: { type: "selector", default: "" },
    innerRadius: { type: "number", default: 3 },
    outerRadius: { type: "number", default: 7 },
    // Amplitude (meters) of the subtle up/down bobbing around the entity's
    // starting Y (its "ground" height).
    floatIntensity: { type: "number", default: 0.15 },
    // Orbit speed in meters/second.
    speed: { type: "number", default: 0.3 },
    // 0..1 — how much and how often the heading deviates from a clean orbit.
    chaos: { type: "number", default: 0.5, min: 0, max: 1 },
    // Degrees added to the computed heading, in case a model's forward axis
    // isn't +Z — try 180 if it appears to walk backwards.
    yawOffset: { type: "number", default: 0 }
  },

  init() {
    const self = this as any;
    const pos = self.el.object3D.position;

    self.baseY = pos.y;
    self.orbitDir = Math.random() < 0.5 ? 1 : -1;
    self.deviation = 0;
    self.targetDeviation = 0;
    self.speedMul = 1;
    self.targetSpeedMul = 1;
    self.floatPhase = Math.random() * Math.PI * 2;
    self.retargetTimer = Math.random() * 2; // stagger the first retarget per instance
    self.warnedNoCenter = false;

    // Spawn at a random point inside the band rather than trusting whatever
    // static position/rotation was authored in HTML — once this component
    // owns the entity, those become just an initial (now-irrelevant) pose.
    // Heading starts tangent to the circle at that point, so motion is
    // orderly from frame one instead of snapping into an orbit.
    const center = self.data.center?.object3D?.position;
    let spawnAngle = Math.random() * Math.PI * 2;
    if (center) {
      const radius = lerp(self.data.innerRadius, self.data.outerRadius, Math.random());
      pos.x = center.x + Math.sin(spawnAngle) * radius;
      pos.z = center.z + Math.cos(spawnAngle) * radius;
    }
    self.heading = spawnAngle + self.orbitDir * (Math.PI / 2);
  },

  pickNewTarget() {
    const self = this as any;
    const data = self.data;
    const devMaxDeg = lerp(DEVIATION_DEG_CALM, DEVIATION_DEG_WILD, data.chaos);
    self.targetDeviation = THREE.MathUtils.degToRad((Math.random() * 2 - 1) * devMaxDeg);
    self.targetSpeedMul = 1 + (Math.random() * 2 - 1) * data.chaos * SPEED_VARIATION_WILD;

    const [calmMin, calmMax] = RETARGET_INTERVAL_CALM;
    const [wildMin, wildMax] = RETARGET_INTERVAL_WILD;
    const min = lerp(calmMin, wildMin, data.chaos);
    const max = lerp(calmMax, wildMax, data.chaos);
    self.retargetTimer = min + Math.random() * (max - min);
  },

  tick(time: number, timeDelta: number) {
    const self = this as any;
    const data = self.data;
    const dt = Math.min(timeDelta / 1000, 0.1); // clamp to avoid huge jumps after a stall

    const centerObj = data.center?.object3D;
    if (!centerObj) {
      if (!self.warnedNoCenter) {
        console.warn('[wander-in-band] no "center" entity resolved — staying put.', self.el);
        self.warnedNoCenter = true;
      }
      return;
    }
    const center = centerObj.position;
    const pos = self.el.object3D.position;

    // 1. Retarget the chaos deviation + speed multiplier at random intervals.
    self.retargetTimer -= dt;
    if (self.retargetTimer <= 0) self.pickNewTarget();
    self.deviation = lerpAngle(self.deviation, self.targetDeviation, 1 - Math.exp(-HEADING_SMOOTH_RATE * dt));
    self.speedMul = lerp(self.speedMul, self.targetSpeedMul, 1 - Math.exp(-SPEED_SMOOTH_RATE * dt));

    // 2. Baseline heading: tangent to the circle at the current position,
    // rotated consistently by this instance's orbitDir — this alone produces
    // a steady, self-turning orbit even with zero chaos.
    const offX = pos.x - center.x;
    const offZ = pos.z - center.z;
    const dist = Math.hypot(offX, offZ) || 1e-4;
    const outwardAngle = Math.atan2(offX, offZ);
    let tangentAngle = outwardAngle + self.orbitDir * (Math.PI / 2);

    // 3. Soft edge handling: within the tolerance zone beyond inner/outer,
    // bias the tangent itself inward/outward proportionally (a gradual
    // spiral back into the band) rather than overriding the heading outright
    // — nothing sudden happens exactly at the nominal radius.
    const tolerance = Math.max((data.outerRadius - data.innerRadius) * TOLERANCE_FRACTION, 0.5);
    if (dist > data.outerRadius) {
      const bias = THREE.MathUtils.clamp((dist - data.outerRadius) / tolerance, 0, 1);
      tangentAngle = lerpAngle(tangentAngle, outwardAngle + Math.PI, bias * 0.8);
    } else if (dist < data.innerRadius) {
      const bias = THREE.MathUtils.clamp((data.innerRadius - dist) / tolerance, 0, 1);
      tangentAngle = lerpAngle(tangentAngle, outwardAngle, bias * 0.8);
    }

    // 4. Chaos deviation layered on top of the tangent, smoothed toward the
    // combined target heading.
    const targetHeading = tangentAngle + self.deviation;
    self.heading = lerpAngle(self.heading, targetHeading, 1 - Math.exp(-HEADING_SMOOTH_RATE * dt));

    // 5. Soft separation from other wandering siblings (avoid overlap).
    if (!self.siblings) {
      self.siblings = Array.from(self.el.parentEl?.querySelectorAll("[wander-in-band]") ?? [])
        .filter((el: any) => el !== self.el);
    }
    let repelX = 0, repelZ = 0;
    for (const other of self.siblings) {
      const op = (other as any).object3D?.position;
      if (!op) continue;
      const dx = pos.x - op.x, dz = pos.z - op.z;
      const d = Math.hypot(dx, dz);
      if (d > 0 && d < SEPARATION_RADIUS) {
        const w = (SEPARATION_RADIUS - d) / SEPARATION_RADIUS;
        repelX += (dx / d) * w;
        repelZ += (dz / d) * w;
      }
    }
    const repelMag = Math.hypot(repelX, repelZ);
    if (repelMag > 0.01) {
      const awayAngle = Math.atan2(repelX, repelZ);
      self.heading = lerpAngle(self.heading, awayAngle, Math.min(repelMag, 1) * (1 - Math.exp(-SEPARATION_TURN_RATE * dt)));
    }

    // 6. Advance along the (now-steered) heading.
    const step = data.speed * self.speedMul * dt;
    pos.x += Math.sin(self.heading) * step;
    pos.z += Math.cos(self.heading) * step;

    // 7. Hard safety clamp, generous enough to honor the tolerance zone —
    // the soft steering above should keep it well inside this, it's just a
    // guarantee against edge cases (e.g. spawn overlap, a big chaos spike).
    const newOffX = pos.x - center.x;
    const newOffZ = pos.z - center.z;
    const newDist = Math.hypot(newOffX, newOffZ) || 1e-4;
    const hardMin = data.innerRadius - tolerance;
    const hardMax = data.outerRadius + tolerance;
    if (newDist > hardMax || newDist < hardMin) {
      const clamped = THREE.MathUtils.clamp(newDist, hardMin, hardMax);
      const scale = clamped / newDist;
      pos.x = center.x + newOffX * scale;
      pos.z = center.z + newOffZ * scale;
    }

    // 8. Ground-hugging float + facing direction of travel.
    pos.y = self.baseY + Math.sin(time / 1000 * FLOAT_FREQ * Math.PI * 2 + self.floatPhase) * data.floatIntensity;
    self.el.object3D.rotation.y = self.heading + THREE.MathUtils.degToRad(data.yawOffset);
  }
} as ComponentDefinition;
