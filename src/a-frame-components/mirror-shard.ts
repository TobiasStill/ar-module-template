import type { ComponentDefinition } from "aframe";
import shardsData from "./mirror-shard-data/shards.json";
import { createLiquidSampleMaterial } from "./liquid-texture";

declare const THREE: any;

// A field of glass "mirror shards" that ripple/wobble outward from tapped
// points, with a gentle idle sway. One merged draw call for the glass layer
// and one each for the inner illustration layer and the edge/highlight
// outlines — three draw calls total regardless of shard count (112 shards
// in the bundled data), all driven by a per-vertex GPU displacement shader
// so the CPU does no per-shard work after the geometry is built once.
//
// Ported and reworked from Zhichang_module's `dms-mirror-shards` (an
// artistic installation piece authored on another platform, then adapted
// through two other AI assistants into this project) — see
// guides/MIRROR-SHARD-FEATURE-GUIDE.md for exactly what was kept, what was
// dropped, and why. In short: this keeps the tuned impact/idle motion
// shader and the shard geometry, merges what the original left as 112
// separate glass meshes/materials into one, and drops everything that
// duplicated this template's own AR placement (the original shipped its
// own SLAM-based room-anchor system — not needed here; just position this
// entity like any other), plus the multi-panel layout and shatter-and-fall
// "fracture" mode, which the source branch's own real usage never enabled.
//
// The optional inner "liquid" illustration layer is a SEPARATE, generic
// component (see liquid-texture.ts) this one only *samples* via
// `liquidTarget` — it doesn't know anything about how that texture is
// produced, only how to display it (or fall back to a flat tint without
// one).
export default {
  schema: {
    // Overall height (metres) the shard field is scaled to. Position/
    // rotate/scale this entity like any other — there's no separate
    // placement system.
    height: { type: "number", default: 1.86 },
    motionEnabled: { type: "boolean", default: true },
    idleRotationEnabled: { type: "boolean", default: true },
    idleRotationStrength: { type: "number", default: 1 },
    shockAfterglow: { type: "number", default: 1 },
    // Optional entity carrying [liquid-texture] — sampled for the inner
    // illustration layer. Omit for a flat tinted inner layer.
    liquidTarget: { type: "selector" }
  },

  init() {
    const self = this as any;
    self.interactions = [] as { x: number; y: number; strength: number; t: number }[];
    self.motionClockStartMs = performance.now();
    self.lastMotionSeconds = 0;

    self.liquidComponent = self.data.liquidTarget?.components?.["liquid-texture"] ?? null;
    if (self.data.liquidTarget && !self.liquidComponent) {
      console.warn("[mirror-shard] liquidTarget has no [liquid-texture] component; using a flat inner tint instead");
    }

    self.group = buildShardField(shardsData, {
      height: self.data.height,
      idleRotationEnabled: self.data.idleRotationEnabled,
      idleRotationStrength: self.data.idleRotationStrength,
      shockAfterglow: self.data.shockAfterglow,
      liquidTexture: self.liquidComponent?.getTexture() ?? null
    });
    self.el.object3D.add(self.group);

    self.onClick = (e: any) => {
      const point = e?.detail?.intersection?.point;
      if (!point) { self.pulse(); return; }
      const local = self.el.object3D.worldToLocal(point.clone());
      self.pulse(local.x, local.y);
    };
    self.el.addEventListener("click", self.onClick);
  },

  remove() {
    const self = this as any;
    self.el.removeEventListener("click", self.onClick);
    self.el.object3D.remove(self.group);
    disposeShardField(self.group);
  },

  motionTimeSeconds(): number {
    const self = this as any;
    const seconds = (performance.now() - self.motionClockStartMs) / 1000;
    self.lastMotionSeconds = Math.max(self.lastMotionSeconds, seconds);
    return self.lastMotionSeconds;
  },

  tick() {
    const self = this as any;
    const seconds = self.motionTimeSeconds();
    updateMotionUniforms(self.group, self.interactions, seconds, self.data.motionEnabled);
  },

  // Triggers an impact ripple at local (x, y) — omit both for a ripple from
  // this entity's own centre. `strength` scales the ripple's intensity
  // (typical range ~1-2; see BUTTON_RANDOM_MIN/MAX below for the range a
  // plain tap without an explicit strength picks from). If `liquidTarget`
  // is set, also pulses it so the two stay visually coupled.
  pulse(x = 0, y = 0, strength?: number) {
    const self = this as any;
    const s = strength ?? randomButtonStrength();
    const t = self.motionTimeSeconds();
    self.interactions.push({ x, y, strength: s, t });
    self.el.emit("mirror-shard-pulse", { x, y, strength: s }, false);

    if (self.liquidComponent) {
      const dims = self.group.userData.dimensions;
      self.liquidComponent.pulse(
        clamp((x + dims.width * 0.5) / dims.width, 0, 1),
        clamp(y / dims.height, 0, 1),
        s
      );
    }
  }
} as ComponentDefinition;

