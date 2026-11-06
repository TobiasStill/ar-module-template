// Generates every demo file the examples use, from code alone, so the template
// carries no third-party or student material and its demo content can be
// reproduced exactly (the random generator is seeded):
//
//   examples/assets/          demo assets; copy what you need into src/assets/
//   examples/image-targets/   demo image target; copy into src/image-targets/
//   src/a-frame-components/mirror-shard-data/shards.json   mirror-shard geometry
//
// Run with `npx tsx scripts/generate-demo-assets.ts`. Needs ffmpeg for the demo
// video only; without it, that one file is skipped with a message.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO } from "@gltf-transform/core";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ASSETS = join(ROOT, "examples/assets");
const TARGETS = join(ROOT, "examples/image-targets");
const SHARDS = join(ROOT, "src/a-frame-components/mirror-shard-data/shards.json");

/** Small seeded generator (mulberry32): same seed, same files. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Point = [number, number];
const round = (n: number, digits = 5) => Number(n.toFixed(digits));

// ── Mirror shards ───────────────────────────────────────────────────────────
// A rectangle fractured around an impact point: a fan of triangles from that
// point to the rim, then the heaviest triangle is split across its longest edge
// until there are 112. Triangles near the impact weigh more, so they end up
// smaller and the pieces grow towards the rim.

function generateShards() {
  const rng = random(1871);
  const SHARD_COUNT = 112;
  const [minX, maxX, minY, maxY] = [-3.584, 3.584, 0.015, 4.036];
  const impact: Point = [0.42, 1.72];

  const rim: Point[] = [];
  const corners: Point[] = [[minX, minY], [minX, maxY], [maxX, maxY], [maxX, minY]];
  corners.forEach((corner, i) => {
    const next = corners[(i + 1) % 4];
    for (let step = 0; step < 3; step++) {
      const t = step === 0 ? 0 : step / 3 + (rng() - 0.5) * 0.12;
      rim.push([corner[0] + (next[0] - corner[0]) * t, corner[1] + (next[1] - corner[1]) * t]);
    }
  });

  type Triangle = [Point, Point, Point];
  const triangles: Triangle[] = rim.map((p, i) => [impact, p, rim[(i + 1) % rim.length]]);
  const area = ([a, b, c]: Triangle) =>
    Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  const weight = (t: Triangle) => {
    const cx = (t[0][0] + t[1][0] + t[2][0]) / 3 - impact[0];
    const cy = (t[0][1] + t[1][1] + t[2][1]) / 3 - impact[1];
    return area(t) / (0.55 + Math.hypot(cx, cy) * 0.35);
  };

  while (triangles.length < SHARD_COUNT) {
    let heaviest = 0;
    triangles.forEach((t, i) => {
      if (weight(t) > weight(triangles[heaviest])) heaviest = i;
    });
    const t = triangles[heaviest];
    let edge = 0;
    let longest = 0;
    for (let i = 0; i < 3; i++) {
      const [p, q] = [t[i], t[(i + 1) % 3]];
      const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (length > longest) {
        longest = length;
        edge = i;
      }
    }
    const [a, b, c] = [t[edge], t[(edge + 1) % 3], t[(edge + 2) % 3]];
    const s = 0.36 + rng() * 0.28;
    const split: Point = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
    triangles.splice(heaviest, 1, [a, split, c], [split, b, c]);
  }

  const shards = triangles.map((t, index) => {
    // Clockwise, like the layout mirror-shard was tuned with.
    const signed = (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1]);
    const points = signed > 0 ? [t[0], t[2], t[1]] : t;
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    return {
      index,
      name: `mirror shard ${String(index).padStart(3, "0")}`,
      variant: "impact_star",
      points: points.map((p) => [round(p[0]), round(p[1])]),
      center: [round(xs.reduce((s, x) => s + x) / 3), round(ys.reduce((s, y) => s + y) / 3)],
      depth: round((rng() - 0.5) * 0.27),
      width: round(Math.max(...xs) - Math.min(...xs)),
      height: round(Math.max(...ys) - Math.min(...ys)),
      area: round(area(t), 6),
      seed: round(rng(), 6)
    };
  });

  const depths = shards.map((s) => s.depth);
  writeFileSync(
    SHARDS,
    `${JSON.stringify(
      {
        schemaVersion: 2,
        variant: "impact_star",
        source: "scripts/generate-demo-assets.ts",
        count: shards.length,
        bounds: { minX, maxX, minY, maxY, minDepth: Math.min(...depths), maxDepth: Math.max(...depths) },
        shards
      },
      null,
      2
    )}\n`
  );
}

// ── Liquid-texture target images ────────────────────────────────────────────

function posterSvg(width: number, height: number, deep: string, mid: string, shapes: (fill: string, deep: string) => string) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><filter id="soft"><feGaussianBlur stdDeviation="26"/></filter></defs>
    <rect width="100%" height="100%" fill="#ffffff"/>
    <g filter="url(#soft)" opacity="0.65">${shapes(mid, mid)}</g>
    <g>${shapes(mid, deep)}</g>
  </svg>`);
}

async function generateLiquidTargets() {
  const [w, h] = [1024, 1280];
  const rings = (mid: string, deep: string) =>
    [
      [512, 470, 330, mid, 0.28],
      [400, 650, 240, mid, 0.42],
      [640, 760, 190, deep, 0.5],
      [512, 470, 130, deep, 0.9],
      [300, 980, 150, deep, 0.75],
      [740, 1050, 95, mid, 0.85]
    ]
      .map(([x, y, r, fill, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${o}"/>`)
      .join("");
  const bars = (mid: string, deep: string) =>
    [
      [180, 150, 120, 980, mid, 0.3],
      [340, 60, 90, 1120, mid, 0.55],
      [470, 0, 84, 1280, deep, 0.92],
      [590, 90, 70, 1100, deep, 0.7],
      [700, 240, 130, 860, mid, 0.42],
      [90, 1000, 844, 100, deep, 0.78],
      [230, 880, 560, 70, mid, 0.6]
    ]
      .map(([x, y, bw, bh, fill, o]) => `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${fill}" opacity="${o}"/>`)
      .join("");

  await sharp(posterSvg(w, h, "#0b2fb8", "#3aa0ff", rings))
    .webp({ quality: 80 })
    .toFile(join(ASSETS, "liquid-texture-target-1.webp"));
  await sharp(posterSvg(w, h, "#c43c00", "#ff8a00", bars))
    .webp({ quality: 80 })
    .toFile(join(ASSETS, "liquid-texture-target-2.webp"));
}

// ── Image target ────────────────────────────────────────────────────────────
// Tracking needs many sharp, unrepeated corners, so: hundreds of random hard-
// edged shapes. Same five-file bundle the 8th Wall target tool exports.

async function generateImageTarget() {
  const rng = random(4242);
  const [w, h] = [584, 779];
  const colours = ["#111111", "#ffffff", "#e6332a", "#0057b8", "#ffd400", "#00a86b"];
  let shapes = "";
  for (let i = 0; i < 420; i++) {
    const size = 12 + rng() * rng() * 120;
    const [x, y] = [rng() * w, rng() * h];
    const fill = colours[Math.floor(rng() * colours.length)];
    if (i % 3 === 0) {
      const a = rng() * Math.PI * 2;
      const pts = [0, 2.1, 4.2]
        .map((o) => `${x + Math.cos(a + o) * size},${y + Math.sin(a + o) * size}`)
        .join(" ");
      shapes += `<polygon points="${pts}" fill="${fill}"/>`;
    } else {
      const angle = rng() * 180;
      shapes += `<rect x="${x}" y="${y}" width="${size}" height="${size * (0.3 + rng())}" fill="${fill}" transform="rotate(${angle} ${x} ${y})"/>`;
    }
  }
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#f4f4f4"/>${shapes}</svg>`
  );
  const image = await sharp(svg).flatten({ background: "#ffffff" }).png().toBuffer();
  const file = (suffix: string) => join(TARGETS, `video-target_${suffix}.jpg`);

  await sharp(image).jpeg({ quality: 88 }).toFile(file("original"));
  await sharp(image).jpeg({ quality: 88 }).toFile(file("cropped"));
  await sharp(image).resize(262, 350).jpeg({ quality: 85 }).toFile(file("thumbnail"));
  await sharp(image).resize(480, 640).greyscale().toColourspace("srgb").jpeg({ quality: 90 }).toFile(file("luminance"));

  const stamp = Date.UTC(2026, 10, 6);
  writeFileSync(
    join(TARGETS, "video-target.json"),
    `${JSON.stringify(
      {
        imagePath: "image-targets/video-target_luminance.jpg",
        metadata: null,
        name: "video-target",
        type: "PLANAR",
        properties: { left: 0, top: 0, width: w, height: h, isRotated: false, originalWidth: w, originalHeight: h },
        resources: {
          originalImage: "video-target_original.jpg",
          croppedImage: "video-target_cropped.jpg",
          thumbnailImage: "video-target_thumbnail.jpg",
          luminanceImage: "video-target_luminance.jpg"
        },
        created: stamp,
        updated: stamp
      },
      null,
      2
    )}\n`
  );

  // Poster frame for the demo video: the target with a play symbol on it.
  const play = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="262" height="350">
    <circle cx="131" cy="175" r="44" fill="#000000" fill-opacity="0.45" stroke="#ffffff" stroke-width="6"/>
    <polygon points="116,150 116,200 158,175" fill="#ffffff"/></svg>`);
  await sharp(image)
    .resize(262, 350)
    .composite([{ input: play }])
    .jpeg({ quality: 85 })
    .toFile(join(ASSETS, "image-tracking-poster.jpg"));
}

// ── Demo video ──────────────────────────────────────────────────────────────

function generateVideo() {
  try {
    execFileSync(
      "ffmpeg",
      [
        "-loglevel", "error", "-y",
        "-f", "lavfi",
        "-i", "gradients=s=584x780:r=30:d=4:c0=0x0b2fb8:c1=0x3aa0ff:c2=0xff8a00:c3=0xf4fbff:n=4:speed=0.02",
        "-c:v", "libx264", "-preset", "veryslow", "-crf", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        join(ASSETS, "image-tracking-demo-video.mp4")
      ],
      { stdio: "inherit" }
    );
  } catch (error) {
    console.warn(`Skipped image-tracking-demo-video.mp4 (needs ffmpeg): ${String(error)}`);
  }
}

// ── Sound panel icons ───────────────────────────────────────────────────────

async function generateSoundIcons() {
  const line = `fill="none" stroke="#000000" stroke-width="3" stroke-linejoin="miter"`;
  const icons: Record<string, string> = {
    start: `<rect x="10" y="10" width="6" height="30" ${line}/><polygon points="40,10 40,40 18,25" ${line}/>`,
    stop: `<rect x="12" y="12" width="26" height="26" ${line}/>`,
    play: `<polygon points="14,9 14,41 40,25" ${line}/>`,
    pause: `<rect x="13" y="11" width="9" height="28" ${line}/><rect x="28" y="11" width="9" height="28" ${line}/>`
  };
  for (const [name, body] of Object.entries(icons)) {
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50">${body}</svg>`);
    await sharp(svg).webp({ lossless: true }).toFile(join(ASSETS, `sound-${name}.webp`));
  }
}

// ── Mesh-render-order model ─────────────────────────────────────────────────
// Five overlapping see-through panels with named meshes. Names have no spaces:
// three.js' GLTFLoader turns a space in a node name into an underscore.

async function generateLayeredModel() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene("layers");
  const layers: [string, [number, number, number, number], number, number, number, number][] = [
    // name, colour + alpha, centre x, centre y, half-width, z
    ["veil_back", [0.1, 0.3, 0.95, 0.55], -0.12, 0.62, 0.42, -0.06],
    ["veil_middle", [1, 0.48, 0.05, 0.55], 0.12, 0.5, 0.38, -0.03],
    ["veil_front", [0.1, 0.8, 0.4, 0.55], -0.04, 0.38, 0.34, 0],
    ["halo", [0.95, 0.9, 0.2, 0.55], 0.02, 0.7, 0.24, 0.03],
    ["core", [0.95, 0.1, 0.45, 0.8], 0, 0.5, 0.14, 0.06]
  ];
  for (const [name, colour, x, y, half, z] of layers) {
    const positions = new Float32Array([
      x - half, y - half, z,
      x + half, y - half, z,
      x + half, y + half, z,
      x - half, y + half, z
    ]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const primitive = doc
      .createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(positions).setBuffer(buffer))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(normals).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint16Array([0, 1, 2, 0, 2, 3])).setBuffer(buffer))
      .setMaterial(
        doc
          .createMaterial(name)
          .setBaseColorFactor(colour)
          .setAlphaMode("BLEND")
          .setDoubleSided(true)
          .setRoughnessFactor(1)
          .setMetallicFactor(0)
      );
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)));
  }
  await new NodeIO().write(join(ASSETS, "mesh-render-order-demo.glb"), doc);
}

mkdirSync(ASSETS, { recursive: true });
mkdirSync(TARGETS, { recursive: true });
generateShards();
await generateLiquidTargets();
await generateImageTarget();
await generateSoundIcons();
await generateLayeredModel();
generateVideo();
console.log("Demo assets written to examples/assets and examples/image-targets; shards.json updated.");
