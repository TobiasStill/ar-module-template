import type { ComponentDefinition } from "aframe";
import { unlockAudio } from "./sound-unlock-audio";

// Single-active-sound state machine for every [sound-button] in the module,
// mounted once on the module root — alongside [ar-button-manager], which
// handles the actual gaze raycast/tap detection generically (see
// ar-button.ts, ar-button-manager.ts). Only one sound ever plays module-wide,
// no matter how many sound-buttons exist:
//
//   - tap the button whose sound is playing   → pause it
//   - tap that same button again (now paused) → resume it
//   - tap any *other* button                  → stop the current one, play
//                                                the new one from the top
//   - a clip finishes on its own (no loop)     → back to idle
//
// The 2D GUI panel (see examples/sound-gui-panel.html) drives restartActive/
// togglePlayPause/stopActive directly, regardless of gaze — always acting on
// whichever button is currently active, since only one ever is.
export default {
  init() {
    const self = this as any;
    self.activeButton = null;
    self.activeStatus = "idle"; // "idle" | "playing" | "paused"
  },

  remove() {
    (this as any).activeButton = null;
  },

  // Called by a [sound-button] when its "ar-button-tap" listener fires.
  handleTap(button: any) {
    const self = this as any;
    unlockAudio();

    if (self.activeButton === button) {
      if (self.activeStatus === "playing") {
        button.pauseAudio();
        self.activeStatus = "paused";
      } else {
        button.resume();
        self.activeStatus = "playing";
      }
      self.notifyStateChange();
      return;
    }

    if (self.activeButton) self.activeButton.stop();
    button.playFromStart();
    self.activeButton = button;
    self.activeStatus = "playing";
    self.notifyStateChange();
  },

  // Fired by a sound-button when its sound reaches the end on its own (no
  // loop), or when it's removed from the DOM while active — release it back
  // to idle so any button can be tapped fresh, matching a user-initiated
  // stop/switch.
  release(button: any) {
    const self = this as any;
    if (self.activeButton === button) {
      self.activeButton = null;
      self.activeStatus = "idle";
      self.notifyStateChange();
    }
  },

  restartActive() {
    const self = this as any;
    if (!self.activeButton) return;
    unlockAudio();
    self.activeButton.playFromStart();
    self.activeStatus = "playing";
    self.notifyStateChange();
  },

  togglePlayPause() {
    const self = this as any;
    if (!self.activeButton) return;
    if (self.activeStatus === "playing") {
      self.activeButton.pauseAudio();
      self.activeStatus = "paused";
    } else {
      unlockAudio();
      self.activeButton.resume();
      self.activeStatus = "playing";
    }
    self.notifyStateChange();
  },

  stopActive() {
    const self = this as any;
    if (!self.activeButton) return;
    self.activeButton.stop();
    self.activeButton = null;
    self.activeStatus = "idle";
    self.notifyStateChange();
  },

  // Bridges to the Vue-rendered 2D GUI, which lives outside A-Frame/three.js
  // entirely and so can't just read this component's state directly.
  notifyStateChange() {
    const self = this as any;
    self.el.emit("sound-state-changed", { status: self.activeStatus }, false);
  }
} as ComponentDefinition;
