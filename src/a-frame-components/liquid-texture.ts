import type { ComponentDefinition } from "aframe";

declare const THREE: any;

// A generic, reusable procedural "liquid ink" texture: fbm-driven marbling
// that optionally reveals a target image (attracted toward its dark/ink
// areas, following its edges) as `pulse()` is called, swirling under the
// last pulse point. Rendered once per instance to an offscreen texture any
// material can sample — put it on any entity (a plane, or nothing visible
// at all) and read `getTexture()` from other components, or leave `target`
// unset entirely for a self-contained procedural marbling look with no
// image dependency at all (see QUALITY_PROFILES / the fbm+cell terms below
// — none of them require `target` to produce a result; `uTargetReady`
// simply gates the image-attraction terms to zero without one).
//
// Ported and substantially simplified from Zhichang_module's DMS "liquid
// civic mirror" shader (dms-mirror-shards.ts, DMS_LIQUID_FRAGMENT_SHADER) —
// that original computed TWO competing inks (a hardcoded "democratic blue"
// vs "authoritarian orange" pair, each attracted to its own target image,
// with a "conflict zone" blend between them) as bespoke narrative content
// for one specific installation. This keeps the generic marbling/swirl/
// target-attraction/cellular-bubble machinery — which is a genuinely
// reusable technique — and drops the dual-target "choice" narrative,
// exposing a single target + a 3-stop customizable palette instead.
export default {
  schema: {
    // Optional target image (e.g. an <img> asset) the ink is attracted
    // toward and reveals over time as pulse() is called. Omit for a
    // self-contained procedural marbling look — see the header comment.
    target: { type: "selector" },
    colorLight: { type: "color", default: "#f4fcff" },
    colorMid: { type: "color", default: "#00b7e6" },
    colorDark: { type: "color", default: "#001f66" },
    // 'auto' picks 'balanced' on a probable mobile device, 'high' otherwise
    // — a cheap one-time check, not a per-frame cost.
    quality: { type: "string", default: "auto" },
    opacity: { type: "number", default: 0.88 }
  },

  init() {
    const self = this as any;
    self.qualityProfile = resolveQualityProfile(self.data.quality);
    self.state = { final: 0, targetFinal: 0, pulse: 0, ripple: 0, pointerX: 0.5, pointerY: 0.5, lastUpdateTime: 0 };
    self.motionClockStartMs = performance.now();

    const targetTexture = loadTargetTexture(self.data.target);
    self.renderState = createLiquidRenderTargetState(targetTexture, self.data, self.qualityProfile);

    self.onClick = (e: any) => {
      const point = e?.detail?.intersection?.point;
      if (!point) { self.pulse(); return; }
      const local = self.el.object3D.worldToLocal(point.clone());
      self.pulse(local.x + 0.5, local.y + 0.5);
    };
    self.el.addEventListener("click", self.onClick);
  },

  update(oldData: any) {
    const self = this as any;
    if (!oldData) return;
    const uniforms = self.renderState?.uniforms;
    if (!uniforms) return;
    if (self.data.colorLight !== oldData.colorLight) uniforms.uColorLight.value.set(self.data.colorLight);
    if (self.data.colorMid !== oldData.colorMid) uniforms.uColorMid.value.set(self.data.colorMid);
    if (self.data.colorDark !== oldData.colorDark) uniforms.uColorDark.value.set(self.data.colorDark);
    if (self.data.opacity !== oldData.opacity) uniforms.uMaterialOpacity.value = self.data.opacity;
  },

  remove() {
    const self = this as any;
    self.el.removeEventListener("click", self.onClick);
    self.renderState?.geometry?.dispose();
    self.renderState?.material?.dispose();
    self.renderState?.target?.dispose();
  },

  tick() {
    const self = this as any;
    const seconds = (performance.now() - self.motionClockStartMs) / 1000;
    updateLiquidState(self.state, seconds);
    const uniforms = self.renderState.uniforms;
    uniforms.uTime.value = seconds;
    uniforms.uFinal.value = self.state.final;
    uniforms.uPulse.value = self.state.pulse;
    uniforms.uRipple.value = self.state.ripple;
    uniforms.uPointer.value.set(self.state.pointerX, self.state.pointerY);

    // Bracketed save/restore around the shared renderer's render-target and
    // WebXR state — this offscreen pass borrows the SAME renderer every
    // other module/component in the scene draws with (see
    // guides/LIQUID-TEXTURE-FEATURE-GUIDE.md's incompatibilities section for why
    // this specific pattern, inherited from the source branch, is kept
    // rather than assumed safe to simplify away).
    const renderer = self.el.sceneEl?.renderer;
    renderLiquidRenderTarget(renderer, self.renderState, seconds);
  },

  // Nudges the ink toward fully revealed and swirls it from (x, y) — both
  // in normalized 0..1 texture space (0.5, 0.5 is the centre). Omit both to
  // pulse from the centre. `strength` scales how much this single pulse
  // moves the needle (typical range ~0.25-2).
  pulse(x = 0.5, y = 0.5, strength = 1) {
    const self = this as any;
    const s = clamp(Number(strength) || 1, 0.25, 2);
    self.state.pointerX = clamp(Number(x), 0, 1);
    self.state.pointerY = clamp(Number(y), 0, 1);
    self.state.ripple = Math.min(2.15, self.state.ripple + 0.82 * s);
    self.state.pulse = Math.max(self.state.pulse, 0.58 * s);
    self.state.targetFinal = clamp(self.state.targetFinal + s * 0.018, 0, 1);
  },

  // Fades the revealed ink back to nothing and clears any in-flight ripple.
  reset() {
    const self = this as any;
    Object.assign(self.state, { final: 0, targetFinal: 0, pulse: 0, ripple: 0, pointerX: 0.5, pointerY: 0.5 });
  },

  getTexture() {
    return (this as any).renderState?.target?.texture ?? null;
  }
} as ComponentDefinition;

