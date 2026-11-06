import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { fileURLToPath, URL } from "node:url";
import { readdirSync, readFileSync, existsSync, statSync, renameSync, createReadStream } from "node:fs";
import { join, parse, extname, sep } from "node:path";
import { usedComponents } from "./scripts/used-components";
import { devQrCode } from "./scripts/dev-qr-code";

const ASSETS_SRC = fileURLToPath(new URL("./src/assets", import.meta.url));
// Image-target files (the JSON + its *_luminance/_cropped/… images) produced by
// the 8th Wall target tool. The engine loads each target's `imagePath` as an
// <img src>, so these must be served at /image-targets/* (dev) and shipped under
// dist/image-targets/ (build) for detection to work.
const IMAGE_TARGETS_SRC = fileURLToPath(new URL("./src/image-targets", import.meta.url));
const VIRTUAL_MANIFEST_ID = "virtual:ar-manifest";
const RESOLVED_MANIFEST_ID = "\0" + VIRTUAL_MANIFEST_ID;

const MIME: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".bin": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4"
};

interface ManifestAsset { id: string; src: string }

/** Scan src/assets and derive a manifest entry per file. The file name (without
 *  extension) is used as the A-Frame asset id, e.g. `model.glb` → id `model`,
 *  served/hosted at `assets/model.glb`. */
function readAssets(): { entry: ManifestAsset; file: string }[] {
  if (!existsSync(ASSETS_SRC)) return [];
  return readdirSync(ASSETS_SRC)
    .filter((f) => !f.startsWith(".") && statSync(join(ASSETS_SRC, f)).isFile())
    .map((file) => ({
      entry: { id: parse(file).name, src: `assets/${file}` },
      file
    }));
}

function buildManifest() {
  return { assets: readAssets().map((a) => a.entry), components: [] as string[] };
}

/** Flat list of every file under src/image-targets/ (json + images). */
function readImageTargetFiles(): string[] {
  if (!existsSync(IMAGE_TARGETS_SRC)) return [];
  return readdirSync(IMAGE_TARGETS_SRC).filter(
    (f) => !f.startsWith(".") && statSync(join(IMAGE_TARGETS_SRC, f)).isFile()
  );
}

/**
 * Serve a static directory at a URL prefix from a Connect middleware stack.
 * Honours HTTP `Range` requests (206 + `Content-Range`): iOS/Safari refuses to
 * play a `<video>`/`<audio>` source that isn't served with range support, so
 * without this a video asset silently fails in the preview on iPhone —
 * the primary AR test device. Files are streamed, not buffered whole.
 */
function serveDir(server: any, prefix: string, root: string) {
  server.middlewares.use((req: any, res: any, next: any) => {
    const url = (req.url || "").split("?")[0];
    if (!url.startsWith(prefix)) return next();
    const file = join(root, decodeURIComponent(url.slice(prefix.length)));
    // Confine to `root`. Compare against `root + separator` so a sibling dir with
    // a matching prefix (e.g. `<root>-secret`) can't slip past a bare startsWith.
    if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) return next();

    const size = statSync(file).size;
    res.setHeader("Content-Type", MIME[extname(file).toLowerCase()] ?? "application/octet-stream");
    // Advertise range support so Safari/iOS issues byte-range requests for media.
    res.setHeader("Accept-Ranges", "bytes");

    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (match) {
      const [, rawStart, rawEnd] = match;
      // "bytes=-N" (suffix) asks for the last N bytes; otherwise start-[end].
      let start = rawStart === "" ? size - Number(rawEnd) : Number(rawStart);
      let end = rawStart === "" ? size - 1 : rawEnd === "" ? size - 1 : Number(rawEnd);
      start = Math.max(0, start);
      end = Math.min(end, size - 1);
      if (start > end || Number.isNaN(start) || Number.isNaN(end)) {
        res.statusCode = 416; // Range Not Satisfiable
        res.setHeader("Content-Range", `bytes */${size}`);
        res.end();
        return;
      }
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Content-Length", end - start + 1);
      createReadStream(file, { start, end }).pipe(res);
      return;
    }

    res.setHeader("Content-Length", size);
    createReadStream(file).pipe(res);
  });
}

/**
 * Makes module assets in `src/assets/` available everywhere:
 * - exposes the derived manifest via the `virtual:ar-manifest` module
 * - serves `/assets/*` from `src/assets` during `vite dev` (preview)
 * - on build, copies each asset into `dist/assets/` and writes `dist/manifest.json`
 */
