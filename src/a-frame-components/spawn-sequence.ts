import type { ComponentDefinition } from "aframe";

declare const THREE: any;

// Spawns models one after another — at an interval or at given times — in
// front of the camera or at random spots around the entity, each springing
// up from nothing (elastic "bounce"), optionally with its own one-shot
// positional sound.
//
//   <a-entity spawn-sequence="models: #slat1, #slat2; interval: 1000; count: 40;
//                             distance: 4; variation: 0.5; facing: camera"></a-entity>
//   <a-entity spawn-sequence="models: #a, #b; times: 0, 4, 6.5, 12; sounds: #s1, #s2;
//                             facing: random; scaleMin: 0.5; scaleMax: 1.2"></a-entity>
//   <a-entity spawn-sequence="models: #stone; mode: random; radius: 3; count: 10; interval: 500"></a-entity>
//
// Spawned models become children of this entity (positions in its local
// space, so it works inside any transformed parent, e.g. a place-in-front
// scene); they sit on its y = 0 plane unless `floor: false`.
//
// Timing: `times` (seconds after start) if given, else every `interval` ms
// after an initial `delay`, `count` times (0 = endless with interval).
// Starts on init (`auto`) or on the `spawn-sequence-start` event;
// `spawn-sequence-stop` stops it, `spawn-sequence-clear` removes everything
// spawned so far. Inside a not-yet-placed place-in-front scene the clock
// waits for the placement. Emits `spawn-sequence-spawned` ({ el, index })
// per model and `spawn-sequence-done` at the end.
//
// Position: `mode: camera` — `distance` ± `variation`/2 along the camera's
// view direction (pitch included, so looking down spawns closer), seen from
// this entity; `mode: random` — anywhere within `radius` of the entity's
// origin. Facing: `camera` (turned towards the viewer), `random`, `none`.
// Scale: random between scaleMin and scaleMax (equal = fixed), grown from
// ~0 within `growDuration` ms with `easing`.
//
// Sounds: each spawned model can play `sounds[i % sounds.length]` once
// (positional). Its distances are multiplied by this entity's world scale,
// so they stay proportional inside a scaled scene. Audio needs a user
// gesture first on iOS — start the sequence from a tap (e.g. an
// ArOverlay "Start" control) if it has sounds.
//
// Generalised from two Augmented Bahnhofsviertel ports (augmented-
// bahnhofsviertel): #4 Europaplatz II's distance-place-interval (slats every
// second, facing the camera) and #6 Birdkin(d)'s distance-place-sequence
// (membranes on a timeline, random heading/size, one sound each) — the same
// logic with different timing, facing and scale rules, so one component.
export default {
  schema: {
    models: { type: "array", default: [] },
    order: { default: "sequential", oneOf: ["sequential", "random"] },
    interval: { type: "number", default: 1000 },
    delay: { type: "number", default: 0 },
    times: { type: "array", default: [] },
    count: { type: "int", default: 10 },
    auto: { type: "boolean", default: true },
    mode: { default: "camera", oneOf: ["camera", "random"] },
    distance: { type: "number", default: 3 },
    variation: { type: "number", default: 0.5 },
    radius: { type: "number", default: 3 },
    floor: { type: "boolean", default: true },
    facing: { default: "camera", oneOf: ["camera", "random", "none"] },
    scaleMin: { type: "number", default: 1 },
    scaleMax: { type: "number", default: 1 },
    growDuration: { type: "number", default: 750 },
    easing: { type: "string", default: "easeOutElastic" },
    castShadow: { type: "boolean", default: true },
    receiveShadow: { type: "boolean", default: false },
    sounds: { type: "array", default: [] },
    volume: { type: "number", default: 1 },
    refDistance: { type: "number", default: 1 },
    maxDistance: { type: "number", default: 10000 },
    rolloffFactor: { type: "number", default: 1 },
    distanceModel: { default: "inverse", oneOf: ["linear", "inverse", "exponential"] }
  },

  init() {
    const self = this as any;
    self.running = false;
    self.elapsed = 0;
    self.spawned = [];
    self.index = 0;
    self.camPos = new THREE.Vector3();
    self.camDir = new THREE.Vector3();
    self.invQuat = new THREE.Quaternion();
    self.onStart = () => self.start();
    self.onStop = () => self.stop();
    self.onClear = () => self.clear();
    self.el.addEventListener("spawn-sequence-start", self.onStart);
    self.el.addEventListener("spawn-sequence-stop", self.onStop);
    self.el.addEventListener("spawn-sequence-clear", self.onClear);
    if (self.data.auto) self.start();
  },

  start() {
    const self = this as any;
    self.running = true;
    self.elapsed = 0;
    self.index = 0;
  },

  stop() {
    (this as any).running = false;
  },

  clear() {
    const self = this as any;
    self.spawned.forEach((el: any) => el.parentNode?.removeChild(el));
    self.spawned = [];
  },

  // Seconds-after-start of spawn number i, or null when the sequence is over.
  timeOf(i: number): number | null {
    const d = (this as any).data;
    if (d.times.length) {
      if (i >= d.times.length) return null;
      return parseFloat(String(d.times[i]).trim()) * 1000;
    }
    if (d.count > 0 && i >= d.count) return null;
    return d.delay + i * d.interval;
  },

  tick(_time: number, delta: number) {
    const self = this as any;
    if (!self.running) return;
    const placer = self.el.closest("[place-in-front]") as any;
    if (placer && !placer.components["place-in-front"]?.placed) return;
    self.elapsed += delta || 0;
    let next = self.timeOf(self.index);
    while (next !== null && self.elapsed >= next) {
      self.spawn(self.index);
      self.index++;
      next = self.timeOf(self.index);
    }
    if (next === null) {
      self.running = false;
      self.el.emit("spawn-sequence-done", null, false);
    }
  },

  spawn(i: number) {
    const self = this as any;
    const d = self.data;
    const camera = self.el.sceneEl.camera;
    if (!d.models.length || !camera) return;
    const obj = self.el.object3D;
    obj.updateMatrixWorld();
    camera.getWorldPosition(self.camPos);
    obj.worldToLocal(self.camPos);

    let x: number;
    let y = 0;
    let z: number;
    if (d.mode === "random") {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * d.radius;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    } else {
      camera.getWorldDirection(self.camDir);
      obj.getWorldQuaternion(self.invQuat).invert();
      self.camDir.applyQuaternion(self.invQuat).normalize();
      const dist = d.distance + (Math.random() - 0.5) * d.variation;
      x = self.camPos.x + self.camDir.x * dist;
      z = self.camPos.z + self.camDir.z * dist;
      if (!d.floor) y = self.camPos.y + self.camDir.y * dist;
    }

    let heading = 0;
    if (d.facing === "camera") heading = Math.atan2(self.camPos.x - x, self.camPos.z - z) * 180 / Math.PI;
    else if (d.facing === "random") heading = Math.random() * 360;
    const s = d.scaleMin + Math.random() * (d.scaleMax - d.scaleMin);

    const model = d.order === "random"
      ? d.models[Math.floor(Math.random() * d.models.length)]
      : d.models[i % d.models.length];
    const el = document.createElement("a-entity");
    el.setAttribute("gltf-model", String(model).trim());
    el.setAttribute("position", `${x} ${y} ${z}`);
    el.setAttribute("rotation", `0 ${heading} 0`);
    el.setAttribute("scale", "0.001 0.001 0.001");
    el.setAttribute("shadow", `cast: ${d.castShadow}; receive: ${d.receiveShadow}`);
    // Grow once the mesh is there, so the bounce isn't spent while loading.
    const onMesh = (e: any) => {
      if (e.detail?.type !== "mesh") return;
      el.removeEventListener("object3dset", onMesh);
      el.setAttribute("animation__spawn-grow",
        `property: scale; from: 0.001 0.001 0.001; to: ${s} ${s} ${s}; dur: ${d.growDuration}; easing: ${d.easing}`);
    };
    el.addEventListener("object3dset", onMesh);

    if (d.sounds.length) {
      el.setAttribute("sound",
        `src: ${String(d.sounds[i % d.sounds.length]).trim()}; autoplay: true; loop: false; positional: true; ` +
        `distanceModel: ${d.distanceModel}; rolloffFactor: ${d.rolloffFactor}; ` +
        `refDistance: ${d.refDistance}; maxDistance: ${d.maxDistance}; volume: ${d.volume}`);
      el.addEventListener("sound-loaded", () => {
        const sound = (el as any).components.sound;
        const ws = new THREE.Vector3();
        obj.getWorldScale(ws);
        sound?.pool?.children.forEach((audio: any) => {
          audio.setRefDistance(sound.data.refDistance * ws.x);
          audio.setMaxDistance(sound.data.maxDistance * ws.x);
        });
      });
    }

    self.el.appendChild(el);
    self.spawned.push(el);
    self.el.emit("spawn-sequence-spawned", { el, index: i }, false);
  },

  remove() {
    const self = this as any;
    self.el.removeEventListener("spawn-sequence-start", self.onStart);
    self.el.removeEventListener("spawn-sequence-stop", self.onStop);
    self.el.removeEventListener("spawn-sequence-clear", self.onClear);
    self.running = false;
  }
} as ComponentDefinition;
