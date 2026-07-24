#!/usr/bin/env -S npx tsx
// Interactive asset-compression tool — run via `npm run compress-assets`.
// See cross-feature-reference-docs/ASSET-COMPRESSION-GUIDE.md for the full
// picture (why each piece exists, the specific bug this design avoids, and
// how to verify the result). Short version of what this does:
//
//   - Mesh-compresses .glb files with gltfpack -c -kn -km, then reattaches
//     mesh names gltfpack relocates during that step (see
//     reattachNamesToMeshNodes below) — without both parts, anything
//     referencing a mesh by name (e.g. mesh-render-order) breaks.
//   - Re-encodes embedded + standalone textures as WebP (lossless or ~90%
//     quality), with an optional "halve anything at/above a size threshold"
//     resize rule.
//   - ALWAYS compresses from a preserved pristine original
//     (uncompressed-assets/, gitignored, never scanned by the Vite build),
//     never from a previously-compressed file. This is the one rule this
//     whole tool exists to enforce — see the guide for the real bug
//     (silent geometry corruption from re-quantizing already-quantized
//     meshopt data) that skipping it caused on a past project.
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, unlinkSync, rmSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { NodeIO, type Document, type Texture } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { compressTexture } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ASSETS_DIR = join(ROOT, "src/assets");
const UNCOMPRESSED_DIR = join(ROOT, "uncompressed-assets");
const GLTFPACK_BIN = join(ROOT, "node_modules/.bin/gltfpack");

const GLB_EXT = ".glb";
const IMAGE_EXTS = [".png", ".jpg", ".jpeg"]; // NOT .webp — nothing to convert

interface QualityChoice {
  lossless: boolean;
  quality: number | null; // null when lossless
}

interface ResizeChoice {
  thresholdPx: number | null; // null = no resizing at all
}