// ---- module-level helpers -------------------------------------------------

const QUALITY_PROFILES: Record<string, any> = {
  high: { fbmSteps: 6, cellCount: 14, targetHeight: 1024, fps: 60, colorBoost: 0.18, alphaBoost: 1.06 },
  balanced: { fbmSteps: 4, cellCount: 10, targetHeight: 768, fps: 45, colorBoost: 0.35, alphaBoost: 1.18 },
  low: { fbmSteps: 3, cellCount: 7, targetHeight: 512, fps: 30, colorBoost: 0.35, alphaBoost: 1.18 }
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isProbablyMobileDevice(): boolean {
  const ua = String((navigator as any)?.userAgent || "");
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

function resolveQualityProfile(value: string): any {
  if (QUALITY_PROFILES[value]) return QUALITY_PROFILES[value];
  return isProbablyMobileDevice() ? QUALITY_PROFILES.balanced : QUALITY_PROFILES.high;
}

function loadTargetTexture(imgEl: any): any {
  if (!imgEl) return null;
  const texture = new THREE.Texture(imgEl);
  texture.needsUpdate = true;
  if ("colorSpace" in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function updateLiquidState(state: any, seconds: number) {
  const previous = Number(state.lastUpdateTime) || seconds;
  const dt = clamp(seconds - previous, 0, 0.08);
  state.lastUpdateTime = seconds;
  const frameScale = dt * 60;
  state.final += (state.targetFinal - state.final) * (1 - Math.pow(0.982, frameScale));
  state.pulse *= Math.pow(0.965, frameScale);
  state.ripple *= Math.pow(0.952, frameScale);
}

function createLiquidRenderTargetState(targetTexture: any, data: any, qualityProfile: any) {
  const height = Math.max(256, Math.round(qualityProfile.targetHeight));
  const width = height; // square render target; consuming UVs are square (vUv 0..1) regardless of the target image's own aspect
  const target = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false
  });
  target.texture.name = "LiquidTexture";
  target.texture.generateMipmaps = false;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const uniforms = {
    uResolution: { value: new THREE.Vector2(width, height) },
    uTime: { value: 0 },
    uFinal: { value: 0 },
    uPulse: { value: 0 },
    uRipple: { value: 0 },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uTargetReady: { value: 0 },
    uMaterialOpacity: { value: data.opacity },
    uColorBoost: { value: qualityProfile.colorBoost },
    uAlphaBoost: { value: qualityProfile.alphaBoost },
    uTarget: { value: targetTexture },
    uColorLight: { value: new THREE.Color(data.colorLight) },
    uColorMid: { value: new THREE.Color(data.colorMid) },
    uColorDark: { value: new THREE.Color(data.colorDark) }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    defines: { LIQUID_FBM_STEPS: qualityProfile.fbmSteps, LIQUID_CELL_COUNT: qualityProfile.cellCount },
    vertexShader: LIQUID_VERTEX_SHADER,
    fragmentShader: LIQUID_FRAGMENT_SHADER,
    transparent: false,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  return {
    target, scene, camera, geometry, material, uniforms,
    frameInterval: 1 / Math.max(1, qualityProfile.fps),
    lastRender: -Infinity,
    renderedOnce: false
  };
}

function renderLiquidRenderTarget(renderer: any, state: any, seconds: number) {
  if (!renderer) return;

  const targetTexture = state.uniforms.uTarget.value;
  const ready = Boolean(targetTexture?.image && targetTexture.image.width);
  if (state.uniforms.uTargetReady.value !== (ready ? 1 : 0)) {
    state.uniforms.uTargetReady.value = ready ? 1 : 0;
    state.renderedOnce = false;
  }
  if (state.renderedOnce && seconds - state.lastRender < state.frameInterval) return;

  const previousTarget = renderer.getRenderTarget?.() || null;
  const previousXrEnabled = renderer.xr ? renderer.xr.enabled : null;
  const previousAutoClear = renderer.autoClear;

  if (renderer.xr) renderer.xr.enabled = false;
  renderer.autoClear = true;
  renderer.setRenderTarget(state.target);
  renderer.clear(true, true, true);
  renderer.render(state.scene, state.camera);
  state.lastRender = seconds;
  state.renderedOnce = true;

  renderer.setRenderTarget(previousTarget);
  renderer.autoClear = previousAutoClear;
  if (renderer.xr && previousXrEnabled !== null) renderer.xr.enabled = previousXrEnabled;
}

const LIQUID_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Tone-mapping/highlight-compression sampler for any consumer material that
// wants to display this component's rendered texture (see getTexture()) —
// exported so other components (e.g. mirror-shard.ts) can build their own
// material around it rather than re-deriving this.
export const LIQUID_SAMPLE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uLiquidTexture;
  uniform float uTextureOpacity;
  uniform float uTextureExposure;
  uniform float uTextureHighlightLimit;

  void main() {
    vec4 texel = texture2D(uLiquidTexture, vUv);
    vec3 color = clamp(texel.rgb * uTextureExposure, 0.0, 1.0);
    color = mix(color, sqrt(max(color, vec3(0.0))), 0.08);
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    float highlight = smoothstep(uTextureHighlightLimit * 0.82, 1.0, luma);
    float compressedLuma = mix(
      luma,
      uTextureHighlightLimit + max(luma - uTextureHighlightLimit, 0.0) * 0.14,
      highlight
    );
    color *= compressedLuma / max(luma, 0.001);
    gl_FragColor = vec4(color, texel.a * uTextureOpacity);
  }
`;

export function createLiquidSampleMaterial(texture: any): any {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLiquidTexture: { value: texture },
      uTextureOpacity: { value: 1.0 },
      uTextureExposure: { value: 1.08 },
      uTextureHighlightLimit: { value: 0.82 }
    },
    vertexShader: LIQUID_VERTEX_SHADER,
    fragmentShader: LIQUID_SAMPLE_FRAGMENT_SHADER,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });
}

const LIQUID_FRAGMENT_SHADER = `
  precision highp float;

  #ifndef LIQUID_FBM_STEPS
  #define LIQUID_FBM_STEPS 5
  #endif
  #ifndef LIQUID_CELL_COUNT
  #define LIQUID_CELL_COUNT 12
  #endif

  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uFinal;
  uniform float uPulse;
  uniform float uRipple;
  uniform vec2 uPointer;
  uniform float uTargetReady;
  uniform float uMaterialOpacity;
  uniform float uColorBoost;
  uniform float uAlphaBoost;
  uniform sampler2D uTarget;
  uniform vec3 uColorLight;
  uniform vec3 uColorMid;
  uniform vec3 uColorDark;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    mat2 m = mat2(1.62, 1.18, -1.18, 1.62);
    for (int i = 0; i < LIQUID_FBM_STEPS; i++) {
      value += amp * noise(p);
      p = m * p + 0.17;
      amp *= 0.52;
    }
    return value;
  }

  mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  vec2 swirl(vec2 p, vec2 center, float strength, float radius) {
    vec2 d = p - center;
    float falloff = exp(-dot(d, d) / radius);
    return center + rot(strength * falloff) * d;
  }

  vec3 palette(float x) {
    vec3 col = mix(uColorLight, uColorMid, smoothstep(0.10, 0.55, x));
    col = mix(col, uColorDark, smoothstep(0.50, 0.95, x));
    return col;
  }

  vec3 pigmentBoost(vec3 value, float saturation, float contrast) {
    float luma = dot(value, vec3(0.299, 0.587, 0.114));
    vec3 saturated = mix(vec3(luma), value, saturation);
    return clamp((saturated - 0.5) * contrast + 0.5, 0.0, 1.0);
  }

  float cellRing(vec2 uv, vec2 c, float r, float aspect) {
    vec2 d = uv - c;
    d.x *= aspect;
    float dist = length(d);
    float outer = smoothstep(r + 0.012, r - 0.006, dist);
    float inner = smoothstep(r * 0.72, r * 0.48, dist);
    return clamp(outer - inner, 0.0, 1.0);
  }

  float cellFill(vec2 uv, vec2 c, float r, float aspect) {
    vec2 d = uv - c;
    d.x *= aspect;
    float dist = length(d);
    return smoothstep(r * 0.7, 0.0, dist);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    float t = uTime * 0.115;
    float finalAmount = smoothstep(0.08, 1.0, uFinal);

    vec2 texel = 1.0 / max(uResolution, vec2(1.0));
    vec2 targetDrift = finalAmount * 0.018 * vec2(
      fbm(uv * 3.2 + vec2(t * 1.7, -t * 1.1)),
      fbm(uv * 3.0 + vec2(-t * 1.2, t * 1.6) + 5.0)
    );
    vec2 refUv = clamp(uv + targetDrift - finalAmount * 0.009, 0.0, 1.0);
    vec3 ref = texture2D(uTarget, refUv).rgb;
    float refLuma = dot(ref, vec3(0.299, 0.587, 0.114));
    float refInk = (1.0 - refLuma) * uTargetReady;
    vec2 softStep = texel * vec2(24.0, 24.0);
    vec3 refSoft = (
      ref
      + texture2D(uTarget, clamp(refUv + vec2(softStep.x, 0.0), 0.0, 1.0)).rgb
      + texture2D(uTarget, clamp(refUv - vec2(softStep.x, 0.0), 0.0, 1.0)).rgb
      + texture2D(uTarget, clamp(refUv + vec2(0.0, softStep.y), 0.0, 1.0)).rgb
      + texture2D(uTarget, clamp(refUv - vec2(0.0, softStep.y), 0.0, 1.0)).rgb
    ) * 0.2;
    float softInk = (1.0 - dot(refSoft, vec3(0.299, 0.587, 0.114))) * uTargetReady;
    float refL = dot(texture2D(uTarget, clamp(refUv - vec2(texel.x * 2.6, 0.0), 0.0, 1.0)).rgb, vec3(0.299, 0.587, 0.114));
    float refR = dot(texture2D(uTarget, clamp(refUv + vec2(texel.x * 2.6, 0.0), 0.0, 1.0)).rgb, vec3(0.299, 0.587, 0.114));
    float refD = dot(texture2D(uTarget, clamp(refUv - vec2(0.0, texel.y * 2.6), 0.0, 1.0)).rgb, vec3(0.299, 0.587, 0.114));
    float refU = dot(texture2D(uTarget, clamp(refUv + vec2(0.0, texel.y * 2.6), 0.0, 1.0)).rgb, vec3(0.299, 0.587, 0.114));
    vec2 refGradient = vec2(refL - refR, refD - refU) * uTargetReady;
    float refEdge = smoothstep(0.024, 0.16, length(refGradient));

    vec2 p = uv - 0.5;
    p.x *= aspect;
    float attraction = smoothstep(0.02, 0.92, uFinal);
    p += vec2(refGradient.x * 0.82, refGradient.y * 0.56) * attraction;
    p += attraction * (softInk - 0.24) * vec2(0.045 * sin(t * 2.2), 0.035 * cos(t * 1.8));

    vec2 pointerP = uPointer - 0.5;
    pointerP.x *= aspect;
    vec2 pointerDelta = p - pointerP;
    float pointerDist = length(pointerDelta);
    vec2 pointerDir = pointerDist > 0.001 ? pointerDelta / pointerDist : vec2(0.0, 1.0);
    float pointerFalloff = exp(-dot(pointerDelta, pointerDelta) / 0.052);
    float liquidShock = sin(pointerDist * 34.0 - uTime * 8.2 + uPulse * 1.6) *
      exp(-pointerDist * 5.6) *
      uRipple;
    p = swirl(p, pointerP, uRipple * (1.65 + uFinal * 0.55), 0.082);
    p += pointerDir * liquidShock * 0.034;
    p += uRipple * pointerFalloff * 0.048 * vec2(
      sin(t * 18.0 + p.y * 22.0),
      cos(t * 16.0 + p.x * 20.0)
    );
    p = swirl(p, vec2(-0.18, 0.08), 1.4 + uPulse * 0.34, 0.18);
    p = swirl(p, vec2(0.24, -0.24), -1.15 - uPulse * 0.20, 0.13);

    vec2 slow = vec2(t * 0.38, -t * 0.24);
    vec2 q = p;
    q += 0.23 * vec2(
      fbm(p * 2.1 + slow + vec2(2.4, 0.1)),
      fbm(p * 2.0 - slow + vec2(5.7, 8.2))
    );
    q += attraction * vec2(refGradient.x * 0.44, refGradient.y * 0.38) * (0.4 + 0.6 * fbm(p * 2.8 + t));
    q += liquidShock * 0.030 * vec2(
      sin(pointerDist * 18.0 + t * 22.0),
      cos(pointerDist * 16.0 - t * 20.0)
    );
    q += 0.11 * vec2(
      sin((p.y + fbm(p * 3.0)) * 6.0 + t * 3.0),
      cos((p.x - fbm(p * 2.4)) * 5.4 - t * 2.0)
    );

    vec2 r = q;
    r += 0.30 * vec2(fbm(q * 3.0 + t), fbm(q * 3.2 - t * 0.8 + 4.0));
    r += attraction * vec2(refGradient.x * 0.34, refGradient.y * 0.28) * (0.35 + 0.65 * softInk);

    float pourA = 0.5 + 0.5 * sin((r.x * 9.8 + r.y * 4.2) + fbm(r * 4.0 + t) * 7.2 + t * 3.2);
    float pourB = 0.5 + 0.5 * sin((r.x * -5.6 + r.y * 10.8) + fbm(r * 6.4 - t) * 5.4 - t * 2.5);
    float marble = mix(pourA, pourB, 0.36 + 0.22 * sin(t * 1.3));
    float body = smoothstep(0.30, 0.86, marble);

    float veinBase = abs(sin((q.x * 18.0 + q.y * 9.0) + fbm(q * 7.0 + 2.0) * 8.0 + t * 2.4));
    float darkVein = smoothstep(0.018, 0.0, veinBase) * (0.45 + 0.55 * fbm(q * 11.0));
    float whiteVein = smoothstep(0.075, 0.0, abs(sin((q.x * 12.0 - q.y * 7.0) + fbm(q * 5.0) * 6.0 - t * 1.5)));
    float wash = fbm(q * 1.4 + vec2(-t * 0.8, t * 0.52));
    float paperPool = smoothstep(0.36, 0.72, wash);

    float cells = 0.0;
    float fills = 0.0;
    for (int i = 0; i < LIQUID_CELL_COUNT; i++) {
      float fi = float(i);
      float seedA = hash(vec2(fi * 2.11, 4.7));
      float seedB = hash(vec2(9.1, fi * 3.03));
      float seedC = hash(vec2(fi * 5.2, 1.6));
      float cycle = fract(uTime * (0.030 + seedC * 0.020) + hash(vec2(fi * 1.37, 7.7)));
      float birth = smoothstep(0.02, 0.18, cycle);
      float fade = 1.0 - smoothstep(0.70, 0.98, cycle);
      float cellLife = birth * fade;
      float breath = 0.5 + 0.5 * sin(uTime * (0.62 + seedA * 0.58) + fi * 2.41);
      float breathSize = 0.72 + 0.50 * breath + 0.20 * cellLife;
      vec2 c = vec2(0.10 + 0.80 * seedA, 0.08 + 0.84 * seedB);
      c += vec2(
        sin(uTime * (0.18 + seedA * 0.10) + fi * 1.8),
        cos(uTime * (0.16 + seedB * 0.11) + fi * 1.3)
      ) * (0.046 + 0.020 * breath);
      c += vec2(
        fbm(vec2(fi * 0.31, uTime * 0.13 + seedA * 4.0)) - 0.5,
        fbm(vec2(uTime * 0.12 + seedB * 5.0, fi * 0.27)) - 0.5
      ) * 0.034;
      float rr = (0.022 + 0.058 * seedC) * breathSize;
      float local = (0.42 + 0.58 * smoothstep(0.1, 0.95, fbm((uv - c) * 5.0 + fi))) * (0.18 + 0.82 * cellLife);
      float halo = smoothstep(rr * 2.25, rr * 0.74, length((uv - c) * vec2(aspect, 1.0))) *
        (1.0 - smoothstep(rr * 0.72, rr * 0.20, length((uv - c) * vec2(aspect, 1.0))));
      cells += (cellRing(uv, c, rr, aspect) + halo * 0.22) * local;
      fills += cellFill(uv, c, rr * (0.66 + 0.26 * breath), aspect) *
        (0.28 + 0.58 * hash(vec2(fi, 8.0))) * cellLife * (0.70 + 0.30 * breath);
    }
    cells = clamp(cells, 0.0, 1.0);
    fills = clamp(fills, 0.0, 1.0);

    float grain = hash(uv * uResolution.xy + floor(uTime * 24.0));
    float vignette = smoothstep(0.88, 0.18, length((uv - 0.5) * vec2(0.86, 1.0)));
    float broadShape = smoothstep(0.05, 0.64, softInk);
    float detailShape = smoothstep(0.16, 0.72, refInk);
    float flowingEdge = refEdge * (0.48 + 0.52 * smoothstep(0.22, 0.92, body + darkVein));
    float structure = clamp(broadShape * 0.82 + detailShape * 0.34 + flowingEdge * 0.42, 0.0, 1.0);
    float liquidMemory = clamp(body * 0.72 + darkVein * 0.42 + cells * 0.18 - paperPool * 0.14, 0.0, 1.0);
    float organicReveal = smoothstep(0.10, 0.92, uFinal + fbm(uv * 2.2 + t) * 0.16 - length(uv - vec2(0.48, 0.52)) * 0.08);
    float morph = finalAmount * organicReveal;
    float visibleBroad = broadShape * morph;
    float visibleEdge = flowingEdge * morph;

    float floatingDensity = clamp(liquidMemory * 0.62 + darkVein * 0.24 + cells * 0.08, 0.0, 1.0);
    float unifiedDensity = clamp(
      mix(liquidMemory, structure * (0.72 + liquidMemory * 0.22) + liquidMemory * 0.34, morph)
      + darkVein * (0.18 + 0.12 * morph)
      + cells * (0.10 - 0.04 * morph)
      + whiteVein * 0.06,
      0.0,
      1.0
    );
    float density = mix(floatingDensity, unifiedDensity, finalAmount);

    vec3 color = palette(density);
    vec3 paleTone = mix(uColorLight, mix(uColorLight, uColorMid, 0.4), visibleBroad * 0.86);
    color = mix(color, paleTone, paperPool * (0.20 + morph * 0.08));
    color = mix(color, mix(uColorLight, uColorMid, density), cells * 0.5);
    color = mix(color, uColorDark, darkVein * (0.46 + morph * 0.14));
    color = mix(color, uColorLight, (whiteVein * 0.28 + fills * 0.10) * (0.42 + morph * 0.06));
    color = pigmentBoost(color, 1.2, 1.05);

    float presence = clamp(density * 0.55 + visibleBroad * 0.22 + cells * 0.10 + darkVein * 0.10, 0.0, 1.0);
    float densityBoost = clamp(uColorBoost, 0.0, 0.80);
    vec3 denserColor = pigmentBoost(color, 1.0 + densityBoost * 0.82, 1.0 + densityBoost * 0.24);
    denserColor *= 1.0 + densityBoost * 0.16 * presence;
    color = mix(color, clamp(denserColor, 0.0, 1.0), presence);
    color += (grain - 0.5) * (0.020 + presence * 0.030);
    color = mix(mix(uColorLight, uColorMid, 0.05), color, clamp(0.92 + vignette * 0.08, 0.0, 1.0));

    float paintAlpha = mix(0.46, 0.96, smoothstep(0.08, 0.72, presence));
    paintAlpha = clamp(paintAlpha * max(uAlphaBoost, 0.25), 0.0, 0.985);
    gl_FragColor = vec4(color, paintAlpha * uMaterialOpacity);
  }
`;
