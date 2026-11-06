# A-Frame introduction

<!-- overview -->
## Introduction

A-Frame lets you build a 3D scene by writing something that looks like a
web page. Each object in the scene is a tag — `<a-box>`, `<a-entity>` —
and what the object is and does is set with attributes: a model to show,
a colour, a position, a light, an animation. Behind the scenes A-Frame
turns these tags into real 3D graphics in the browser.

Every AR work on AN ALLE! is made this way. The platform provides the
stage (the scene, the camera, the AR engine); a work adds its objects to
it. This introduction covers the handful of ideas and tags you need for
that, and where to look things up in A-Frame's official documentation.

<!-- /overview -->

## About this guide

For anyone starting to build a scene in `src/ArModule.vue`. It covers what
this project actually uses, not all of A-Frame. Official documentation:
[aframe.io/docs](https://aframe.io/docs/1.3.0/introduction/) — **use the
1.3.0 version** (the version switch is at the top of each page): the host
runs 8th Wall's build of A-Frame 1.3.0. Upstream A-Frame is at 1.8 by now;
newer features may not exist here. How A-Frame fits with the other tools:
[ARCHITECTURE-GUIDE.md](ARCHITECTURE-GUIDE.md).

## 1. The idea: entities, components, systems

A-Frame describes a [three.js](https://threejs.org/docs/) scene as HTML,
using an **entity-component-system** pattern
([official explanation](https://aframe.io/docs/1.3.0/introduction/entity-component-system.html)):

- An **entity** is an empty container in the scene — `<a-entity>`. On its
  own it is invisible and does nothing.
- A **component** is an attribute that gives an entity a property or a
  behaviour: `gltf-model` shows a model, `light` makes it a light,
  `place-in-front` puts it on the floor in front of the viewer.
- A **system** is shared logic behind a component (rarely needed here).

```html
<a-entity gltf-model="#statue" position="0 0 -2" rotation="0 45 0"
          animation="property: rotation; to: 0 405 0; loop: true; dur: 8000">
</a-entity>
```

One entity, four components. Everything this template adds — every file
in `src/a-frame-components/` — is a component used the same way.

**Primitives** (`<a-box>`, `<a-plane>`, `<a-light>`, `<a-camera>`, …) are
shortcuts: an entity with some components preset. `<a-box color="red">` is
`<a-entity geometry="primitive: box" material="color: red">`. Use them
for quick shapes; most scenes here are `<a-entity>` + `gltf-model`.

Entities nest: a child's position, rotation and scale are relative to its
parent, so moving a group moves everything in it.

## 2. Writing attributes

- **Multi-property components:** `name="property: value; other: value"` —
  CSS-like. Unset properties keep their defaults (each component's page
  lists them).
- **Vectors** are spaces, not commas: `position="0 1.5 -2"` (x y z).
- **Axes:** y is up, −z is "forward" (away from the default camera),
  x is right. Rotation is in **degrees**.
- **Units** are scene units, not metres. Inside the start scene's
  `scene-root` they're scaled to roughly metres; outside it one unit is
  about 4 m in the app — see [SCENE-PLACEMENT-GUIDE.md](SCENE-PLACEMENT-GUIDE.md).
- **References** to other elements are selectors: `#id`.
- **Several of the same component** on one entity: double underscore,
  `animation__spin`, `animation__bob`.

## 3. Assets

Models, images, sounds and videos are preloaded in `<a-assets>` and
referenced by id ([asset management](https://aframe.io/docs/1.3.0/core/asset-management-system.html)).
**Here the host builds `<a-assets>` for you:** every file in `src/assets/`
becomes an asset whose id is its file name without extension.

```html
<!-- src/assets/statue.glb -->
<a-entity gltf-model="#statue"></a-entity>
```

Never write your own `<a-assets>` in `ArModule.vue`.

## 4. The built-in components you'll meet most

| Component | Use | Docs |
|---|---|---|
| `position`, `rotation`, `scale`, `visible` | Where, how turned, how big, shown or not | [entity](https://aframe.io/docs/1.3.0/core/entity.html) |
| `gltf-model` | Show a `.glb`/`.gltf` model — by far the most used here | [gltf-model](https://aframe.io/docs/1.3.0/components/gltf-model.html) |
| `geometry` + `material` | Simple shapes and their surface (colour, texture, opacity) | [geometry](https://aframe.io/docs/1.3.0/components/geometry.html), [material](https://aframe.io/docs/1.3.0/components/material.html) |
| `light` | Ambient, directional, point, spot lights; `castShadow` | [light](https://aframe.io/docs/1.3.0/components/light.html) |
| `shadow` | Whether an object casts/receives shadows | [shadow](https://aframe.io/docs/1.3.0/components/shadow.html) |
| `animation` | Animate any property (position, rotation, material opacity…) | [animation](https://aframe.io/docs/1.3.0/components/animation.html) |
| `animation-mixer` | Play the animations stored inside a glTF model (from aframe-extras) | [aframe-extras](https://github.com/c-frame/aframe-extras/tree/master/src/loaders) |
| `sound` | Positional or plain audio | [sound](https://aframe.io/docs/1.3.0/components/sound.html) |
| `class="cantap"` | Not a component — makes an entity hittable by the host's cursor (`click` events) | [raycaster](https://aframe.io/docs/1.3.0/components/raycaster.html) |

The camera, cursor and raycaster belong to the host: a module can't set
the camera's `position`, `cursor` or `raycaster`.

## 5. Events

Entities are DOM elements, so they send and receive events like any HTML
element ([events and DOM APIs](https://aframe.io/docs/1.3.0/introduction/javascript-events-dom-apis.html)):

```js
const el = document.querySelector("#statue");
el.addEventListener("model-loaded", () => { /* the model is there */ });
el.emit("my-event", { some: "detail" });      // bubbles up to the scene
el.setAttribute("visible", false);            // change a component
el.setAttribute("material", "opacity", 0.5);  // change one property
```

The ones you'll need most: `loaded` (entity ready), `model-loaded`
(glTF loaded — the moment to touch a model's materials), `object3dset`
(any mesh set), `animation-finished`, `sound-ended`, `click` (from the
host's cursor on `.cantap`). Many template components emit their own,
named after themselves (`place-in-front-placed`, `spawn-sequence-done`) —
each guide lists them.

## 6. Under the hood: three.js

Each entity has a three.js object, `el.object3D`; a loaded model sits at
`el.getObject3D("mesh")`. Components work with these directly when markup
isn't enough ([developing with three.js](https://aframe.io/docs/1.3.0/introduction/developing-with-threejs.html)).
Two rules that matter here:

- Copies of the same glTF share their materials — clone a material before
  changing it, or every copy changes.
- three.js versions differ between host (r137) and `dev:ar` (r158);
  colour-space and sorting details can look different. Check in the host.

## 7. Tools

- **Browser console** — every component in this template warns there when
  something doesn't resolve; first stop when "nothing happens".
- **A-Frame Inspector** — `Ctrl + Alt + I` opens A-Frame's visual inspector
  ([docs](https://aframe.io/docs/1.3.0/introduction/visual-inspector-and-dev-tools.html)):
  click entities, see and change their components live. It loads from the
  internet; on a desktop browser with `npm run dev` it's the easiest place
  to try it.
- **`examples/*.html`** — ready markup for every feature.

## 8. What's different in this project

- The scene, camera, lights and AR session are the **host's**; a module
  only adds entities inside its mount point (1.6 units up, 3 in front).
  Put floor content in the start scene's `scene-root`
  ([SCENE-PLACEMENT-GUIDE.md](SCENE-PLACEMENT-GUIDE.md)).
- The markup lives in a Vue file, so you can use Vue bindings on A-Frame
  tags (`:visible="ready"`, `v-for`) — see [VUE-INTRODUCTION.md](VUE-INTRODUCTION.md).
- Components are TypeScript files that register themselves by file name —
  see [WRITING-A-COMPONENT-GUIDE.md](WRITING-A-COMPONENT-GUIDE.md).
- The AR side (camera feed, floor, image targets) comes from 8th Wall —
  see [8THWALL-INTRODUCTION.md](8THWALL-INTRODUCTION.md).

## Further reading (official)

- [Introduction](https://aframe.io/docs/1.3.0/introduction/) and
  [Entity-Component-System](https://aframe.io/docs/1.3.0/introduction/entity-component-system.html)
- [HTML & primitives](https://aframe.io/docs/1.3.0/introduction/html-and-primitives.html)
- [Writing a component](https://aframe.io/docs/1.3.0/introduction/writing-a-component.html)
- [Component API](https://aframe.io/docs/1.3.0/core/component.html),
  [Entity API](https://aframe.io/docs/1.3.0/core/entity.html)
- [three.js manual](https://threejs.org/manual/) (for components that work below A-Frame)