// ---- module-level helpers -------------------------------------------------

const XR_STRETCH_X = 0.64;
const XR_STRETCH_Y = 1.72;
const INTERACTION_LIFETIME = 2.7;
const MAX_ACTIVE_INTERACTIONS = 3;
const BUTTON_RANDOM_MIN = 1.16;
const BUTTON_RANDOM_MAX = 1.46;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function fract(value: number): number {
  return value - Math.floor(value);
}

// Deterministic per-shard pseudo-random value from its seed — same shard
// always gets the same tint/timing offset across reloads, not re-rolled
// per session.
function stableNoise(seed: number, salt: number): number {
  return fract(Math.sin(seed * 91.721 + salt * 37.111) * 43758.5453);
}

function randomButtonStrength(): number {
  return BUTTON_RANDOM_MIN + Math.random() * (BUTTON_RANDOM_MAX - BUTTON_RANDOM_MIN);
}

function transformPoint(point: [number, number], bounds: any, scale: number): any {
  const centerX = (bounds.minX + bounds.maxX) * 0.5;
  return new THREE.Vector2((point[0] - centerX) * XR_STRETCH_X * scale, (point[1] - bounds.minY) * XR_STRETCH_Y * scale);
}

function makeShardShape(points: any[]): any {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  return shape;
}

function colorForShard(seed: number): any {
  const hueShift = stableNoise(seed, 4) * 0.08;
  const color = new THREE.Color();
  color.setHSL(0.52 + hueShift, 0.28, 0.68 + stableNoise(seed, 5) * 0.07);
  return color;
}

function assignGlobalUv(geometry: any, center: any, dimensions: { width: number; height: number }) {
  const positions = geometry.getAttribute("position");
  const uv = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = center.x + positions.getX(index);
    const y = center.y + positions.getY(index);
    uv.push(clamp((x + dimensions.width * 0.5) / dimensions.width, 0, 1), clamp(y / dimensions.height, 0, 1));
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
}

function assignMotionAttributes(geometry: any, center: any, seed: number) {
  const positions = geometry.getAttribute("position");
  const centers = new Float32Array(positions.count * 2);
  const seeds = new Float32Array(positions.count);
  for (let index = 0; index < positions.count; index += 1) {
    centers[index * 2] = center.x;
    centers[index * 2 + 1] = center.y;
    seeds[index] = seed;
  }
  geometry.setAttribute("shardCenter", new THREE.Float32BufferAttribute(centers, 2));
  geometry.setAttribute("shardSeed", new THREE.Float32BufferAttribute(seeds, 1));
}

