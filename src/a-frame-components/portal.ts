import type { ComponentDefinition } from "aframe";

declare const THREE: any;

// A walk-through portal: from outside, a world is visible only through a
// doorway; step through the door plane and you're inside it, all around.
//
//   <a-entity portal="contents: #inside; walls: #hiders; portalWall: #back-door; door: #door-ring">
//     <a-entity id="hiders">   … boxes/rings with xrextras-hider-material around the inside …</a-entity>
//     <a-entity id="back-door"> … hider shape(s) at the door plane, seen from inside …</a-entity>
//     <a-entity id="inside">   … the world behind the door (videosphere, models, …) …</a-entity>
//   </a-entity>
//
// The door plane is this entity's z = 0, the doorway |x| < width/2,
// y < height (local units); outside = z > 0. Outside, `contents` are drawn
// but masked by `walls` (hider material writes depth, no colour, so the
// camera image shows through) — only the doorway reveals them. Crossing the
// plane inside the doorway switches to "inside": walls off, contents all
// around, `portalWall` on (e.g. a hider disc that keeps a window back to the
// real world). Crossing back switches back. Emits `portal-enter` /
// `portal-exit` on this entity.
//
// Door animation (optional): `door` is a hider ring (<a-ring
// xrextras-hider-material radius-inner="0" …>) covering the doorway; the
// `portal-open` event animates its radius-inner from ~0 to `openRadius` over
// `openDuration` ms (`openEasing`), `portal-close` animates it back. Without
// `door` the doorway is simply open.
//
// Draw order: hider materials only mask what's drawn AFTER them. three.js
// r137 (8frame 1.3, the host app) sorts opaque objects by material id, r158
// (8frame 1.5) by distance only — so the result can flip with every camera
// move. This component pins the order with renderOrder: walls, portal wall
// and door `hiderOrder` (1), contents `contentsOrder` (2); everything else
// keeps 0 and draws first (e.g. a doorway frame or a video in front of the
// door stays visible). Applied again whenever a mesh appears below this
// entity (object3dset bubbles), so glTF contents loading later get it too.
//
// The camera's WORLD position is converted into this entity's space every
// tick, so the portal works inside any placed/scaled/rotated parent. The
// hider material comes from xrextras (loaded by the host and the previews).
//
// Generalised from the Augmented Bahnhofsviertel ports (augmented-
// bahnhofsviertel: legacy-portal, #22 Privileged I, #7 I can't get no — the
// old projects' identical portal-components.js `portal-camera`, which sat on
// the camera and read its LOCAL position as scene coordinates).
export default {
  schema: {
    width: { type: "number", default: 10 },
    height: { type: "number", default: 10 },
    contents: { type: "selector" },
    walls: { type: "selector" },
    portalWall: { type: "selector" },
    door: { type: "selector" },
    openRadius: { type: "number", default: 5 },
    openDuration: { type: "number", default: 1500 },
    openEasing: { type: "string", default: "easeOutElastic" },
    hiderOrder: { type: "number", default: 1 },
    contentsOrder: { type: "number", default: 2 }
  },

  init() {
    const self = this as any;
    self.isInside = false;
    self.wasOutside = true;
    self.camPos = new THREE.Vector3();
    self.onObject3DSet = () => self.applyOrder();
    self.el.addEventListener("object3dset", self.onObject3DSet);
    self.onOpen = () => self.animateDoor(true);
    self.onClose = () => self.animateDoor(false);
    self.el.addEventListener("portal-open", self.onOpen);
    self.el.addEventListener("portal-close", self.onClose);
  },

  update() {
    (this as any).applyOrder();
  },

  applyOrder() {
    const self = this as any;
    const { contents, walls, portalWall, door, hiderOrder, contentsOrder } = self.data;
    const set = (el: any, order: number) => el?.object3D.traverse((node: any) => {
      if (node.isMesh) node.renderOrder = order;
    });
    set(walls, hiderOrder);
    set(portalWall, hiderOrder);
    set(door, hiderOrder);
    set(contents, contentsOrder);
  },

  animateDoor(open: boolean) {
    const self = this as any;
    const door = self.data.door;
    if (!door) return;
    const current = parseFloat(door.getAttribute("radius-inner")) || 0.001;
    door.setAttribute("animation__portal-door", {
      property: "radius-inner",
      from: current,
      to: open ? self.data.openRadius : 0.001,
      dur: self.data.openDuration,
      easing: self.data.openEasing
    });
  },

  tick() {
    const self = this as any;
    const camera = self.el.sceneEl.camera;
    const { contents, walls, portalWall } = self.data;
    if (!camera || !contents || !walls) return;
    camera.getWorldPosition(self.camPos);
    const p = self.el.object3D.worldToLocal(self.camPos);
    const isOutside = p.z > 0;
    const inDoorway = p.y < self.data.height && Math.abs(p.x) < self.data.width / 2;
    if (self.wasOutside !== isOutside && inDoorway) {
      self.isInside = !isOutside;
      self.el.emit(self.isInside ? "portal-enter" : "portal-exit", null, false);
    }
    contents.object3D.visible = self.isInside || isOutside;
    walls.object3D.visible = !self.isInside && isOutside;
    if (portalWall) portalWall.object3D.visible = self.isInside && !isOutside;
    self.wasOutside = isOutside;
  },

  remove() {
    const self = this as any;
    self.el.removeEventListener("object3dset", self.onObject3DSet);
    self.el.removeEventListener("portal-open", self.onOpen);
    self.el.removeEventListener("portal-close", self.onClose);
  }
} as ComponentDefinition;
