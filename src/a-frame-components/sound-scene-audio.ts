// Helpers for a module's plain A-Frame `sound` entities (not components, so
// not registered): start them all from one tap, pause them while the page is
// hidden, and keep positional sound distances proportional inside a scaled
// scene. Part of the Sound feature; complements sound-button /
// sound-controller (tap-to-play per button) for scenes whose sounds simply
// start together after one "Start/Play" tap.
//
// Generalised from the Augmented Bahnhofsviertel ports
// (augmented-bahnhofsviertel: legacy-audio.ts, and legacy-space's sound
// scaling).
import { unlockAudio } from "./sound-unlock-audio";

// A-Frame's component-level `isPlaying` is the component's lifecycle state
// (entity playing/paused), not audio playback — whether a sound is audible
// is on its pooled THREE.Audio objects.
function isAudible(sound: any): boolean {
  return (sound.pool?.children ?? []).some((audio: any) => audio.isPlaying);
}

function soundComponents(root: Element): any[] {
  return Array.from(root.querySelectorAll("[sound]"))
    .map((el) => (el as any).components?.sound)
    .filter(Boolean);
}

/**
 * Unlocks audio and starts every `sound` entity under `root`. Call it
 * synchronously inside a tap handler (e.g. an ArOverlay "Play" control's
 * onClick) — the unlock needs the user gesture (iOS autoplay policy and
 * Ring/Silent switch, see sound-unlock-audio.ts).
 */
export function playSounds(root: Element): void {
  unlockAudio();
  soundComponents(root).forEach((sound) => sound.playSound());
}

/**
 * Pauses the sounds under `root` while the page is hidden and resumes them
 * when it's visible again — only the ones that were actually playing (not
 * every sound in the document). Returns a teardown; call it on unmount.
 */
export function pauseSoundsWhileHidden(root: Element): () => void {
  let paused: any[] = [];
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      paused = soundComponents(root).filter(isAudible);
      paused.forEach((sound) => sound.pauseSound());
    } else {
      paused.forEach((sound) => sound.playSound());
      paused = [];
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  return () => document.removeEventListener("visibilitychange", onVisibility);
}

/**
 * Multiplies refDistance/maxDistance of every positional `sound` under
 * `root` by `scale` (from each sound's own attribute values, so repeated
 * calls don't compound). three.js keeps PannerNode distances in world
 * units; inside a scene scaled by `scale` a sound authored as "fades out
 * within 10 units" would otherwise carry 1/scale times as far. Applied to
 * the pooled PositionalAudio objects, not via setAttribute, which would
 * rebuild the pool and stop a playing sound. Sounds still loading aren't
 * covered — call again on their `sound-loaded`.
 */
export function scaleSoundDistances(root: Element, scale: number): void {
  soundComponents(root).forEach((sound) => {
    if (!sound.data?.positional) return;
    (sound.pool?.children ?? []).forEach((audio: any) => {
      if (!audio.setRefDistance) return;
      audio.setRefDistance(sound.data.refDistance * scale);
      audio.setMaxDistance(sound.data.maxDistance * scale);
    });
  });
}
