# Writing your own component

<!-- overview -->
## Introduction

A component is a small piece of program that gives objects in the scene
a behaviour: turning slowly, reacting to a tap, changing colour when a
model has loaded. The template comes with many ready-made ones; when none
of them does what a work needs, you can write your own. It's one file,
usually short, and once it exists you use it like any other: as an
attribute on an object in your scene.

This guide walks through that step by step, without assuming programming
experience beyond the basics: where the file goes, what the few parts of a
component are, a complete working example to start from, and the house
rules that keep a component from getting in the way of others.

<!-- /overview -->

## About this guide

For anyone who wants to add behaviour the existing features don't cover.
It builds on A-Frame's official guide
[Writing a component](https://aframe.io/docs/1.3.0/introduction/writing-a-component.html)
and the [Component API](https://aframe.io/docs/1.3.0/core/component.html)
(version 1.3.0, as in the host). Read [AFRAME-INTRODUCTION.md](AFRAME-INTRODUCTION.md)
first if entities and components are new to you. Both examples below were
type-checked and run in this template's preview.

## 1. Before you write one

- **Check the [feature catalog](../FEATURE-CATALOG.md)** — moving,
  fading, placing, tapping, sound, animation are probably there.
- **Simple motion may need no code:** A-Frame's
  [`animation`](https://aframe.io/docs/1.3.0/components/animation.html)
  component animates any property from markup.
- Write a component when the behaviour needs logic: reacting to the
  camera's distance, to events, to time, or working with the 3D objects
  themselves.

## 2. Just enough TypeScript

Components here are TypeScript (`.ts`): JavaScript plus optional type
labels that are checked while building and removed afterwards
([TypeScript in 5 minutes](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html)).
For a component you need four things:

- `import type { ComponentDefinition } from "aframe";` — A-Frame's type for
  a component; the file ends with `} as ComponentDefinition;`.
- `declare const THREE: any;` — tells TypeScript that `THREE` (the three.js
  A-Frame brings along) exists at runtime.
- `const self = this as any;` — "don't type-check this object"; the
  template's usual first line in each method.
- `(_time: number, delta: number)` — type labels on a function's inputs.

Everything else is ordinary JavaScript. If `npm run build` reports a type
error you don't understand, `as any` on the value in question is an
acceptable way out in a component.

## 3. Step by step

1. **Create the file** `src/a-frame-components/float-and-spin.ts`. The file
   name *is* the component's name; use lowercase and hyphens, and put it
   directly in that folder (no subfolder). Check the folder first — the
   name must not exist yet.
2. **Write the component** (example below) and **export it as default**.
3. **Use it** in `src/ArModule.vue`:
   ```html
   <a-entity gltf-model="#statue" float-and-spin="height: 0.15; spin: 30"></a-entity>
   ```
   No registration: a component used in the scene is found, bundled and
   registered automatically.
4. **Look at it** with `npm run dev`; save the file and the preview
   reloads. Watch the browser console for errors.
5. **Check it builds:** `npm run build` (type check + build).

## 4. Example: float and spin

Moves its entity gently up and down and turns it, at a speed independent
of the phone's frame rate.

```ts
import type { ComponentDefinition } from "aframe";

// Lets its entity float up and down and slowly turn around its own y axis.
export default {
  schema: {
    height: { type: "number", default: 0.1 }, // how far up and down
    speed: { type: "number", default: 0.5 },  // up-and-down cycles per second
    spin: { type: "number", default: 20 }     // degrees per second
  },

  init() {
    const self = this as any;
    self.baseY = self.el.object3D.position.y; // remember where it started
    self.elapsed = 0;
  },

  tick(_time: number, delta: number) {
    const self = this as any;
    if (!delta) return;
    const seconds = delta / 1000;              // time since the last frame
    self.elapsed += seconds;
    const { height, speed, spin } = self.data;
    const obj = self.el.object3D;
    obj.position.y = self.baseY + Math.sin(self.elapsed * speed * Math.PI * 2) * height;
    obj.rotation.y += (spin * Math.PI / 180) * seconds; // three.js uses radians
  },

  remove() {
    const self = this as any;
    self.el.object3D.position.y = self.baseY;  // leave it where we found it
  }
} as ComponentDefinition;
```

What happens:

- **`schema`** — the settings, with type and default. They arrive in
  `this.data`; in markup they're written `height: 0.15; spin: 30`.
- **`init()`** — once, when the entity gets the component. Remember
  starting values, create objects you'll reuse.
- **`tick(time, delta)`** — every frame. `delta` is the time since the
  last frame in milliseconds; multiplying by it keeps the speed the same
  on fast and slow phones.
- **`remove()`** — when the component or its entity goes away (also when
  the host switches to another work). Undo what you changed.

## 5. Example: react to an event

`src/a-frame-components/model-tint.ts`, used as `model-tint="color: #3366ff"`
on an entity with a `gltf-model`. Tints the model once it has loaded — and
shows the one rule every material-changing component here must follow.

```ts
import type { ComponentDefinition } from "aframe";

// Gives every mesh of the entity's model a colour, once the model has loaded.
export default {
  schema: {
    color: { type: "color", default: "#ff7a00" }
  },

  init() {
    const self = this as any;
    self.onLoaded = () => self.applyTint();
    self.el.addEventListener("model-loaded", self.onLoaded);
  },

  update() {
    (this as any).applyTint();               // also when `color` changes later
  },

  applyTint() {
    const self = this as any;
    const model = self.el.getObject3D("mesh");
    if (!model) return;                      // not loaded yet — model-loaded will call again
    model.traverse((node: any) => {
      if (!node.isMesh || Array.isArray(node.material)) return;
      if (!node.userData.tintOwned) {        // copies of one model share materials:
        node.material = node.material.clone(); // clone once, or every copy turns orange
        node.userData.tintOwned = true;
      }
      node.material.color.set(self.data.color);
    });
  },

  remove() {
    const self = this as any;
    self.el.removeEventListener("model-loaded", self.onLoaded);
  }
} as ComponentDefinition;
```

- **`update(oldData)`** runs after `init()` and whenever a setting changes;
  compare `this.data` with `oldData` if only some changes matter.
- Extra methods (`applyTint`) can sit next to the lifecycle methods.
- Every listener added in `init()` is removed in `remove()`.

## 6. Reference

**Schema types used in this template** ([property types](https://aframe.io/docs/1.3.0/core/component.html#property-types)):
`number`, `int`, `boolean`, `string`, `color`, `vec3` (`"0 1 0"` →
`{x, y, z}`), `selector` (`"#id"` → the element, or `null`), `array`
(`"a, b, c"`). One setting only? `schema: { type: "number", default: 1 }`,
used as `my-component="2"`, read as `this.data`.

**Lifecycle**

| Method | Runs | Typical use |
|---|---|---|
| `init()` | once, when attached | read settings, create reusable objects, add listeners |
| `update(oldData)` | after `init`, and when settings change | apply settings |
| `tick(time, delta)` | every frame | movement, distance checks — keep it light |
| `remove()` | when detached / entity removed | remove listeners, undo changes |
| `pause()` / `play()` | when the scene pauses/resumes | stop/restart timers, sounds |

**Talking to the rest of the scene**

```ts
self.el                                   // the entity (a DOM element)
self.el.object3D                          // its three.js object: position, rotation, scale
self.el.getObject3D("mesh")               // its model / mesh, once loaded
self.el.sceneEl.camera                    // the three.js camera
self.el.emit("float-and-spin-done", { n: 1 }); // send an event (name starts with yours)
self.el.setAttribute("visible", false);   // change another component
```

## 7. House rules

These keep a component working in the host and alongside others
([AGENTS.md §5](../AGENTS.md) has the full list):

1. **File name = component name**, lowercase-with-hyphens, directly in
   `src/a-frame-components/`. A name that already exists in another module
   loses: the first registration wins for the whole session.
2. **No `AFRAME` or `THREE` at the top of the file** — use them only inside
   methods. The module can load before A-Frame does.
3. **Clone a material before changing it** (example 2).
4. **Remove what you add** — listeners, objects, timers — in `remove()`.
5. **Don't allocate in `tick()`:** create `new THREE.Vector3()` etc. once in
   `init()` and reuse them; creating objects every frame makes phones
   stutter.
6. **Use `delta`** for anything that moves over time.
7. **Don't fight over the same transform:** if another component already
   sets an entity's position (`place-in-front`, `attach-to`, gestures),
   put yours on a child or parent entity.
8. **Positions relative to the floor, camera or world** must be converted
   through the parent (`parent.worldToLocal(...)`) — a module never sits at
   the world origin ([SCENE-PLACEMENT-GUIDE.md](SCENE-PLACEMENT-GUIDE.md)).
9. **Comment the why:** a few lines at the top saying what the component
   does and what it shouldn't be combined with.

## 8. Learning from existing components

Short, readable ones to look at in `src/a-frame-components/`:
`no-frustum-cull.ts` (an event listener, nothing else), `world-origin.ts`
(matrix maths in a few lines), `attach-to.ts` (follow another entity every
frame), `ground-decal.ts` (world ↔ local conversion). Turning your
component into a shared feature of the template follows
[ADDING-FEATURES-WORKFLOW.md](../ADDING-FEATURES-WORKFLOW.md).

## Further reading (official)

- A-Frame: [Writing a component](https://aframe.io/docs/1.3.0/introduction/writing-a-component.html),
  [Component API](https://aframe.io/docs/1.3.0/core/component.html),
  [three.js in A-Frame](https://aframe.io/docs/1.3.0/introduction/developing-with-threejs.html)
- TypeScript: [in 5 minutes](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html),
  [everyday types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- three.js: [manual](https://threejs.org/manual/), [docs](https://threejs.org/docs/)