// Merges N single-shard geometries (each already carrying position/uv/
// shardCenter/shardSeed[/color]) into one BufferGeometry — one draw call
// for however many shards went in. Mirrors the merge the original
// implementation already did for its inner-illustration/edge/highlight
// layers, extended here to also cover the glass layer per the explicit
// request to merge it (the original left it as one mesh + one cloned
// MeshPhysicalMaterial per shard).
function mergeGeometries(geometries: any[], includeColor: boolean): any {
  const positions: number[] = [];
  const uvs: number[] = [];
  const centers: number[] = [];
  const seeds: number[] = [];
  const colors: number[] = [];

  for (const geometry of geometries) {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    const position = source.getAttribute("position");
    const uv = source.getAttribute("uv");
    const shardCenter = source.getAttribute("shardCenter");
    const shardSeed = source.getAttribute("shardSeed");
    const color = source.getAttribute("color");
    for (let index = 0; index < position.count; index += 1) {
      positions.push(position.getX(index), position.getY(index), position.getZ(index));
      if (uv) uvs.push(uv.getX(index), uv.getY(index));
      if (shardCenter) centers.push(shardCenter.getX(index), shardCenter.getY(index));
      if (shardSeed) seeds.push(shardSeed.getX(index));
      if (includeColor && color) colors.push(color.getX(index), color.getY(index), color.getZ(index));
    }
    if (source !== geometry) source.dispose();
    geometry.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (uvs.length) merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  if (centers.length) merged.setAttribute("shardCenter", new THREE.Float32BufferAttribute(centers, 2));
  if (seeds.length) merged.setAttribute("shardSeed", new THREE.Float32BufferAttribute(seeds, 1));
  if (includeColor && colors.length) merged.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  return merged;
}

function mergeLineSegments(segments: { center: any; seed: number; points: any[] }[]): any {
  const positions: number[] = [];
  const centers: number[] = [];
  const seeds: number[] = [];
  for (const segment of segments) {
    for (let index = 0; index < segment.points.length; index += 1) {
      const a = segment.points[index];
      const b = segment.points[(index + 1) % segment.points.length];
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      centers.push(segment.center.x, segment.center.y, segment.center.x, segment.center.y);
      seeds.push(segment.seed, segment.seed);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("shardCenter", new THREE.Float32BufferAttribute(centers, 2));
  geometry.setAttribute("shardSeed", new THREE.Float32BufferAttribute(seeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function createMotionUniforms(idleRotationEnabled: boolean, idleRotationStrength: number, shockAfterglow: number) {
  return {
    uMotionEnabled: { value: 1 },
    uTime: { value: 0 },
    uHit0: { value: new THREE.Vector4(0, 0, 0, 99) },
    uHit1: { value: new THREE.Vector4(0, 0, 0, 99) },
    uHit2: { value: new THREE.Vector4(0, 0, 0, 99) },
    uShapeBounds: { value: new THREE.Vector4(1, 1.86, 0, 0.93) },
    uIdleRotationEnabled: { value: idleRotationEnabled ? 1 : 0 },
    uIdleRotationStrength: { value: clamp(idleRotationStrength, 0, 2) },
    uShockAfterglow: { value: clamp(shockAfterglow, 0, 2) }
  };
}

function attachMotionToMaterial(material: any, motionUniforms: any, vertexColors: boolean) {
  const previousOnBeforeCompile = material.onBeforeCompile;
  material.onBeforeCompile = function onBeforeCompile(shader: any) {
    if (typeof previousOnBeforeCompile === "function") previousOnBeforeCompile.call(this, shader);
    Object.assign(shader.uniforms, motionUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", `${MOTION_GLSL}\nvoid main() {`)
      .replace("#include <begin_vertex>", "vec3 transformed = shardApplyMotion(position);");
  };
  material.customProgramCacheKey = () => `mirror-shard-motion-${vertexColors ? "vc" : "novc"}`;
  material.needsUpdate = true;
  return material;
}

// Injects the same fresnel-glow rim light onto the glass material's own
// physically-based shading (kept close to the source's fresnel term —
// this part isn't narrative-specific, just "make glass read as glass").
function attachGlassOptics(material: any) {
  const previousOnBeforeCompile = material.onBeforeCompile;
  material.onBeforeCompile = function onBeforeCompile(shader: any) {
    if (typeof previousOnBeforeCompile === "function") previousOnBeforeCompile.call(this, shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <output_fragment>",
      `
        float mirrorFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
        float mirrorFresnel = pow(clamp(1.0 - mirrorFacing, 0.0, 1.0), 2.15);
        float mirrorGrazingLine = smoothstep(0.34, 0.92, mirrorFresnel);
        outgoingLight += vec3(0.48, 0.86, 1.0) * mirrorFresnel * 0.36;
        outgoingLight += vec3(1.0, 1.0, 1.0) * mirrorGrazingLine * 0.18;
        outgoingLight += vec3(0.90, 0.98, 1.0) * 0.020;
        diffuseColor.a *= 0.50 + mirrorFresnel * 0.30;
        #include <output_fragment>
      `
    );
  };
  material.needsUpdate = true;
  return material;
}

function buildShardField(data: any, options: any): any {
  const group = new THREE.Group();
  group.name = "MirrorShardField";

  const height = Number(options.height) || 1.86;
  const bounds = data.bounds;
  const modelHeight = bounds.maxY - bounds.minY;
  const scale = height / (modelHeight * XR_STRETCH_Y);
  const width = (bounds.maxX - bounds.minX) * XR_STRETCH_X * scale;

  const motionUniforms = createMotionUniforms(options.idleRotationEnabled, options.idleRotationStrength, options.shockAfterglow);
  motionUniforms.uShapeBounds.value.set(width, height, 0, height * 0.5);

  const glassGeometries: any[] = [];
  const innerGeometries: any[] = [];
  const edgeSegments: { center: any; seed: number; points: any[] }[] = [];
  const highlightSegments: { center: any; seed: number; points: any[] }[] = [];

  for (const shard of data.shards) {
    const worldPoints = shard.points.map((point: [number, number]) => transformPoint(point, bounds, scale));
    const center = transformPoint(shard.center, bounds, scale);
    const localPoints = worldPoints.map((point: any) => new THREE.Vector2(point.x - center.x, point.y - center.y));
    if (localPoints.length < 3) continue;

    const seed = shard.seed;
    const zBase = shard.depth * 0.035;

    const glassShrink = 0.94 + stableNoise(shard.seed, 14) * 0.016;
    const glassPoints = localPoints.map((point: any) => point.clone().multiplyScalar(glassShrink));
    const glassGeometry = new THREE.ShapeGeometry(makeShardShape(glassPoints));
    glassGeometry.translate(center.x, center.y, zBase);
    assignMotionAttributes(glassGeometry, center, seed);
    assignGlobalUv(glassGeometry, center, { width, height });
    const tint = colorForShard(shard.seed);
    const colorArray = new Float32Array(glassGeometry.getAttribute("position").count * 3);
    for (let i = 0; i < colorArray.length; i += 3) colorArray.set([tint.r, tint.g, tint.b], i);
    glassGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colorArray, 3));
    glassGeometries.push(glassGeometry);

    const innerPoints = localPoints.map((point: any) => point.clone().multiplyScalar(0.93));
    const innerGeometry = new THREE.ShapeGeometry(makeShardShape(innerPoints));
    innerGeometry.translate(center.x, center.y, zBase + 0.003);
    assignMotionAttributes(innerGeometry, center, seed);
    assignGlobalUv(innerGeometry, center, { width, height });
    innerGeometries.push(innerGeometry);

    const edgePoints = glassPoints.map((point: any) => new THREE.Vector3(point.x + center.x, point.y + center.y, zBase + 0.006));
    edgeSegments.push({ center, seed, points: edgePoints });

    const highlightPoints = innerPoints.map((point: any) => new THREE.Vector3(point.x + center.x, point.y + center.y, zBase + 0.008));
    highlightSegments.push({ center, seed, points: highlightPoints });
  }

  // Glass layer — one merged draw call, vertex-colored per shard (replaces
  // the source's 112 individually cloned+tinted MeshPhysicalMaterials).
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness: 0.0,
    roughness: 0.048,
    transparent: true,
    opacity: 0.22,
    transmission: 0.68,
    thickness: 0.06,
    ior: 1.46,
    clearcoat: 1.0,
    clearcoatRoughness: 0.018,
    specularIntensity: 1.45,
    specularColor: new THREE.Color(0xeaffff),
    side: THREE.DoubleSide,
    depthWrite: false,
    emissive: new THREE.Color(0xdffbff),
    emissiveIntensity: 0.008
  });
  attachGlassOptics(glassMaterial);
  attachMotionToMaterial(glassMaterial, motionUniforms, true);
  const glassMesh = new THREE.Mesh(mergeGeometries(glassGeometries, true), glassMaterial);
  glassMesh.name = "MirrorShardField_Glass";
  glassMesh.frustumCulled = false;
  glassMesh.renderOrder = 2;
  group.add(glassMesh);

  // Inner illustration layer — samples liquid-texture's output if given,
  // otherwise a flat tint. Either way, one merged draw call.
  const innerMaterial = options.liquidTexture
    ? attachMotionToMaterial(createLiquidSampleMaterial(options.liquidTexture), motionUniforms, false)
    : attachMotionToMaterial(
        new THREE.MeshBasicMaterial({ color: 0xb7dce6, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
        motionUniforms,
        false
      );
  const innerMesh = new THREE.Mesh(mergeGeometries(innerGeometries, false), innerMaterial);
  innerMesh.name = "MirrorShardField_Inner";
  innerMesh.frustumCulled = false;
  innerMesh.renderOrder = 1;
  group.add(innerMesh);

  const edgeMaterial = attachMotionToMaterial(
    new THREE.LineBasicMaterial({ color: 0x061922, transparent: true, opacity: 0.76 }),
    motionUniforms,
    false
  );
  const edges = new THREE.LineSegments(mergeLineSegments(edgeSegments), edgeMaterial);
  edges.name = "MirrorShardField_Edges";
  edges.frustumCulled = false;
  edges.renderOrder = 3;
  group.add(edges);

  const highlightMaterial = attachMotionToMaterial(
    new THREE.LineBasicMaterial({ color: 0xcdfdff, transparent: true, opacity: 0.66 }),
    motionUniforms,
    false
  );
  const highlights = new THREE.LineSegments(mergeLineSegments(highlightSegments), highlightMaterial);
  highlights.name = "MirrorShardField_Highlights";
  highlights.frustumCulled = false;
  highlights.renderOrder = 4;
  group.add(highlights);

  group.userData.motionUniforms = motionUniforms;
  group.userData.dimensions = { width, height };
  return group;
}

function disposeShardField(group: any) {
  group.traverse((node: any) => {
    node.geometry?.dispose?.();
    node.material?.dispose?.();
  });
}

function updateMotionUniforms(group: any, interactions: any[], seconds: number, motionEnabled: boolean) {
  const uniforms = group.userData.motionUniforms;
  uniforms.uMotionEnabled.value = motionEnabled ? 1 : 0;
  uniforms.uTime.value = seconds;

  const live = interactions.filter((hit) => seconds - hit.t < INTERACTION_LIFETIME).slice(-MAX_ACTIVE_INTERACTIONS);
  interactions.length = 0;
  interactions.push(...live);

  const hitUniforms = [uniforms.uHit0, uniforms.uHit1, uniforms.uHit2];
  for (let index = 0; index < hitUniforms.length; index += 1) {
    const hit = live[index];
    if (!hit) hitUniforms[index].value.set(0, 0, 0, 99);
    else hitUniforms[index].value.set(hit.x, hit.y, hit.strength, Math.max(0, seconds - hit.t));
  }
}

// The impact/idle displacement shader — kept close to the source's tuned
// math (dmsApplyMotion in the original), with the "shards physically
// gather toward one of two political choices" bias term (shapePolarity/
// shapeFinal, driving blueGather/orangeField in the source) removed: that
// mechanic only makes sense paired with the dual-target liquid effect this
// port also dropped. The impact-ripple system (accumulateHit) and the
// idle breathing/sway are untouched.
const MOTION_GLSL = `
  attribute vec2 shardCenter;
  attribute float shardSeed;

  uniform float uMotionEnabled;
  uniform float uTime;
  uniform vec4 uHit0;
  uniform vec4 uHit1;
  uniform vec4 uHit2;
  uniform vec4 uShapeBounds;
  uniform float uIdleRotationEnabled;
  uniform float uIdleRotationStrength;
  uniform float uShockAfterglow;

  void accumulateHit(
    vec4 hit,
    float phase,
    inout float globalWave,
    inout float localKick,
    inout float localSlide,
    inout float localSpin,
    inout vec2 planarImpulse
  ) {
    float age = hit.w;
    float hitActive = uMotionEnabled * step(0.0, age) * step(age, 2.7) * step(0.001, hit.z);
    if (hitActive <= 0.0) return;

    vec2 delta = shardCenter - hit.xy;
    float distSq = dot(delta, delta);
    float dist = sqrt(distSq);
    vec2 impactDir = dist > 0.001 ? delta / dist : vec2(cos(phase), sin(phase));
    float spatialFalloff = 1.0 / (1.0 + dist * 2.3 + distSq * 1.35);

    float waveAge = age - dist * 0.040;
    if (waveAge > 0.0) {
      float timeFalloff = max(0.0, 1.0 - waveAge * 0.52);
      globalWave += sin(waveAge * 10.8 - dist * 4.4) * timeFalloff * timeFalloff * spatialFalloff * hit.z * hitActive;
      planarImpulse += impactDir * sin(waveAge * 12.6 - dist * 5.8) * timeFalloff * timeFalloff * spatialFalloff * hit.z * hitActive;
    }

    float afterAge = age - dist * 0.052;
    if (afterAge > 0.0) {
      float afterFalloff = exp(-afterAge * 1.34) * (1.0 - smoothstep(0.12, 2.45, afterAge));
      float afterWave = sin(afterAge * 5.4 + phase * 0.38 - dist * 2.2) * afterFalloff * spatialFalloff * hit.z * hitActive * uShockAfterglow;
      globalWave += afterWave * 0.38;
      localKick += afterWave * 0.26;
      localSpin += afterWave * 0.20;
      planarImpulse += impactDir * afterWave * 0.30;
    }

    float localAge = age - dist * 0.030;
    if (localAge > 0.0) {
      float localTime = max(0.0, 1.0 - localAge * 1.05);
      float falloff = localTime * localTime * spatialFalloff * hit.z * hitActive;
      localKick += sin(localAge * 18.0 + phase) * falloff;
      localSlide += sin(localAge * 15.5 + phase * 0.73) * falloff;
      localSpin += cos(localAge * 16.5 + phase * 1.31) * falloff;
      planarImpulse += impactDir * sin(localAge * 20.0 + phase * 0.6) * falloff * 0.78;

      float instant = cos(age * 34.0 + shardSeed * 7.0) * max(0.0, 1.0 - age * 0.90) * max(0.0, 1.0 - age * 0.90) * hit.z * spatialFalloff * hitActive;
      globalWave += instant * 0.62;
      localKick += instant * 0.52;
      localSpin += instant * 0.34;
      planarImpulse += impactDir * instant * 0.54;
    }
  }

  vec2 shardRotate2(vec2 value, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(value.x * c - value.y * s, value.x * s + value.y * c);
  }

  vec3 shardApplyMotion(vec3 basePosition) {
    if (uMotionEnabled <= 0.0) return basePosition;

    float phase = shardSeed * 6.28318530718;
    float globalWave = 0.0;
    float localKick = 0.0;
    float localSlide = 0.0;
    float localSpin = 0.0;
    vec2 planarImpulse = vec2(0.0);
    accumulateHit(uHit0, phase, globalWave, localKick, localSlide, localSpin, planarImpulse);
    accumulateHit(uHit1, phase, globalWave, localKick, localSlide, localSpin, planarImpulse);
    accumulateHit(uHit2, phase, globalWave, localKick, localSlide, localSpin, planarImpulse);

    float coherentBreath = sin(uTime * 0.46) * 0.006 + sin(uTime * 0.18 + 1.8) * 0.003;
    float idle = sin(uTime * 0.88 + shardSeed * 24.0) * 0.003 + sin(uTime * 1.37 + shardSeed * 11.0) * 0.0014;
    float normalOffset = globalWave * 0.088 + localKick * 0.052 + coherentBreath + idle;
    vec2 tangent = vec2(cos(phase), sin(phase));
    vec2 boundsSize = max(uShapeBounds.xy, vec2(0.001));
    vec2 boundsCenter = uShapeBounds.zw;
    vec2 shapeFromCenter = shardCenter - boundsCenter;
    vec2 normalizedCenter = vec2(
      shapeFromCenter.x / max(boundsSize.x * 0.5, 0.001),
      shapeFromCenter.y / max(boundsSize.y * 0.5, 0.001)
    );
    float radial = clamp(length(normalizedCenter), 0.0, 1.35);
    vec2 outward = radial > 0.001 ? normalize(shapeFromCenter) : tangent;
    vec2 ambientDrift = (
      tangent * sin(uTime * 0.72 + phase * 1.30) +
      outward * cos(uTime * 0.48 + phase * 0.92)
    ) * (0.014 + 0.004 * sin(phase * 2.1));
    float orderedPhase = normalizedCenter.x * 1.32 + normalizedCenter.y * 0.86;
    float orderedWave = sin(uTime * 0.58 + orderedPhase) + sin(uTime * 0.31 + orderedPhase * 1.7 + 1.1) * 0.42;
    float orderedBreath = uIdleRotationEnabled * clamp(uIdleRotationStrength, 0.0, 2.0) * orderedWave;
    float softSeed = sin(shardSeed * 19.0) * 0.18;

    vec3 moved = basePosition;
    float rx = globalWave * 0.060 + localSpin * 0.155 + coherentBreath * 0.18 + orderedBreath * (0.006 + softSeed * 0.0018);
    float ry = globalWave * 0.034 + localSpin * 0.075 + orderedBreath * (0.0048 - softSeed * 0.0015);
    float rz = localSpin * 0.040 + orderedBreath * 0.0032;

    moved.yz = shardRotate2(moved.yz, rx);
    moved.xz = shardRotate2(moved.xz, ry);
    moved.xy = shardRotate2(moved.xy, rz);
    moved.xy += ambientDrift;
    moved.xy += tangent * localSlide * 0.032 + planarImpulse * 0.040;
    moved.z += normalOffset;
    return moved;
  }
`;
