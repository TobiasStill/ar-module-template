import type { ComponentDefinition } from "aframe";

// Drives a light's intensity from 8th Wall's real-world light estimation, so
// virtual content brightens/darkens with the camera image:
//
//   <a-entity light="type: directional" xr-light></a-entity>
//   <a-light type="ambient" xr-light="min: 0.2; max: 1.5"></a-light>
//
// Ported from the Augmented Bahnhofsviertel 8th Wall projects (xrlight.js,
// byte-identical in all 17 projects that use it). Same name and schema, so
// old scene markup carries over unchanged. Same formula: intensity =
// clamp(1 + exposure, min, max).
//
// Differences to the original, all mechanical:
//   - The original split this into a component plus an A-Frame *system*. The
//     manifest can only register components, so the shared state (one XR8
//     camera-pipeline module feeding every xr-light instance) is a
//     module-level singleton here instead.
//   - The original added its pipeline module once and never removed it. Here
//     it's removed again when the last xr-light instance goes away, so
//     unmounting the module leaves nothing running in the host's shared XR8
//     pipeline.
//   - The original rewrote the whole `light` attribute string every tick;
//     this only writes intensity when it actually changed.
//
// Without XR8 (the stock-A-Frame `npm run dev` preview) the estimate stays
// at its neutral starting value 1, i.e. the light keeps intensity
// clamp(1, min, max).

declare global {
  interface Window {
    XR8?: any;
  }
}

const PIPELINE_MODULE_NAME = "xr-light";

let estimatedIntensity = 1;
let instanceCount = 0;
let pipelineAdded = false;
let waitingForXr = false;

function addPipelineModule(): void {
  const XR8 = window.XR8;
  if (!XR8 || pipelineAdded || instanceCount === 0) return;
  XR8.XrController.configure({ enableLighting: true });
  XR8.addCameraPipelineModule({
    name: PIPELINE_MODULE_NAME,
    onUpdate: ({ processCpuResult }: any) => {
      const exposure = processCpuResult?.reality?.lighting?.exposure;
      if (exposure) estimatedIntensity = 1 + exposure;
    }
  });
  pipelineAdded = true;
}

function onXrLoaded(): void {
  waitingForXr = false;
  addPipelineModule();
}

function acquire(): void {
  instanceCount++;
  if (window.XR8) {
    addPipelineModule();
  } else if (!waitingForXr) {
    waitingForXr = true;
    window.addEventListener("xrloaded", onXrLoaded, { once: true });
  }
}

function release(): void {
  instanceCount = Math.max(0, instanceCount - 1);
  if (instanceCount > 0) return;
  if (waitingForXr) {
    window.removeEventListener("xrloaded", onXrLoaded);
    waitingForXr = false;
  }
  if (pipelineAdded) {
    try {
      window.XR8?.removeCameraPipelineModule(PIPELINE_MODULE_NAME);
    } catch { /* engine already torn down */ }
    pipelineAdded = false;
  }
  estimatedIntensity = 1;
}

export default {
  schema: {
    min: { default: 0 },
    max: { default: 2 }
  },
  init() {
    const self = this as any;
    self.lastIntensity = NaN;
    acquire();
  },
  tick() {
    const self = this as any;
    const intensity = Math.max(self.data.min, Math.min(estimatedIntensity, self.data.max));
    if (Math.abs(intensity - self.lastIntensity) < 0.001) return;
    self.lastIntensity = intensity;
    self.el.setAttribute("light", "intensity", intensity);
  },
  remove() {
    release();
  }
} as ComponentDefinition;