const rl = createInterface({ input: stdin, output: stdout });
async function ask(question: string): Promise<string> {
  return (await rl.question(question)).trim();
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function listAssetFiles(exts: string[]): string[] {
  if (!existsSync(ASSETS_DIR)) return [];
  return readdirSync(ASSETS_DIR)
    .filter((f) => !f.startsWith(".") && exts.includes(extname(f).toLowerCase()))
    .filter((f) => statSync(join(ASSETS_DIR, f)).isFile())
    .sort();
}

/**
 * Picks which files (of the given candidate list) to process — every file,
 * or a hand-picked subset by number. This is the "batch or specific files"
 * choice.
 */
async function pickFiles(candidates: string[], label: string): Promise<string[]> {
  if (candidates.length === 0) {
    console.log(`(no ${label} files found in src/assets/)`);
    return [];
  }
  console.log(`\nFound ${candidates.length} ${label} file(s):`);
  candidates.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  const answer = await ask(
    `\nCompress ALL of these, or pick specific ones? [a = all / numbers separated by commas, e.g. "1,3,4"]: `
  );
  if (answer.toLowerCase() === "a" || answer === "") return candidates;
  const indices = answer
    .split(",")
    .map((s) => parseInt(s.trim(), 10) - 1)
    .filter((i) => i >= 0 && i < candidates.length);
  const picked = [...new Set(indices)].map((i) => candidates[i]);
  if (picked.length === 0) {
    console.log("No valid selection understood — skipping this category.");
  }
  return picked;
}

async function pickQuality(): Promise<QualityChoice> {
  const answer = await ask(
    "\nWebP quality — [1] lossless  [2] ~90% quality (lossy, smaller): "
  );
  if (answer === "2") return { lossless: false, quality: 90 };
  return { lossless: true, quality: null };
}

async function pickResize(): Promise<ResizeChoice> {
  const answer = await ask(
    "\nResize textures? — [1] no resizing  [2] halve textures at/above a size threshold: "
  );
  if (answer !== "2") return { thresholdPx: null };
  const thresholdAnswer = await ask(
    "Threshold in pixels, compared against each texture's SHORTER side " +
      "(a texture exactly at this size is still halved; anything smaller is left alone) [default 1024]: "
  );
  const parsed = parseInt(thresholdAnswer, 10);
  return { thresholdPx: Number.isFinite(parsed) && parsed > 0 ? parsed : 1024 };
}

/** [width, height] to resize to, or undefined to leave the texture untouched. */
function computeResizeTarget(
  width: number,
  height: number,
  resize: ResizeChoice
): [number, number] | undefined {
  if (resize.thresholdPx == null) return undefined;
  const shorterSide = Math.min(width, height);
  if (shorterSide < resize.thresholdPx) return undefined; // strictly smaller than threshold -> leave alone
  return [Math.round(width / 2), Math.round(height / 2)];
}

/**
 * Guarantees a pristine, untouched copy of `filename` exists in
 * uncompressed-assets/, and returns its path. If uncompressed-assets/ already
 * has this file, src/assets/'s copy is assumed to be a PREVIOUSLY COMPRESSED
 * derivative — the pristine copy is always the source of truth, never the
 * (possibly already-compressed) file in src/assets/. This is what makes
 * re-running this tool with different settings safe, and what prevents ever
 * accidentally re-compressing an already-compressed file (see the guide for
 * why that specifically caused geometry corruption on a past project).
 */
function ensurePristine(filename: string): string {
  if (!existsSync(UNCOMPRESSED_DIR)) mkdirSync(UNCOMPRESSED_DIR, { recursive: true });
  const pristinePath = join(UNCOMPRESSED_DIR, filename);
  if (!existsSync(pristinePath)) {
    copyFileSync(join(ASSETS_DIR, filename), pristinePath);
  }
  return pristinePath;
}

async function compressGlb(filename: string, quality: QualityChoice, resize: ResizeChoice): Promise<void> {
  const pristinePath = ensurePristine(filename);
  const finalPath = join(ASSETS_DIR, filename);
  const meshCompressedTmp = join(tmpdir(), `compress-assets-${Date.now()}-${filename}`);

  try {
    // Mesh compression — gltfpack -c is the same tool (and same -c flag)
    // this template's projects have always used for this step. Without
    // -kn/-km, gltfpack strips node/mesh/material names entirely by
    // default (verified directly: Rosa_module's shipped, compressed
    // Rosa.glb has zero node names left at all) — plausibly the root cause
    // of mesh-render-order's original hardcoded "Mesh_1".."Mesh_8" map
    // never matching anything real, documented as an open question in
    // guides/MESH-RENDER-ORDER-FEATURE-GUIDE.md at the time. -km keeps named
    // materials outright. -kn keeps names too, but NOT on the mesh node
    // itself — see reattachNamesToMeshNodes below for what it actually
    // does and why that still isn't enough on its own.
    execFileSync(GLTFPACK_BIN, ["-i", pristinePath, "-o", meshCompressedTmp, "-c", "-kn", "-km"], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    // Texture pass — deliberately NOT another gltfpack invocation. Running
    // gltfpack's own texture conversion on a file gltfpack JUST mesh-
    // compressed would re-parse and re-quantize the geometry a second time;
    // quantization is lossy, so a second pass compounds precision loss on
    // top of the first. Reading via NodeIO with the meshopt decoder/encoder
    // registered instead round-trips the already-compressed mesh data
    // unchanged — only the textures are touched.
    await MeshoptDecoder.ready;
    await MeshoptEncoder.ready;
    const io = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

    const document = await io.read(meshCompressedTmp);
    reattachNamesToMeshNodes(document);
    const textures = document.getRoot().listTextures();
    for (const texture of textures) {
      await compressTextureWithResizeRule(texture, quality, resize);
    }
    await io.write(finalPath, document);

    const before = statSync(pristinePath).size;
    const after = statSync(finalPath).size;
    console.log(`  ✓ ${filename}: ${formatBytes(before)} -> ${formatBytes(after)}`);
  } finally {
    if (existsSync(meshCompressedTmp)) rmSync(meshCompressedTmp);
  }
}

/**
 * gltfpack's -kn ("keep named nodes") does NOT keep the name on the
 * mesh-bearing node itself — verified directly, not assumed. Instead it
 * wraps each named mesh node in a NEW, unnamed-mesh parent that carries the
 * name, and leaves the original mesh node unnamed as that parent's only
 * child (so the name can still be found and used to transform the group
 * externally, per gltfpack's own stated intent — just not where a component
 * written against the pre-compression convention (a name directly on the
 * mesh node, e.g. mesh-render-order.ts) would look for it). This walks the
 * document and copies each such wrapper's name back down onto its one
 * mesh-bearing child, restoring the original "name lives on the mesh node"
 * convention — so nothing that referenced mesh names before compression
 * needs to change after it.
 */
function reattachNamesToMeshNodes(document: Document): void {
  for (const node of document.getRoot().listNodes()) {
    const name = node.getName();
    if (!name || node.getMesh()) continue;
    const children = node.listChildren();
    if (children.length !== 1) continue;
    const [child] = children;
    if (child.getMesh() && !child.getName()) child.setName(name);
  }
}

async function compressTextureWithResizeRule(
  texture: Texture,
  quality: QualityChoice,
  resize: ResizeChoice
): Promise<void> {
  const size = texture.getSize();
  const resizeTarget = size ? computeResizeTarget(size[0], size[1], resize) : undefined;
  await compressTexture(texture, {
    encoder: sharp,
    targetFormat: "webp",
    resize: resizeTarget,
    lossless: quality.lossless,
    quality: quality.quality ?? undefined
  });
}

async function compressStandaloneImage(
  filename: string,
  quality: QualityChoice,
  resize: ResizeChoice
): Promise<void> {
  const pristinePath = ensurePristine(filename);
  const stem = basename(filename, extname(filename));
  const finalPath = join(ASSETS_DIR, `${stem}.webp`);

  const image = sharp(pristinePath);
  const metadata = await image.metadata();
  const resizeTarget =
    metadata.width && metadata.height ? computeResizeTarget(metadata.width, metadata.height, resize) : undefined;
  if (resizeTarget) image.resize(resizeTarget[0], resizeTarget[1]);
  image.webp(quality.lossless ? { lossless: true } : { quality: quality.quality! });

  await image.toFile(finalPath);

  // The original (.png/.jpg) is superseded by finalPath (.webp) — remove it
  // from src/assets/ so the asset-scanning Vite plugin doesn't ship both.
  // The pristine copy already safely lives in uncompressed-assets/.
  const originalPath = join(ASSETS_DIR, filename);
  if (originalPath !== finalPath) unlinkSync(originalPath);

  const before = statSync(pristinePath).size;
  const after = statSync(finalPath).size;
  console.log(`  ✓ ${filename} -> ${basename(finalPath)}: ${formatBytes(before)} -> ${formatBytes(after)}`);
}

async function main(): Promise<void> {
  console.log("Asset compression — src/assets/\n");
  console.log("Originals are always preserved in uncompressed-assets/ (gitignored, not");
  console.log("shipped) before anything is touched — safe to re-run with different");
  console.log("settings at any time.\n");

  const categoryAnswer = await ask(
    "What do you want to compress? — [1] .glb models (mesh + embedded textures)  " +
      "[2] standalone images (png/jpg -> webp)  [3] both: "
  );
  const doGlb = categoryAnswer === "1" || categoryAnswer === "3";
  const doImages = categoryAnswer === "2" || categoryAnswer === "3";

  if (!doGlb && !doImages) {
    console.log("Nothing selected — exiting.");
    rl.close();
    return;
  }

  const glbFiles = doGlb ? await pickFiles(listAssetFiles([GLB_EXT]), ".glb") : [];
  const imageFiles = doImages ? await pickFiles(listAssetFiles(IMAGE_EXTS), "standalone image") : [];

  if (glbFiles.length === 0 && imageFiles.length === 0) {
    console.log("Nothing to do — exiting.");
    rl.close();
    return;
  }

  const quality = await pickQuality();
  const resize = await pickResize();

  console.log("\n--- Summary ---");
  if (glbFiles.length) console.log(`.glb files (${glbFiles.length}): ${glbFiles.join(", ")}`);
  if (imageFiles.length) console.log(`Standalone images (${imageFiles.length}): ${imageFiles.join(", ")}`);
  console.log(`WebP quality: ${quality.lossless ? "lossless" : `~90% (lossy)`}`);
  console.log(
    resize.thresholdPx == null
      ? "Resize: none"
      : `Resize: halve textures with a shorter side >= ${resize.thresholdPx}px`
  );
  console.log("gltfpack flags: -c -kn -km (mesh compression, names preserved)");

  const confirm = await ask("\nProceed? [y/N]: ");
  if (confirm.toLowerCase() !== "y") {
    console.log("Cancelled.");
    rl.close();
    return;
  }

  console.log("\nCompressing...");
  for (const f of glbFiles) {
    try {
      await compressGlb(f, quality, resize);
    } catch (err) {
      console.error(`  ✗ ${f}: ${err instanceof Error ? err.message : err}`);
    }
  }
  for (const f of imageFiles) {
    try {
      await compressStandaloneImage(f, quality, resize);
    } catch (err) {
      console.error(`  ✗ ${f}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(
    "\nDone. Verify with `npm run build` and a visual check (npm run dev / npm run dev:ar) " +
      "before committing — see cross-feature-reference-docs/ASSET-COMPRESSION-GUIDE.md."
  );
  rl.close();
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exitCode = 1;
});
