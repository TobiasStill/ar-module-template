// Icons for ArOverlay.vue, inlined as SVG strings so the overlay can render
// them without shipping them as manifest assets (everything in src/assets/
// is injected into the host's <a-assets>) and without extra build config for
// raw imports. White strokes/fills, for use over the camera image.
//
// Taken from the old Augmented Bahnhofsviertel 8th Wall projects' UI
// (byte-identical in all 17 of them).

// x.svg and tap-on-cursor-icon.svg are byte-identical in all 17 projects too.
export const X_ICON = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"17.722\" height=\"17.722\" viewBox=\"0 0 17.722 17.722\">\n  <g id=\"Komponente_5_9\" data-name=\"Komponente 5 \u2013 9\" transform=\"translate(0.707 0.707)\">\n    <line id=\"Linie_8\" data-name=\"Linie 8\" x2=\"16.308\" y2=\"16.308\" fill=\"none\" stroke=\"#fff\" stroke-miterlimit=\"10\" stroke-width=\"2\"/>\n    <line id=\"Linie_9\" data-name=\"Linie 9\" y1=\"16.308\" x2=\"16.308\" fill=\"none\" stroke=\"#fff\" stroke-miterlimit=\"10\" stroke-width=\"2\"/>\n  </g>\n</svg>";
export const TAP_ON_CURSOR_ICON = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"151\" viewBox=\"0 0 200 151\">\n  <g id=\"Gruppe_121\" data-name=\"Gruppe 121\" transform=\"translate(-95 -296)\">\n    <g id=\"TapOnCursor\" transform=\"translate(152.824 319.08)\">\n      <g id=\"Ellipse_11\" data-name=\"Ellipse 11\" transform=\"translate(0 74.92)\" fill=\"none\" stroke=\"#fff\" stroke-width=\"3\">\n        <ellipse cx=\"38\" cy=\"15\" rx=\"38\" ry=\"15\" stroke=\"none\"/>\n        <ellipse cx=\"38\" cy=\"15\" rx=\"36.5\" ry=\"13.5\" fill=\"none\"/>\n      </g>\n      <path id=\"Pfad_91\" data-name=\"Pfad 91\" d=\"M15.789,42.438v-1.59c0-10.839-.015-21.678.018-32.517a11.69,11.69,0,0,1,.471-3.416A6.78,6.78,0,0,1,23.038.006a7,7,0,0,1,6.4,5.426,10.726,10.726,0,0,1,.281,2.49c.026,4.517.012,9.033.012,13.7,4.718-1.984,8.106-.557,10.348,3.936a7.2,7.2,0,0,1,6.564-.083,7.353,7.353,0,0,1,4.01,5.235c.712-.139,1.326-.314,1.951-.373,4.111-.384,7.242,2.406,7.3,6.737.094,6.677.247,13.366-.074,20.028a34.3,34.3,0,0,1-2.152,8.937c-1.516,4.546-3.3,9.005-5.027,13.479a1.474,1.474,0,0,1-1.087.773c-10.919.042-21.838.032-32.757.042-.6,0-.958-.124-1.066-.809C16.094,69.041,11.18,59.979,5.427,51.28,3.9,48.98,2.437,46.644.96,44.315a5.042,5.042,0,0,1,3.151-7.959,7.685,7.685,0,0,1,7.937,2.073C13.231,39.669,14.387,40.934,15.789,42.438Z\" transform=\"translate(60.21 98.176) rotate(-155)\" fill=\"#fff\"/>\n    </g>\n    <rect id=\"Rechteck_36\" data-name=\"Rechteck 36\" width=\"200\" height=\"151\" transform=\"translate(95 296)\" fill=\"none\"/>\n  </g>\n</svg>";

export const RECENTER_ICON = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"40\" height=\"40\" viewBox=\"0 0 40 40\">\n  <g id=\"recenter\" transform=\"translate(-42 -164.89)\">\n    <path id=\"Pfad_94\" data-name=\"Pfad 94\" d=\"M60.281,164.89h3.437v5.055a15,15,0,0,1,13.227,13.226H82v3.438H76.945a15,15,0,0,1-13.226,13.227v5.055H60.281v-5.056a15,15,0,0,1-13.227-13.226H42v-3.437h5.055a15,15,0,0,1,13.226-13.227Zm1.726,32.435a12.537,12.537,0,0,0,12.408-11.531A12.406,12.406,0,0,0,53.567,175.8a12.436,12.436,0,0,0,8.44,21.524Z\" transform=\"translate(0 0)\" fill=\"#fff\"/>\n    <path id=\"Pfad_95\" data-name=\"Pfad 95\" d=\"M218.824,348.4a6.667,6.667,0,1,1,6.665-6.551A6.636,6.636,0,0,1,218.824,348.4Z\" transform=\"translate(-156.831 -156.832)\" fill=\"#fff\"/>\n  </g>\n</svg>";

/**
 * A filled button label for inside a control's `html` (e.g. a hint text plus
 * a "Start" button underneath), inline-styled — class styles can't reach the
 * host (a module's <style> block is never loaded there). `background` is any
 * CSS colour; the default is the Augmented Bahnhofsviertel blue.
 */
export function actionButtonHtml(label: string, background = "#1d1eff"): string {
  return `<div style="padding: .5em; background: ${background}; margin-top: .5em;">${label}</div>`;
}
