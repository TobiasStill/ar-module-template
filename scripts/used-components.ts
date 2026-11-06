// Which A-Frame components this module uses — the basis of automatic
// component registration (vite.config.ts → virtual:used-components →
// src/manifest.ts).
//
// Every file in src/a-frame-components/ with a default export is a
// component; its file name is the component name (`place-in-front.ts` →
// `place-in-front`). Files without a default export are helpers
// (`*-shared.ts`, `sound-unlock-audio.ts`, …) and are never registered.
//
// A component counts as used if its name appears — outside comments — in
// ArModule.vue or a file it (transitively) imports from src/ (e.g. an
// overlay component, a helper calling setAttribute), or in the source of a
// component that is already used (e.g. gesture-control sets hold-drag).
// Files in src/ that the module doesn't import (a feature's ArOverlay.vue
// sitting unused) don't count. Only used components are imported into the
// bundle and registered in the host — every extra name would compete with
// other modules in the shared host scene, where the first registration of a
// name wins.
//
// Over-inclusion (a name inside unrelated text) is harmless; a miss shows up
// in `npm run dev` / `dev:ar` already, since they use the same list. A name
// built at runtime (`"my-" + kind`) can't be found — register such a
// component by hand in src/manifest.ts.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const SOURCE_EXTENSIONS = ["", ".ts", ".vue", ".js"];

/**
 * ArModule.vue plus every file under src/ it imports, transitively
 * (relative imports only; src/a-frame-components/ is handled by
 * componentFiles and the transitive component scan).
 */
function moduleFiles(srcDir: string): string[] {
  const entry = join(srcDir, "ArModule.vue");
  if (!existsSync(entry)) return [];
  const componentsDir = join(srcDir, "a-frame-components");
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    const source = stripComments(readFileSync(file, "utf8"));
    for (const m of source.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)) {
      const base = resolve(dirname(file), m[1]);
      const target = SOURCE_EXTENSIONS.map((ext) => base + ext).find((f) => existsSync(f) && statSync(f).isFile());
      if (!target || seen.has(target) || !target.startsWith(srcDir) || target.startsWith(componentsDir)) continue;
      seen.add(target);
      queue.push(target);
    }
  }
  return [...seen];
}

/** Removes /* *\/, // line and <!-- --> comments (keeps `https://` in strings). */
export function stripComments(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

function mentions(source: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`).test(source);
}

/** name → file of every component file (default export) in src/a-frame-components/. */
export function componentFiles(srcDir: string): Map<string, string> {
  const dir = join(srcDir, "a-frame-components");
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    const file = join(dir, f);
    if (!f.endsWith(".ts") || f.endsWith(".d.ts") || !statSync(file).isFile()) continue;
    if (!/^export default\b/m.test(readFileSync(file, "utf8"))) continue;
    out.set(f.slice(0, -3), file);
  }
  return out;
}

/** The components the module uses: name → file, sorted by name. */
export function usedComponents(srcDir: string): Map<string, string> {
  const components = componentFiles(srcDir);
  const moduleSources = moduleFiles(srcDir)
    .filter((p) => !p.endsWith("manifest.ts"))
    .map((p) => stripComments(readFileSync(p, "utf8")));

  const used = new Set<string>();
  const queue: string[] = [];
  for (const name of components.keys()) {
    if (moduleSources.some((s) => mentions(s, name))) {
      used.add(name);
      queue.push(name);
    }
  }
  while (queue.length) {
    const source = stripComments(readFileSync(components.get(queue.pop()!)!, "utf8"));
    for (const name of components.keys()) {
      if (!used.has(name) && mentions(source, name)) {
        used.add(name);
        queue.push(name);
      }
    }
  }
  return new Map([...used].sort().map((name) => [name, components.get(name)!]));
}
