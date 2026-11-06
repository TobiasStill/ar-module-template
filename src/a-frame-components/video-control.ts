import type { ComponentDefinition } from "aframe";

// Starts, pauses and unmutes a <video> asset from events — so a tap handler
// (e.g. an ArOverlay "Play" control) can start every video of a scene with
// one dispatch, inside the gesture iOS requires.
//
//   <a-entity geometry="primitive: plane; width: 1.6; height: 0.9"
//             material="src: #my-video; shader: flat" video-control="video: #my-video"></a-entity>
//   <a-videosphere src="#pano" video-control="video: #pano; muted: false"></a-videosphere>
//
//   // in a tap handler:
//   sceneEl.emit("video-play");          // every video-control in the scene
//   entity.emit("video-play");           // just this one
//
// Listens for `playOn` (default `video-play`) and `pauseOn` (`video-pause`)
// on its own entity and on the scene. On play it sets the element's `muted`
// to the `muted` attribute first — the host (and the previews) inject every
// video asset muted, so a video with sound must be unmuted here — then calls
// play(). Called synchronously from a tap that dispatches the event, this
// counts as the user gesture on iOS. `autoplay` starts it on init instead
// (only works muted). With `pauseWhenHidden` it pauses while the page is in
// the background and resumes after, if it was playing. Emits `video-started`
// on the entity once playback runs, or `video-blocked` if the browser
// refused (e.g. unmuted without a gesture).
//
// Generalised from the Augmented Bahnhofsviertel ports (augmented-
// bahnhofsviertel: #7, #22–24 started their videos from the PLAY/Start tap;
// #23 unmuted only video 1).
export default {
  multiple: true,
  schema: {
    video: { type: "selector" },
    muted: { type: "boolean", default: true },
    loop: { type: "boolean", default: true },
    autoplay: { type: "boolean", default: false },
    playOn: { type: "string", default: "video-play" },
    pauseOn: { type: "string", default: "video-pause" },
    pauseWhenHidden: { type: "boolean", default: true }
  },

  init() {
    const self = this as any;
    self.resumeOnShow = false;
    self.onPlay = () => self.startVideo();
    self.onPause = () => self.data.video?.pause();
    self.onVisibility = () => {
      const video = self.data.video as HTMLVideoElement | null;
      if (!video || !self.data.pauseWhenHidden) return;
      if (document.visibilityState === "hidden") {
        self.resumeOnShow = !video.paused;
        video.pause();
      } else if (self.resumeOnShow) {
        self.resumeOnShow = false;
        video.play().catch(() => {});
      }
    };
    self.listen(true);
    document.addEventListener("visibilitychange", self.onVisibility);
    if (self.data.autoplay) self.startVideo();
  },

  update(oldData: any) {
    const self = this as any;
    if (oldData && (oldData.playOn !== self.data.playOn || oldData.pauseOn !== self.data.pauseOn)) {
      self.listen(false, oldData);
      self.listen(true);
    }
  },

  listen(on: boolean, data?: any) {
    const self = this as any;
    const d = data ?? self.data;
    const method = on ? "addEventListener" : "removeEventListener";
    for (const target of [self.el, self.el.sceneEl]) {
      if (!target) continue;
      target[method](d.playOn, self.onPlay);
      target[method](d.pauseOn, self.onPause);
    }
  },

  // Not `play()`: that's A-Frame's component lifecycle hook (called when the
  // entity starts playing) — naming this play would start every video on
  // scene start.
  startVideo() {
    const self = this as any;
    const video = self.data.video as HTMLVideoElement | null;
    if (!video) return;
    video.loop = self.data.loop;
    video.muted = self.data.muted;
    video.play()
      .then(() => self.el.emit("video-started", { video }, false))
      .catch(() => self.el.emit("video-blocked", { video }, false));
  },

  remove() {
    const self = this as any;
    self.listen(false);
    document.removeEventListener("visibilitychange", self.onVisibility);
    self.data.video?.pause();
  }
} as ComponentDefinition;
