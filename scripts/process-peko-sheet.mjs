// Slices the Peko model sheet (4 poses side by side) into individual
// transparent WebP pose files and installs them into web/public/peko/.
//
// Input:  docs/peko-raw/peko-sheet.png  (the Nano Banana model sheet)
// Output: web/public/peko/peko-idle.webp, peko-wave.webp, peko-celebrate.webp
//         (+ peko-side.webp kept for future use)
//
// Background removal is a flood fill from the image edges over near-white
// pixels — this keeps Peko's white body intact (only the OUTSIDE becomes
// transparent).
//
// Run from web/:  node scripts/process-peko-sheet.mjs
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(here, "..", "..", "docs", "peko-raw", "peko-sheet.png");
const OUT_DIR = path.join(here, "..", "public", "peko");

// The sheet: 4 poses left to right (slight overlap between slices; trim fixes it)
const SLICES = [
  { name: "peko-idle",      from: 0.00, to: 0.27 },
  { name: "peko-side",      from: 0.26, to: 0.50 },
  { name: "peko-wave",      from: 0.49, to: 0.76 },
  { name: "peko-celebrate", from: 0.72, to: 1.00 },
];

const WHITE_THRESHOLD = 238; // r,g,b all above this = candidate background
const CANVAS = 600;
const CONTENT = 520; // body size inside the canvas (margin all around)

if (!fs.existsSync(INPUT)) {
  console.error("Input not found: " + INPUT);
  console.error("Save the model sheet image there first (peko-sheet.png).");
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const src = sharp(INPUT);
const meta = await src.metadata();
console.log(`Sheet: ${meta.width}x${meta.height}`);

for (const slice of SLICES) {
  const left = Math.round(meta.width * slice.from);
  const width = Math.round(meta.width * (slice.to - slice.from));

  // 1. Extract the slice as raw RGBA
  const { data, info } = await sharp(INPUT)
    .extract({ left, top: 0, width, height: meta.height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 2. Flood fill from all edges: near-white connected to the border → transparent
  const { width: w, height: h } = info;
  const isBg = new Uint8Array(w * h);
  const queue = [];
  const nearWhite = (i) =>
    data[i * 4] >= WHITE_THRESHOLD &&
    data[i * 4 + 1] >= WHITE_THRESHOLD &&
    data[i * 4 + 2] >= WHITE_THRESHOLD;

  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = y * w + x;
      if (!isBg[i] && nearWhite(i)) { isBg[i] = 1; queue.push(i); }
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const i = y * w + x;
      if (!isBg[i] && nearWhite(i)) { isBg[i] = 1; queue.push(i); }
    }
  }
  while (queue.length) {
    const i = queue.pop();
    const x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (!isBg[ni] && nearWhite(ni)) { isBg[ni] = 1; queue.push(ni); }
    }
  }
  for (let i = 0; i < w * h; i++) {
    if (isBg[i]) data[i * 4 + 3] = 0;
  }

  // 2b. Keep only the largest connected opaque shape — removes fragments of
  //     neighboring poses caught by the slice overlap
  const label = new Int32Array(w * h).fill(-1);
  const sizes = [];
  let nextLabel = 0;
  for (let start = 0; start < w * h; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] === 0) continue;
    let count = 0;
    const stack = [start];
    label[start] = nextLabel;
    while (stack.length) {
      const i = stack.pop();
      count++;
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (label[ni] === -1 && data[ni * 4 + 3] !== 0) {
          label[ni] = nextLabel;
          stack.push(ni);
        }
      }
    }
    sizes.push(count);
    nextLabel++;
  }
  const biggest = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] !== 0 && label[i] !== biggest) data[i * 4 + 3] = 0;
  }

  // 3. Trim transparent edges, fit into content box, center on square canvas
  const trimmed = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .trim()
    .toBuffer({ resolveWithObject: true });

  const fitted = await sharp(trimmed.data, {
    raw: { width: trimmed.info.width, height: trimmed.info.height, channels: 4 },
  })
    .resize(CONTENT, CONTENT, { fit: "inside" })
    .toBuffer({ resolveWithObject: true });

  const padX = Math.round((CANVAS - fitted.info.width) / 2);
  const padY = Math.round((CANVAS - fitted.info.height) / 2);

  const outPath = path.join(OUT_DIR, slice.name + ".webp");
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
    .toFile(outPath);

  console.log(`  ✓ ${slice.name}.webp (${fitted.info.width}x${fitted.info.height} content)`);
}

console.log("\nDone. Files installed in web/public/peko/ — refresh the dashboard.");
