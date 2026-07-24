import type { ComponentDefinition } from "aframe";

declare const THREE: any;

// Central driver for every lod-object beneath it — placed once per module,
// on an ancestor of every lod-object it should drive (typically the module
// root). lod-object instances resolve it by walking up to the nearest
// `[lod-manager]` ancestor and calling register()/unregister().
//
// Each frame it processes only a fraction of the registered objects
// (round-robin, `chunksPerCycle` buckets) to spread the cost, cross-fading each
// object's detailed mesh group against its billboard stand-in by camera distance.
//
// Real three.js `renderOrder` values this assigns (see updateRenderOrder)
// always start at RENDER_ORDER_BASE, well above any realistic value a
// project would set by hand with the standalone [render-order] component —
// so a manually-tagged, non-LOD transparent object elsewhere in the scene
// can never numerically land inside an LOD-managed band and sort
// inconsistently against it as the camera moves. See
// cross-feature-reference-docs/RENDER-ORDER-AND-TRANSPARENCY-GUIDE.md for the full picture.
const RENDER_ORDER_BASE = 100000;

export default {
  schema: {
    chunksPerCycle: { type: "number", default: 6 }
  },

  init() {
    const self = this as any;
    self.objects = [];
    self.camera = null;
    self.camPos = new THREE.Vector3();
    self.tmpWorldPos = new THREE.Vector3();
    self.frameCounter = 0;
  },

  register(obj: any) {
    (this as any).objects.push(obj);
  },

  unregister(obj: any) {
    const objects = (this as any).objects;
    const idx = objects.indexOf(obj);
    if (idx !== -1) objects.splice(idx, 1);
  },

  tick(_time: number, delta: number) {
    const self = this as any;
    if (!self.camera) {
      self.camera = self.el.sceneEl.camera;
      if (!self.camera) return;
    }

    self.camera.getWorldPosition(self.camPos);
    self.frameCounter++;

    const chunksPerCycle = self.data.chunksPerCycle;
    const chunkIndex = self.frameCounter % chunksPerCycle;
    const len = self.objects.length;

    for (let i = 0; i < len; i++) {
      if (i % chunksPerCycle !== chunkIndex) continue;

      const obj = self.objects[i];
      obj.el.object3D.getWorldPosition(self.tmpWorldPos);
      const distSq = self.tmpWorldPos.distanceToSquared(self.camPos);
      obj._lastDistSq = distSq;

      if (distSq <= obj.nearDistanceSq) {
        self.applyBlend(obj, 1, delta);
        continue;
      }
      if (distSq >= obj.farDistanceSq) {
        self.applyBlend(obj, 0, delta);
        continue;
      }

      const dist = Math.sqrt(distSq);
      const target = 1 - (dist - obj.nearDistance) / (obj.farDistance - obj.nearDistance);
      self.applyBlend(obj, target, delta);
    }

    // Re-rank every registered object by depth every frame (cheap: one sort
    // over the objects + a loop over their mesh nodes) and repack each
    // instance into its own render-order band so transparent meshes of
    // different instances never interleave. This has to stay in step with
    // the camera, not just the LOD blend loop above: any part that lacks
    // real depth-writing (billboards always do, and a genuinely translucent
    // — alphaMode: BLEND — mesh now correctly does too, see lod-object.ts)
    // has NO depth buffer to fall back on if this band assignment is stale,
    // so it visibly renders in the wrong order relative to other such parts
    // the moment ranks change — unlike an opaque mesh, where real depth
    // still masks a stale band.
    self.updateRenderOrder();
  },

  /**
   * Assign every registered instance a non-overlapping render-order band, ordered
   * back-to-front by camera distance: the farthest object gets the lowest band
   * (drawn first, behind) and the nearest the highest (drawn last, on top) — the
   * correct order for alpha-blended transparency. Each mesh's final renderOrder is
   * `RENDER_ORDER_BASE + rank * band + localOrder`, so the per-mesh order authored
   * via [render-order] is preserved *within* each instance while whole instances
   * sort correctly *between* themselves. `band` is the widest single-instance span
   * (+1) so no two bands overlap.
   */
  updateRenderOrder() {
    const self = this as any;
    const objects = self.objects;
    const n = objects.length;
    if (!n) return;

    // Fresh camera distance for every instance so the ranking is a consistent
    // snapshot (the chunked LOD loop above only refreshes a fraction each frame).
    for (let i = 0; i < n; i++) {
      const obj = objects[i];
      obj.el.object3D.getWorldPosition(self.tmpWorldPos);
      obj._renderDistSq = self.tmpWorldPos.distanceToSquared(self.camPos);
    }

    const order = (self._rankOrder ||= []);
    order.length = n;
    for (let i = 0; i < n; i++) order[i] = i;
    order.sort((a: number, b: number) => objects[b]._renderDistSq - objects[a]._renderDistSq);

    // Band must exceed the widest per-instance local span so bands can't overlap.
    let band = 1;
    for (let i = 0; i < n; i++) {
      const span = objects[i].renderSpan || 0;
      if (span + 1 > band) band = span + 1;
    }

    for (let rank = 0; rank < n; rank++) {
      const obj = objects[order[rank]];
      const base = RENDER_ORDER_BASE + rank * band;
      const nodes = obj.renderNodes;
      if (!nodes) continue;
      for (let k = 0; k < nodes.length; k++) {
        nodes[k].node.renderOrder = base + nodes[k].localOrder;
      }
    }
  },

  applyBlend(obj: any, groupTarget: number, delta: number) {
    const self = this as any;
    const chunksPerCycle = self.data.chunksPerCycle;
    const speed = obj.fadeSpeed * (delta / 1000) * chunksPerCycle;
    const newGroupBlend = obj.currentBlend + (groupTarget - obj.currentBlend) * Math.min(speed, 1);
    const groupChanged = Math.abs(newGroupBlend - obj.currentBlend) >= 0.001;
    if (groupChanged) obj.currentBlend = newGroupBlend;

    const meshVisible = obj.currentBlend > 0.01;
    const billboardVisible = obj.currentBlend < 0.99;

    obj.meshGroupObj.visible = meshVisible;

    if (meshVisible) {
      if (groupChanged) {
        // Multiply by each material's true (glTF-authored) opacity rather
        // than overwriting it outright — a genuinely translucent part (e.g.
        // tinted glass at alpha 0.3) must stay translucent even at full LOD
        // blend, not get forced fully opaque, or anything meant to show
        // through it silently disappears. An ordinary opaque part has
        // trueOpacity 1, so this is a no-op for it — unchanged.
        for (const m of obj.meshMaterials) m.opacity = (m.userData.trueOpacity ?? 1) * obj.currentBlend;
      }

      // Parts with their own data-lod-near/-far thresholds fade independently,
      // then get multiplied by the group blend so they never exceed it.
      for (const ov of obj.overrides) {
        let ovTarget;
        if (obj._lastDistSq <= ov.nearDistanceSq) {
          ovTarget = 1;
        } else if (obj._lastDistSq >= ov.farDistanceSq) {
          ovTarget = 0;
        } else {
          const dist = Math.sqrt(obj._lastDistSq);
          ovTarget = 1 - (dist - ov.nearDistance) / (ov.farDistance - ov.nearDistance);
        }

        const ovSpeed = ov.fadeSpeed * (delta / 1000) * chunksPerCycle;
        ov.currentBlend = ov.currentBlend + (ovTarget - ov.currentBlend) * Math.min(ovSpeed, 1);

        const finalOpacity = ov.currentBlend * obj.currentBlend;
        for (const m of ov.materials) {
          const fade = (m.userData.trueOpacity ?? 1) * finalOpacity;
          // Dither-flagged overrides drive the discard threshold set up by
          // lod-object's setupDitherMaterial instead of real opacity — see
          // that method for why. Everything else is unchanged, real alpha
          // blending.
          if (ov.dither && m.userData.ditherFade) {
            m.userData.ditherFade.value = fade;
          } else {
            m.opacity = fade;
          }
        }
      }
    }

    if (obj.billboardObj) {
      obj.billboardObj.visible = billboardVisible;
      if (billboardVisible) {
        // Once fully faded out of the detailed mesh (no active crossfade
        // with this instance's own other parts), the billboard can safely
        // write real depth again — there's nothing left in this instance it
        // needs to composite smoothly against. That lets real 3D distance,
        // not just the coarser origin-point render-order band, resolve
        // overlaps against OTHER instances' billboards — a single flat plane
        // that always faces the camera is large enough on screen that the
        // band's one-point-per-instance approximation isn't reliable enough
        // on its own once many billboards are simultaneously visible.
        const settled = obj.currentBlend < 0.01;

        // With depthWrite on, ordinary alpha blending still writes depth
        // across the WHOLE quad — including the billboard image's
        // transparent background — since nothing discards those fragments.
        // That punches an opaque, plane-shaped hole in the depth buffer that
        // occludes anything drawn afterward at those pixels, including
        // another instance's billboard behind it: exactly the black gaps
        // seen BETWEEN billboards (as opposed to within one translucent
        // mesh, which never enables depthWrite). alphaTest discards the
        // transparent background
        // before it can write depth, so only the actual artwork occludes.
        // Only touch it on an actual settle/unsettle transition — alphaTest
        // is a shader recompile (needsUpdate), not a cheap per-frame toggle —
        // and keep it off (0) while fading, per the comment in lod-object.ts,
        // so the crossfade itself stays a smooth blend rather than a cutout.
        if (settled !== obj._billboardSettled) {
          obj._billboardSettled = settled;
          for (const m of obj.billboardMaterials) {
            m.alphaTest = settled ? 0.5 : 0;
            m.needsUpdate = true;
          }
        }

        for (const m of obj.billboardMaterials) {
          m.depthWrite = settled;
          m.opacity = 1 - obj.currentBlend;
        }
      }
    }
  }
} as ComponentDefinition;
