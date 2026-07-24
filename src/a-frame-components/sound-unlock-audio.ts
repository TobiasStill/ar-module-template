declare const THREE: any;

// Browsers (iOS Safari in particular) refuse to start/resume a Web Audio
// context except from inside a real user-gesture handler. Call this
// synchronously from inside such a handler, before starting any playback —
// see sound-button.ts (3D tap) and sound-controller.ts (the 2D GUI panel's
// restartActive/togglePlayPause). Once resumed, the context stays resumed
// for the rest of the session.
//
// ctx.resume() alone isn't sufficient on iPhone specifically: iOS's hardware
// Ring/Silent switch mutes Web Audio API output independently of the
// autoplay-gesture policy above, even once the context reports "running" —
// a device-level behavior most iPads don't have (no physical switch), which
// is why code can pass on iPad and stay silent on iPhone. Safari 17+
// exposes an explicit opt-out (navigator.audioSession); older Safari has
// none, so as a fallback this also plays one real, silent HTMLMediaElement
// from inside the same gesture — that flips the page's iOS audio session
// into the category that ignores the switch, and the flip persists for the
// rest of the session, including for subsequent Web Audio API playback.
let silentUnlockEl: HTMLAudioElement | null = null;

// A ~0.2s silent WAV, built at runtime rather than checked in as a base64
// blob. Its only job is to be a *real* HTMLMediaElement play() call inside
// the unlock gesture — content is inaudible either way.
function createSilentUnlockAudio(): HTMLAudioElement {
  const sampleRate = 8000;
  const numSamples = Math.round(sampleRate * 0.2);
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate (1 byte/sample, mono)
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, numSamples, true);
  new Uint8Array(buffer, 44, numSamples).fill(128); // 128 = silence, unsigned 8-bit PCM
  const url = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return new Audio(url);
}

export function unlockAudio(): void {
  const ctx = THREE.AudioContext.getContext();
  if (ctx.state === "suspended") ctx.resume();

  // Wrapped in try/catch: older Safari that lacks the API entirely is
  // handled by the `"audioSession" in navigator` guard, but a Safari
  // version that has the property yet rejects "playback" as a value would
  // otherwise throw and skip the HTMLMediaElement fallback below too.
  if ("audioSession" in navigator) {
    try {
      (navigator as any).audioSession.type = "playback";
    } catch {
      // fall through to the HTMLMediaElement fallback below
    }
  }

  if (!silentUnlockEl) silentUnlockEl = createSilentUnlockAudio();
  silentUnlockEl.play().catch(() => {});
}
