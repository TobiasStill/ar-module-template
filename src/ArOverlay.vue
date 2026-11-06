<script lang="ts">
// One control in the overlay's centre column. `html` is trusted, static
// markup written by the module author (a label, an inline <svg> icon, or
// actionButtonHtml() from ar-overlay-icons.ts). The control disappears once
// tapped unless `keep`. `variant: "hint"` adds a close (x) icon top right — a
// tap anywhere on it dismisses it.
export interface ArOverlayControl {
  id: string;
  html: string;
  onClick?: () => void;
  keep?: boolean;
  variant?: "action" | "hint";
}
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { RECENTER_ICON, X_ICON } from "./ar-overlay-icons";

// A module's 2D UI over the AR view: a centre column of controls (a hint
// text, a "Start"/"Play" button, an audio/video unlock button, …) and an
// optional recenter button. Inline styles only — a <style> block in a module
// never reaches the host (README "Caveats").
//
//   <ArOverlay place-target="my-scene" :controls="controls" recenter-button :ready="assetsLoaded" />
//
// placeTarget (optional): the id of an entity with `place-in-front`. The
// overlay then appears only once that entity has been placed, and the
// recenter button re-places it (`place-in-front-place`) — only this module,
// never the shared XR8 world. Without placeTarget the overlay shows as soon
// as `ready` and the recenter button only emits `recenter`.
//
// The recenter button sits 64px from the top right: the host app's own
// recalibrate-north button is fixed at top/right 16px (ArScene.vue in
// ar-demo-backend) and would otherwise be covered.
//
// Generalised from augmented-bahnhofsviertel's LegacyOverlay.vue (the old
// 8th Wall projects' ui.js/ui.css look: white bold uppercase Arial over the
// camera image).
const props = withDefaults(
  defineProps<{
    controls?: ArOverlayControl[];
    placeTarget?: string;
    recenterButton?: boolean;
    ready?: boolean;
  }>(),
  { controls: () => [], placeTarget: "", recenterButton: false, ready: true }
);
const emit = defineEmits<{ recenter: [] }>();

const placed = ref(!props.placeTarget);
const dismissed = ref<string[]>([]);
let target: HTMLElement | null = null;
const onPlaced = () => { placed.value = true; };

onMounted(() => {
  if (!props.placeTarget) return;
  target = document.getElementById(props.placeTarget);
  if ((target as any)?.components?.["place-in-front"]?.placed) placed.value = true;
  target?.addEventListener("place-in-front-placed", onPlaced);
});

onUnmounted(() => {
  target?.removeEventListener("place-in-front-placed", onPlaced);
});

const visible = computed(() => props.ready && placed.value);
const centerControls = computed(() => props.controls.filter((c) => !dismissed.value.includes(c.id)));

function tap(control: ArOverlayControl) {
  control.onClick?.();
  if (!control.keep) dismissed.value = [...dismissed.value, control.id];
}

function recenter() {
  target?.dispatchEvent(new CustomEvent("place-in-front-place"));
  emit("recenter");
}

const centerColumnStyle = {
  position: "fixed" as const,
  width: "200px",
  top: "30%",
  left: "calc(50% - 100px)",
  zIndex: "1000"
};
const centerButtonStyle = {
  display: "block",
  width: "100%",
  boxSizing: "border-box" as const,
  marginBottom: "1em",
  padding: "0",
  background: "transparent",
  border: "none",
  outline: "none",
  color: "#fff",
  fontFamily: "arial, sans-serif",
  fontSize: "18px",
  fontWeight: "bold",
  textTransform: "uppercase" as const,
  textAlign: "center" as const,
  cursor: "pointer"
};
const hintButtonStyle = { ...centerButtonStyle, position: "relative" as const, paddingTop: "1.75em" };
const hintCloseStyle = {
  position: "absolute" as const,
  top: "0.5em",
  right: "0.5em",
  lineHeight: "0"
};
const topRightStyle = {
  position: "fixed" as const,
  top: "64px",
  right: "15px",
  zIndex: "1000"
};
const recenterButtonStyle = {
  display: "inline-block",
  width: "40px",
  height: "40px",
  padding: "0",
  background: "transparent",
  border: "none",
  outline: "none",
  cursor: "pointer",
  lineHeight: "0"
};
</script>

<template>
  <div v-if="visible && centerControls.length" :style="centerColumnStyle">
    <template v-for="control in centerControls" :key="control.id">
      <button
          v-if="control.variant === 'hint'"
          type="button"
          :style="hintButtonStyle"
          @click="tap(control)"
      >
        <span :style="hintCloseStyle" v-html="X_ICON"></span>
        <span v-html="control.html"></span>
      </button>
      <button
          v-else
          type="button"
          :style="centerButtonStyle"
          @click="tap(control)"
          v-html="control.html"
      ></button>
    </template>
  </div>
  <div v-if="visible && recenterButton" :style="topRightStyle">
    <button type="button" :style="recenterButtonStyle" aria-label="Recenter" @click="recenter" v-html="RECENTER_ICON"></button>
  </div>
</template>
