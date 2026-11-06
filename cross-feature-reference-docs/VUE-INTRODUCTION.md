# Vue introduction

<!-- overview -->
## Introduction

Vue is a tool for building what you see on a web page from a description:
you write how the page should look for a given state — "show the loading
bar while not everything has loaded" — and Vue keeps the page in line with
that state by itself. A Vue component is one file that holds the markup,
the bit of program logic behind it, and optionally its styling.

On AN ALLE! both the platform and every work are Vue components. Your
scene file, `ArModule.vue`, is one: its markup is the A-Frame scene plus
any buttons or hints shown over the camera image, its logic loads things,
reacts to taps and hands data to the scene. You need only a small part of
Vue for that; this introduction covers exactly that part.

<!-- /overview -->

## About this guide

For anyone editing `src/ArModule.vue` beyond copying markup in. Official
documentation: [vuejs.org/guide](https://vuejs.org/guide/introduction.html)
(Vue 3; this project uses the Composition API with `<script setup>`). The
host provides Vue — a module never installs or bundles its own. How Vue
fits with A-Frame and the host: [ARCHITECTURE-GUIDE.md](ARCHITECTURE-GUIDE.md).

## 1. What Vue does here

- **The module is a Vue component.** The host imports `ar-module.js`, gets
  the component, and mounts it inside its A-Frame scene. Your
  `<template>` becomes real DOM elements — `<a-entity>` tags that A-Frame
  then turns into 3D, and ordinary HTML for 2D overlays.
- **Vue handles state and structure; A-Frame components handle 3D
  behaviour.** Use Vue to decide *what* is in the scene (show this group
  once loaded, one entity per item in a list, a button that starts the
  music). Put anything that runs every frame or works with three.js into
  an A-Frame component ([WRITING-A-COMPONENT-GUIDE.md](WRITING-A-COMPONENT-GUIDE.md)).
- **One Vue for everyone.** `vue` is "external" in the module build and
  resolved to the host's copy through an import map. Never add Vue to
  `dependencies`.

## 2. A single-file component

A `.vue` file has up to three blocks ([SFC](https://vuejs.org/guide/scaling-up/sfc.html)):

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";

const ready = ref(false);                 // reactive state
onMounted(() => { ready.value = true; }); // runs when the component is in the page
</script>

<template>
  <a-entity :visible="ready">
    <a-entity gltf-model="#statue"></a-entity>
  </a-entity>
</template>

<!-- <style> — not loaded by the host, don't use it in a module -->
```

- **`<script setup lang="ts">`** — TypeScript that runs once when the
  component is created. Everything declared at its top level can be used
  in the template ([`<script setup>`](https://vuejs.org/api/sfc-script-setup.html)).
- **`<template>`** — the markup. Here: A-Frame tags plus HTML.
- **`<style>`** — CSS. The host only loads the JavaScript, so in a module
  style 2D elements inline (`style="…"` or `:style="…"`).

## 3. Template syntax you'll actually use

([template syntax](https://vuejs.org/guide/essentials/template-syntax.html))

| Syntax | Meaning | Example here |
|---|---|---|
| `attr="text"` | Plain attribute — passed to the element as written. Most A-Frame attributes are just this. | `gltf-model="#statue"` |
| `:attr="expr"` | Bind an attribute to a JavaScript expression; updates when the value changes. | `:visible="assetsLoaded"`, `:width="FOOTPRINT_WIDTH"`, `` :position="`0 ${height} 0`" `` |
| `v-if="expr"` | Only create the element when `expr` is true. | overlays, optional parts of a scene |
| `v-for="item in list"` (+ `:key`) | One element per item. | a row of entities from data |
| `@event="handler"` | React to a DOM event. | `@click="start"` on a 2D button |
| `{{ expr }}` | Insert text. | hint texts |
| `ref="name"` | Get the element itself in the script. | `ref="imageTargetEl"` |

A-Frame attributes take strings (`"property: value; …"`), so build them
with template strings when they depend on data.

## 4. State and reactivity

([reactivity fundamentals](https://vuejs.org/guide/essentials/reactivity-fundamentals.html))

```ts
import { ref, computed, watch } from "vue";

const loaded = ref(0);                                   // read/write with .value in the script
const total = 12;
const progress = computed(() => loaded.value / total);  // derived, updates by itself
watch(progress, (p) => { if (p === 1) console.log("all there"); });
```

In the template you write `loaded`, not `loaded.value`. Change a `ref`,
and every place that uses it updates. Use this for things that change
*occasionally* (loaded, started, chosen); not for per-frame values.

## 5. Lifecycle

([lifecycle hooks](https://vuejs.org/guide/essentials/lifecycle.html))

```ts
import { onMounted, onUnmounted } from "vue";

onMounted(() => {
  // the template's elements exist now: query them, add listeners
  document.querySelector("a-scene")?.addEventListener("xrimagefound", onFound);
});
onUnmounted(() => {
  // the host removed the module: undo what onMounted did
  document.querySelector("a-scene")?.removeEventListener("xrimagefound", onFound);
});
```

`onUnmounted` matters: the host swaps modules in a running scene, so
anything you add to the scene, `window` or `document` must be removed
again.

## 6. Props, child components, the `arModule` prop

- **Props** are a component's inputs ([props](https://vuejs.org/guide/components/props.html)).
  The host passes one to every module: `arModule` (the database record —
  title, author, location, …). `ArModule.vue` declares it with
  `defineProps<{ arModule: ArModuleData }>()` — keep that line.
- **Child components**: import another `.vue` file and use it as a tag —
  e.g. the template's 2D overlay:
  ```ts
  import ArOverlay from "./ArOverlay.vue";
  ```
  ```html
  <ArOverlay place-target="scene-root" :controls="controls" recenter-button />
  ```
  ([AR Overlay guide](../guides/AR-OVERLAY-FEATURE-GUIDE.md))

## 7. Vue and A-Frame tags

Vue would normally look for a Vue component called `a-entity`. The
template configures Vue to treat every tag starting with `a-` (and
`xrextras-`) as a custom element instead ([Vue and web components](https://vuejs.org/guide/extras/web-components.html),
`isCustomElement` in `vite.config.ts` and `lib/preview*.ts`) — so A-Frame
tags pass through untouched. Two consequences:

- Vue creates and removes A-Frame elements (`v-if`, `v-for`); A-Frame
  initialises them when they appear and cleans up when they go.
- Vue doesn't know about A-Frame's components. To react to a model
  loading, listen for A-Frame's events (`@model-loaded="…"` on the entity,
  or `addEventListener` in `onMounted`).

## 8. Checking your code

- `npm run build` runs `vue-tsc` first — it type-checks the `.vue` files
  and stops with an error message before anything is built.
- Errors at runtime appear in the browser console; Vue's own warnings
  start with `[Vue warn]`.
- A warning about `compilerOptions ... runtime-only build` in the console
  is expected and harmless here.

## Further reading (official)

- [Introduction](https://vuejs.org/guide/introduction.html), [quick start](https://vuejs.org/guide/quick-start.html)
- [Template syntax](https://vuejs.org/guide/essentials/template-syntax.html), [reactivity](https://vuejs.org/guide/essentials/reactivity-fundamentals.html), [lifecycle](https://vuejs.org/guide/essentials/lifecycle.html)
- [`<script setup>`](https://vuejs.org/api/sfc-script-setup.html), [TypeScript with Vue](https://vuejs.org/guide/typescript/composition-api.html)