/**
 * Automatic A-Frame component registration: `virtual:used-components` imports
 * exactly the components in src/a-frame-components/ that the module uses
 * (file name = component name; see scripts/used-components.ts) and exports
 * them as { name: definition } — src/manifest.ts spreads that into
 * `components`. Unused components are neither bundled nor registered.
 * The dev server recomputes the list when a file in src/ is added, removed
 * or changed, and reloads the page if it changed.
 */
const USED_COMPONENTS_ID = "virtual:used-components";
const RESOLVED_USED_COMPONENTS_ID = "\0" + USED_COMPONENTS_ID;
function autoComponents() {
  const srcDir = fileURLToPath(new URL("./src", import.meta.url));
  const listKey = () => [...usedComponents(srcDir).keys()].join(",");
  let lastKey = "";
  return {
    name: "used-components",
    resolveId(id: string) {
      if (id === USED_COMPONENTS_ID) return RESOLVED_USED_COMPONENTS_ID;
    },
    load(id: string) {
      if (id !== RESOLVED_USED_COMPONENTS_ID) return;
      const used = usedComponents(srcDir);
      lastKey = [...used.keys()].join(",");
      const entries = [...used];
      return [
        ...entries.map(([, file], i) => `import c${i} from ${JSON.stringify(file)};`),
        `export const usedComponents = {`,
        ...entries.map(([name], i) => `  ${JSON.stringify(name)}: c${i},`),
        `};`,
        `export default usedComponents;`
      ].join("\n");
    },
    configureServer(server: any) {
      const onChange = (file: string) => {
        if (!file.startsWith(srcDir) || !/\.(vue|ts)$/.test(file)) return;
        if (listKey() === lastKey) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_USED_COMPONENTS_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", onChange);
      server.watcher.on("unlink", onChange);
      server.watcher.on("change", onChange);
    }
  };
}

function arModuleAssets() {
  return {
    name: "ar-module-assets",

    resolveId(id: string) {
      if (id === VIRTUAL_MANIFEST_ID) return RESOLVED_MANIFEST_ID;
    },

    load(id: string) {
      if (id === RESOLVED_MANIFEST_ID) {
        return `export const manifest = ${JSON.stringify(buildManifest())};\nexport default manifest;`;
      }
    },

    // Preview / dev server: serve raw asset + image-target files.
    configureServer(server: any) {
      serveDir(server, "/assets/", ASSETS_SRC);
      serveDir(server, "/image-targets/", IMAGE_TARGETS_SRC);
    },

    // Library build: copy assets + image targets into dist and emit the manifest.
    generateBundle() {
      for (const { entry, file } of readAssets()) {
        // @ts-ignore — rollup plugin context
        this.emitFile({ type: "asset", fileName: entry.src, source: readFileSync(join(ASSETS_SRC, file)) });
      }
      for (const file of readImageTargetFiles()) {
        // @ts-ignore — rollup plugin context
        this.emitFile({
          type: "asset",
          fileName: `image-targets/${file}`,
          source: readFileSync(join(IMAGE_TARGETS_SRC, file))
        });
      }
      // @ts-ignore — rollup plugin context
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(buildManifest(), null, 2)
      });
    }
  };
}

/**
 * Three flavours, selected by command + `--mode ar`:
 *  - `vite`              → VR/desktop preview (stock A-Frame via CDN, index.html)
 *  - `vite --mode ar`    → 8th Wall AR preview (8frame + engine, ar.html, https)
 *  - `vite build`        → library build → dist/ar-module.js (consumed by the host)
 *  - `vite build --mode ar` → standalone AR app → dist-ar/ (deploy & test on device)
 */
