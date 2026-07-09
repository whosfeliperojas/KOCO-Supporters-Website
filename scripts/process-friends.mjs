// Slices "Peko's friends" (docs/peko-raw/peko's friends.png) into transparent
// WebP characters for the login page. Same AI-matting pipeline as the mascot
// (see process-mascot-3d.mjs); characters keep their own natural scale and are
// sized at the usage site.
//
// Run from web/:  node scripts/process-friends.mjs
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(here, "..", "..", "docs", "peko-raw", "peko's friends.png");
const OUT_DIR = path.join(here, "..", "public", "peko");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "friends-"));

const FRIENDS = [
  { name: "friend-owl",   box: { left: 25,  top: 350, width: 250, height: 370 } },
  { name: "friend-sloth", box: { left: 260, top: 225, width: 240, height: 420 } },
  { name: "friend-chick", box: { left: 455, top: 460, width: 220, height: 270 } },
  // AI matting drops the cat's low-contrast white body — but this sheet's bg
  // is cool blue and the cat has no blue, so a color flood fill works instead
  { name: "friend-cat",   box: { left: 640, top: 290, width: 215, height: 380 }, method: "flood" },
  // Peko hanging over an edge — tight crop (no square canvas) so the paw
  // line can be placed exactly on the login card's top edge
  { name: "peko-peek",    box: { left: 828, top: 500, width: 248, height: 205 }, tight: true },
];

const CANVAS = 600;
const CONTENT = 560;

if (!fs.existsSync(INPUT)) {
  console.error("Input not found: " + INPUT);
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

for (const f of FRIENDS) {
  const cropPath = path.join(TMP, f.name + ".png");
  const cutPath = path.join(TMP, f.name + "-cut.png");
  await sharp(INPUT).extract(f.box).png().toFile(cropPath);

  let data, w, h;
  if (f.method === "flood") {
    // Edge flood fill over blue-tinted background pixels
    const raw = await sharp(cropPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    data = raw.data; w = raw.info.width; h = raw.info.height;
    const isBg = (i) => {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      return b > 180 && g > 180 && b - r > 5;
    };
    const seen = new Uint8Array(w * h);
    const queue = [];
    for (let x = 0; x < w; x++) for (const y of [0, h - 1]) {
      const i = y * w + x;
      if (!seen[i] && isBg(i)) { seen[i] = 1; queue.push(i); }
    }
    for (let y = 0; y < h; y++) for (const x of [0, w - 1]) {
      const i = y * w + x;
      if (!seen[i] && isBg(i)) { seen[i] = 1; queue.push(i); }
    }
    while (queue.length) {
      const i = queue.pop();
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (!seen[ni] && isBg(ni)) { seen[ni] = 1; queue.push(ni); }
      }
    }
    for (let i = 0; i < w * h; i++) if (seen[i]) data[i * 4 + 3] = 0;
  } else {
    execFileSync(process.execPath, [path.join(here, "mascot-removebg-worker.mjs"), cropPath, cutPath, "medium"], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    const raw = await sharp(fs.readFileSync(cutPath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    data = raw.data; w = raw.info.width; h = raw.info.height;
    for (let i = 0; i < w * h; i++) {
      if (data[i * 4 + 3] < 24) data[i * 4 + 3] = 0;
    }
  }

  // Largest connected component only (drops label text / neighbor fragments)
  const label = new Int32Array(w * h).fill(-1);
  const sizes = [];
  let next = 0;
  for (let s = 0; s < w * h; s++) {
    if (label[s] !== -1 || data[s * 4 + 3] === 0) continue;
    let count = 0;
    const stack = [s];
    label[s] = next;
    while (stack.length) {
      const i = stack.pop();
      count++;
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (label[ni] === -1 && data[ni * 4 + 3] !== 0) { label[ni] = next; stack.push(ni); }
      }
    }
    sizes.push(count);
    next++;
  }
  const biggest = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] !== 0 && label[i] !== biggest) data[i * 4 + 3] = 0;
  }

  const trimmed = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .trim()
    .toBuffer({ resolveWithObject: true });

  if (f.tight) {
    await sharp(trimmed.data, {
      raw: { width: trimmed.info.width, height: trimmed.info.height, channels: 4 },
    })
      .resize({ width: 480 })
      .webp({ quality: 90 })
      .toFile(path.join(OUT_DIR, f.name + ".webp"));
    console.log(`  ✓ ${f.name}.webp (tight ${trimmed.info.width}x${trimmed.info.height})`);
    continue;
  }

  const fitted = await sharp(trimmed.data, {
    raw: { width: trimmed.info.width, height: trimmed.info.height, channels: 4 },
  })
    .resize(CONTENT, CONTENT, { fit: "inside" })
    .toBuffer({ resolveWithObject: true });

  const padX = Math.round((CANVAS - fitted.info.width) / 2);
  const padY = Math.max(0, CANVAS - fitted.info.height - Math.round(CANVAS * 0.02));

  await sharp(fitted.data, {
    raw: { width: fitted.info.width, height: fitted.info.height, channels: 4 },
  })
    .extend({
      top: padY,
      bottom: CANVAS - fitted.info.height - padY,
      left: padX,
      right: CANVAS - fitted.info.width - padX,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90 })
    .toFile(path.join(OUT_DIR, f.name + ".webp"));

  console.log(`  ✓ ${f.name}.webp (${fitted.info.width}x${fitted.info.height} content)`);
}

console.log("\nDone → web/public/peko/");
