import type { ComponentDefinition } from "aframe";
import { applyEnvMap } from "./env-map-shared";

declare const THREE: any;

// Live environment map from the camera feed: the 8th Wall camera image is
// projected onto a sphere and rendered into a cube map every frame, so
// reflective materials mirror the real surroundings.
//
//   <a-entity gltf-model="#model" cubemap-realtime></a-entity>
//
// Needs a running XR8 camera session (`npm run dev:ar` / the host). Without
// XR8 (`npm run dev`) it does nothing and the model keeps its own material.
//
// Ported from the Augmented Bahnhofsviertel 8th Wall projects
// (cubemap-realtime.js, used by 15 projects). Six versions exist; four only
// differ in whitespace. The other two read the camera texture from
// `frameStartResult.cameraTexture` in onProcessCpu instead of from
// `processCpuResult.reality.realityTexture` in onUpdate — same image, the
// latter is the one synced with the XrController. This port uses the synced
// one.
//
// Mechanical fixes against the original:
//   - Materials are cloned before envMap is written (see env-map-shared.ts).
//   - Reacts to `object3dset` (type "mesh") instead of `model-loaded`, as
//     AGENTS.md §5 requires.
//   - Every instance registered its pipeline module under the same name
//     'cubemap-process', so a second instance replaced the first, and it was
//     never removed. Here each instance gets a unique name and removes its
//     module (and frees its render target) on remove().
//   - The render target is flagged needsPMREMUpdate after every cube update
//     (three r158 re-prefilters render-target env maps only when flagged).
//   - THREE.RGBFormat no longer exists in three.js r158 (8frame 1.5); the
//     render target uses the default RGBA. `encoding: sRGBEncoding` is
//     kept on three versions that still have it (8frame 1.3, the host app)
//     and expressed as `colorSpace: SRGBColorSpace` on r152+ (8frame 1.5).
//
// Known incompatibility: don't combine with a cubemap-static on another
// instance of the same model in the same scene. In three r158 the two
// prefiltered env maps interfere and the live one ends up showing the
// static image (found on an Augmented Bahnhofsviertel work: the visible
// ball reflected an invisible copy's static cube map instead of the camera).
//
// Ported via the augmented-bahnhofsviertel branch.
let instanceCounter = 0;

export default {
  schema: {
    // Not in the original (defaults = the original's behaviour):
    // envMapIntensity on the materials, and the cube render target's size.
    envMapIntensity: { type: "number", default: 1 },
    size: { type: "int", default: 256 }
  },

  init() {
    const self = this as any;
    const scene = self.el.sceneEl;
    self.pipelineName = `cubemap-process-${++instanceCounter}`;

    const camTexture = new THREE.Texture();
    const sphereMaterial = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      color: 0xffffff,
      map: camTexture
    });

    // sRGB like the original's `encoding: sRGBEncoding`, in both three APIs:
    // `colorSpace` (r152+, 8frame 1.5) and `encoding` (8frame 1.3 / r137 —
    // the host app's runtime, where SRGBColorSpace doesn't exist and the
    // option would otherwise silently fall back to linear).
    self.renderTarget = new THREE.WebGLCubeRenderTarget(self.data.size, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      ...(THREE.SRGBColorSpace !== undefined
        ? { colorSpace: THREE.SRGBColorSpace }
        : { encoding: THREE.sRGBEncoding })
    });

    const cubeMapScene = new THREE.Scene();
    const cubeCamera = new THREE.CubeCamera(1, 1000, self.renderTarget);
    const sphereMesh = new THREE.Mesh(new THREE.SphereGeometry(100, 15, 15), sphereMaterial);
    sphereMesh.scale.set(-1, 1, 1);
    sphereMesh.rotation.set(Math.PI, -Math.PI / 2, 0);
    cubeMapScene.add(sphereMesh);
    self.disposables = [camTexture, sphereMaterial, sphereMesh.geometry];

    self.apply = () =>
      applyEnvMap(self.el.getObject3D("mesh"), self.renderTarget.texture, { intensity: self.data.envMapIntensity });
    self.onObject3DSet = (e: any) => {
      if (e.detail?.type === "mesh") self.apply();
    };

    self.startListen = () => {
      const XR8 = (window as any).XR8;
      if (!XR8 || self.removed) return;
      XR8.XrController.configure({ enableLighting: true });
      XR8.addCameraPipelineModule({
        name: self.pipelineName,
        onUpdate: ({ frameStartResult, processCpuResult }: any) => {
          cubeCamera.update(scene.renderer, cubeMapScene);
          // three r158 re-prefilters (PMREM) a render-target env map only when
          // it's flagged; flag it after every cube update so glossy materials
          // follow the camera image.
          self.renderTarget.texture.needsPMREMUpdate = true;
          let cameraTexture = frameStartResult.cameraTexture;
          if (processCpuResult.reality) {
            cameraTexture = processCpuResult.reality.realityTexture;
          } else if (processCpuResult.facecontroller) {
            cameraTexture = processCpuResult.facecontroller.cameraFeedTexture;
          }
          // Point the three.js texture straight at the engine's WebGL texture
          // (no upload): same trick as the original and 8th Wall's examples.
          scene.renderer.properties.get(camTexture).__webglTexture = cameraTexture;
        }
      });
      self.pipelineAdded = true;
      self.el.addEventListener("object3dset", self.onObject3DSet);
      self.apply();
    };

    if ((window as any).XR8) self.startListen();
    else window.addEventListener("xrloaded", self.startListen, { once: true });
  },

  remove() {
    const self = this as any;
    self.removed = true;
    window.removeEventListener("xrloaded", self.startListen);
    self.el.removeEventListener("object3dset", self.onObject3DSet);
    if (self.pipelineAdded) {
      try {
        (window as any).XR8?.removeCameraPipelineModule(self.pipelineName);
      } catch { /* engine already torn down */ }
    }
    applyEnvMap(self.el.getObject3D("mesh"), null);
    self.renderTarget.dispose();
    self.disposables.forEach((d: any) => d.dispose());
  }
} as ComponentDefinition;