export default defineConfig(async ({ command, mode }) => {
  const isAr = mode === "ar";
  const isLibBuild = command === "build" && !isAr;
  const isArBuild = command === "build" && isAr;

  const plugins: any[] = [
    vue({
      template: {
        compilerOptions: {
          // A-Frame primitives (a-*) and 8th Wall's xrextras components
          // (xrextras-*, e.g. xrextras-named-image-target) are custom elements,
          // not Vue components — otherwise the compiler emits resolveComponent()
          // and the element is dropped with "Failed to resolve component".
          isCustomElement: (tag) => tag.startsWith("a-") || tag.startsWith("xrextras-")
        }
      }
    }),
    arModuleAssets(),
    autoComponents()
  ];

  if (isAr) {
    // The AR preview lives at /ar.html, but a phone on the LAN opens the bare
    // network URL (https://<ip>:<port>/). Redirect / → /ar.html so it lands on
    // the AR page instead of the VR index.html. (The `--open /ar.html` flag only
    // opens the right path on the dev machine, not on the device.)
    plugins.push({
      name: "ar-index-redirect",
      configureServer(server: any) {
        server.middlewares.use((req: any, res: any, next: any) => {
          const url = (req.url || "").split("?")[0];
          if (url === "/" || url === "/index.html") {
            res.writeHead(302, { Location: "/ar.html" });
            res.end();
            return;
          }
          next();
        });
      }
    });

    // Prints a QR code of the network address for opening the preview on a phone.
    plugins.push(devQrCode());

    // Standalone AR build: emit the page as index.html (not ar.html) so serving
    // dist-ar/ resolves the AR app at the root. Renamed on disk after the bundle
    // is written (build-only — no effect on the dev server, which keeps serving
    // the ar.html source).
    plugins.push({
      name: "ar-html-as-index",
      writeBundle(options: any) {
        const dir = options.dir ?? "dist-ar";
        const from = join(dir, "ar.html");
        const to = join(dir, "index.html");
        if (existsSync(from)) renameSync(from, to);
      }
    });

    // WebAR needs a secure context (camera). localhost is exempt, but a phone on
    // the LAN needs https — enable it when the plugin is available.
    try {
      const basicSsl = (await import("@vitejs/plugin-basic-ssl")).default;
      plugins.push(basicSsl());
    } catch {
      /* optional: without it, use localhost or a tunnel for device testing */
    }
  }

  // Self-hosted runtime dependencies, copied from node_modules (served in dev,
  // emitted on build) so they're version-pinned via package.json instead of
  // fetched from a mutable/unversioned CDN URL:
  //  - xrextras: for every preview flavour (dev VR + dev:ar + build:ar). 8thwall's
  //    CDN only serves an unversioned `xrextras.js` that mutates in place, so we
  //    pin @8thwall/xrextras and host it locally. The library build doesn't need
  //    it — the host provides xrextras at runtime.
  //  - the 8th Wall engine (xr.js): AR only, exactly like the host app.
  //  - 8Frame (patched A-Frame): AR only. NOT the build at cdn.8thwall.com/web/
  //    aframe/ — that's a different, much smaller file for 8th Wall's classic
  //    commercial backend and throws "No valid session manager to handle this
  //    session" against @8thwall/engine-binary's session-manager protocol. The
  //    build that actually pairs with engine-binary isn't on npm; it ships only
  //    in the `external/scripts/` folder of 8th Wall's example projects (e.g.
  //    github.com/8thwall/aframe-world-effects-example), so it's vendored here
  //    instead of pinned via package.json.
  const copyTargets: { src: string; dest: string }[] = [];
  if (!isLibBuild) {
    copyTargets.push({ src: "node_modules/@8thwall/xrextras/dist/*", dest: "external/xrextras" });
  }
  if (isAr) {
    copyTargets.push({ src: "node_modules/@8thwall/engine-binary/dist/*", dest: "external/xr" });
    copyTargets.push({ src: "lib/vendor/8frame-1.5.0.min.js", dest: "external/scripts" });
  }
  if (copyTargets.length) {
    plugins.push(viteStaticCopy({ targets: copyTargets }));
  }

  return {
    // Relative asset URLs (./assets/…) in the standalone AR build so dist-ar/
    // can be served from any subdirectory, not just the domain root.
    base: isArBuild ? "./" : "/",
    plugins,
    server: isAr ? { host: true } : {},
    build: isAr
      ? {
          // Standalone AR app for on-device testing.
          outDir: "dist-ar",
          emptyOutDir: true,
          rollupOptions: {
            input: fileURLToPath(new URL("./ar.html", import.meta.url))
          }
        }
      : {
          // The library artifact the host platform loads.
          outDir: "dist-platform",
          lib: {
            entry: fileURLToPath(new URL("./lib/main.ts", import.meta.url)),
            formats: ["es"],
            fileName: () => "ar-module.js"
          },
          rollupOptions: {
            // `vue` stays a bare import in the emitted module. The host resolves
            // it via an import map to the single Vue instance it also uses, so
            // the module shares the host's runtime (no bundled second copy, no
            // hand-maintained re-export shim). See the host's index.html import
            // map and vite.config.ts.
            external: ["vue"],
            output: { inlineDynamicImports: true }
          },
          emptyOutDir: true
        }
  };
});