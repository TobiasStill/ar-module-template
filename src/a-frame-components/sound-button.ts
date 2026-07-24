import type { ComponentDefinition } from "aframe";

// Audio behavior for one [ar-button] — play/pause/resume/stop a `sound`
// entity. Place on the SAME entity as [ar-button] (which owns the trigger
// zone, gaze raycast eligibility, pulse, and distance fade — see
// ar-button.ts): this component only reacts to the "ar-button-tap" event
// ar-button-manager routes to that shared element, and coordinates with the
// nearest ancestor [sound-controller] (normally the module root) so only
// one sound ever plays module-wide. Knows nothing about raycasting.
export default {
  schema: {
    sound: { type: "selector" }
  },

  init() {
    const self = this as any;
    const controllerEl = self.el.closest("[sound-controller]");
    self.controller = controllerEl ? controllerEl.components["sound-controller"] : null;
    if (!self.controller) console.warn("[sound-button] no ancestor [sound-controller] found; tap disabled");

    self.onTap = () => {
      if (self.controller) self.controller.handleTap(self);
    };
    self.el.addEventListener("ar-button-tap", self.onTap);

    // The sound component's own onended handler nulls itself out on a
    // programmatic pauseSound()/stopSound(), so "sound-ended" only fires
    // here when the clip runs to its own end — the natural-finish signal
    // the controller needs to release this button back to idle.
    self.onSoundEnded = () => {
      if (self.controller) self.controller.release(self);
    };
    if (self.data.sound) self.data.sound.addEventListener("sound-ended", self.onSoundEnded);
  },

  remove() {
    const self = this as any;
    self.el.removeEventListener("ar-button-tap", self.onTap);
    if (self.data.sound) self.data.sound.removeEventListener("sound-ended", self.onSoundEnded);
    if (self.controller) self.controller.release(self);
  },

  // Stops (resetting playback position) and plays from the top — used when
  // this button is tapped while idle, or while a *different* button's sound
  // is playing/paused.
  playFromStart() {
    const self = this as any;
    const soundComp = self.getSoundComponent();
    if (!soundComp) return;
    soundComp.stopSound();
    soundComp.playSound();
  },

  // Named pauseAudio (not `pause`) because `pause`/`play` are reserved
  // A-Frame component lifecycle method names — A-Frame wraps whatever you
  // assign to them to also deregister the component from the scene's tick
  // loop when called, which would silently break anything this component
  // ticked. pauseSound()/playSound() (not stopSound()) preserve the pool
  // member's internal playback offset, so a later playSound() call resumes
  // rather than restarting.
  pauseAudio() {
    const self = this as any;
    self.getSoundComponent()?.pauseSound();
  },

  resume() {
    const self = this as any;
    self.getSoundComponent()?.playSound();
  },

  stop() {
    const self = this as any;
    self.getSoundComponent()?.stopSound();
  },

  getSoundComponent() {
    const self = this as any;
    const soundEl = self.data.sound;
    const soundComp = soundEl && soundEl.components && soundEl.components.sound;
    if (!soundComp) console.warn("[sound-button] no sound component on target entity", soundEl);
    return soundComp;
  }
} as ComponentDefinition;
