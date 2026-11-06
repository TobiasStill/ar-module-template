import type { ComponentDefinition } from "aframe";

// Tap a model to play one of its glTF animations — once (it stays at the
// last frame, e.g. a shell opening) or every tap — and start the `sound` on
// the same entity with it.
//
//   <a-entity gltf-model="#shell" sound="src: #shell-sound; positional: true"
//             tap-animation="clip: open; once: true"></a-entity>
//
// The tap is the host's cursor `click` on `.cantap` (the class is added
// here; the host's and the previews' raycaster hit `.cantap`). The animation
// runs through aframe-extras' `animation-mixer` (loaded by the host and the
// previews), set on tap with `clip`, `loop` and `clampWhenFinished`.
// `enabled: false` ignores taps until it's set true — e.g. only after an
// audio-unlock button, so the first tap doesn't play a silent animation.
// With `once` only the first (enabled) tap plays; otherwise every tap
// restarts the animation. Emits `tap-animation-played` on each play.
//
// Generalised from #20 Solid Dream Level (augmented-bahnhofsviertel: eight
// shells that open once on tap and play their sound, after PLAY unlocked
// audio).
export default {
  schema: {
    clip: { type: "string", default: "*" },
    loop: { default: "once", oneOf: ["once", "repeat", "pingpong"] },
    clampWhenFinished: { type: "boolean", default: true },
    once: { type: "boolean", default: true },
    sound: { type: "boolean", default: true },
    enabled: { type: "boolean", default: true }
  },

  init() {
    const self = this as any;
    self.played = false;
    self.onClick = () => {
      const d = self.data;
      if (!d.enabled || (d.once && self.played)) return;
      self.played = true;
      // Re-setting the attribute restarts the mixer from the first frame.
      self.el.removeAttribute("animation-mixer");
      self.el.setAttribute("animation-mixer", {
        clip: d.clip,
        loop: d.loop,
        clampWhenFinished: d.clampWhenFinished
      });
      if (d.sound) {
        const sound = self.el.components.sound;
        sound?.stopSound();
        sound?.playSound();
      }
      self.el.emit("tap-animation-played", null, false);
    };
    self.el.addEventListener("click", self.onClick);
    self.el.classList.add("cantap");
  },

  remove() {
    const self = this as any;
    self.el.removeEventListener("click", self.onClick);
  }
} as ComponentDefinition;
