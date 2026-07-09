// Processes the 3-pose "Peko final" sheet (docs/peko-raw/Peko final.png) into
// transparent WebP pose frames for the Companion — replaces the previous
// 4-pose set (idle/side/wave/celebrate) with this 3-pose set (idle/wave/
// celebrate). No side-profile pose in this sheet, and none is used anymore.
//
// AI background removal (@imgly/background-removal-node, local ONNX model,
// build-time only) since the white body is close in tone to the cream backdrop.
//
// Outputs (web/public/peko/):
//   peko-idle.webp, peko-wave.webp, peko-celebrate.webp
//   peko-meta.json  — auto-detected eye positions on the idle frame (in % of
//                     canvas) + face color, used by the blink overlay.
//
// Run from web/:  node scripts/process-mascot-final.mjs
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(here, "..", "..", "docs", "peko-raw", "Peko final.png");
const OUT_DIR = path.join(here, "..", "public", "peko");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "pekofinal-"));

// Crop boxes generous around each figure — the AI matting + largest-component
// filter below clean up the rest, same as the previous sheet.
const POSES = [
  { name: "peko-idle",      box: { left: 40,  top: 300, width: 420, height: 660 } },
  { name: "peko-wave",      box: { left: 420, top: 300, width: 440, height: 660 } },
  { name: "peko-celebrate", box: { left: 820, top: 260, width: 511, height: 720 } },
];

const CANVAS = 600;
const CONTENT = 540; // idle pose height; other poses are scaled to match his HOOD size
const MAX_DIM = 560; // safety cap so no pose overflows the canvas

if (!fs.existsSync(INPUT)) {
  console.error("Input not found: " + INPUT);
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const results = {};
const trimmedPoses = [];

for (const pose of POSES) {
  // 1. Crop the pose region and hand it to the AI matting model
  const cropPath = path.join(TMP, pose.name + ".png");
  const cutPath = path.join(TMP, pose.name + "-cut.png");
  await sharp(INPUT).extract(pose.box).png().toFile(cropPath);

  // AI matting runs in a child process — onnxruntime + libvips can't share one
  execFileSync(process.execPath, [path.join(here, "mascot-removebg-worker.mjs"), cropPath, cutPath, pose.model ?? "medium"], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  const cut = fs.readFileSync(cutPath);

  // 2. Raw RGBA for cleanup
  const { data, info } = await sharp(cut).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  // Kill faint alpha haze the matting sometimes leaves; optionally solidify
  // ghosted interior areas (gamma curve keeps the true edge soft)
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3];
    if (a < 24) data[i * 4 + 3] = 0;
    else if (pose.alphaBoost) data[i * 4 + 3] = Math.round(255 * Math.pow(a / 255, 0.4));
  }

  // Keep only the largest connected opaque component (drops stray fragments
  // of neighboring sheet elements caught by the crop)
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

  // 3. Trim and measure the blue hood — the head is the size constant across
  //    poses, so all frames get scaled to matching hood width (the sheet
  //    draws each pose at a different scale)
  const trimmed = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .trim()
    .toBuffer({ resolveWithObject: true });

  const tw = trimmed.info.width, th = trimmed.info.height, td = trimmed.data;
  // Hood HEIGHT is invariant when the head turns (width shrinks in profile)
  let hoodMin = th, hoodMax = 0;
  for (let i = 0; i < tw * th; i++) {
    const r = td[i * 4], g = td[i * 4 + 1], b = td[i * 4 + 2], a = td[i * 4 + 3];
    if (a > 128 && b > 140 && b - r > 50 && b - g > 20) {
      const y = (i / tw) | 0;
      if (y < hoodMin) hoodMin = y;
      if (y > hoodMax) hoodMax = y;
    }
  }
  const hoodH = Math.max(1, hoodMax - hoodMin);
  trimmedPoses.push({ ...pose, data: td, w: tw, h: th, hoodH });
  console.log(`  · ${pose.name}: trimmed ${tw}x${th}, hood h ${hoodH}px`);
}

// Scale every pose so hood height matches the idle reference
const idleP = trimmedPoses.find((p) => p.name === "peko-idle");
let K = idleP.hoodH * (CONTENT / idleP.h);
const maxDim = Math.max(...trimmedPoses.map((p) => Math.max(p.w, p.h) * (K / p.hoodH)));
if (maxDim > MAX_DIM) K *= MAX_DIM / maxDim;

for (const pose of trimmedPoses) {
  const s = K / pose.hoodH;
  const W2 = Math.max(1, Math.round(pose.w * s));
  const H2 = Math.max(1, Math.round(pose.h * s));

  const fitted = await sharp(pose.data, { raw: { width: pose.w, height: pose.h, channels: 4 } })
    .resize(W2, H2)
    .toBuffer({ resolveWithObject: true });

  const padX = Math.round((CANVAS - fitted.info.width) / 2);
  // Common ground line; the jump pose floats a little higher
  const bottomOffset = pose.name === "peko-celebrate" ? 0.09 : 0.04;
  const padY = Math.max(0, CANVAS - fitted.info.height - Math.round(CANVAS * bottomOffset));

  const framed = await sharp(fitted.data, {
    raw: { width: fitted.info.width, height: fitted.info.height, channels: 4 },
  })
    .extend({
      top: padY,
      bottom: CANVAS - fitted.info.height - padY,
      left: padX,
      right: CANVAS - fitted.info.width - padX,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer({ resolveWithObject: true });

  await sharp(framed.data, { raw: { width: CANVAS, height: CANVAS, channels: 4 } })
    .webp({ quality: 90 })
    .toFile(path.join(OUT_DIR, pose.name + ".webp"));

  results[pose.name] = framed.data; // keep raw for eye detection
  console.log(`  ✓ ${pose.name}.webp (${fitted.info.width}x${fitted.info.height} content)`);
}

// 4. Eye detection on the idle frame → peko-meta.json for the blink overlay.
//    Eyes are the two topmost dark clusters in the face area.
{
  const data = results["peko-idle"];
  const w = CANVAS, h = CANVAS;
  const dark = (i) =>
    data[i * 4 + 3] > 200 &&
    data[i * 4] < 100 && data[i * 4 + 1] < 100 && data[i * 4 + 2] < 100;

  const label = new Int32Array(w * h).fill(-1);
  const clusters = [];
  let next = 0;
  for (let s = 0; s < w * h; s++) {
    const sy = (s / w) | 0;
    if (sy > h * 0.6) break; // face is in the upper part
    if (label[s] !== -1 || !dark(s)) continue;
    let count = 0, sx = 0, syy = 0, minX = w, maxX = 0, minY = h, maxY = 0;
    const stack = [s];
    label[s] = next;
    while (stack.length) {
      const i = stack.pop();
      const x = i % w, y = (i / w) | 0;
      count++; sx += x; syy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (label[ni] === -1 && dark(ni)) { label[ni] = next; stack.push(ni); }
      }
    }
    if (count > 40 && count < 6000) {
      clusters.push({ cx: sx / count, cy: syy / count, rw: (maxX - minX) / 2, rh: (maxY - minY) / 2, count });
    }
    next++;
  }

  // Two topmost clusters that sit side by side = the eyes
  clusters.sort((a, b) => a.cy - b.cy);
  let eyes = null;
  for (let i = 0; i < clusters.length - 1 && !eyes; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const a = clusters[i], b = clusters[j];
      if (Math.abs(a.cy - b.cy) < 40 && Math.abs(a.cx - b.cx) > 50) {
        eyes = [a, b].sort((p, q) => p.cx - q.cx);
        break;
      }
    }
  }

  if (eyes) {
    // Sample the face color just above the left eye for the eyelid overlay
    const fx = Math.round(eyes[0].cx), fy = Math.round(eyes[0].cy - eyes[0].rh * 3);
    const fi = (fy * w + fx) * 4;
    const face = `rgb(${data[fi]},${data[fi + 1]},${data[fi + 2]})`;
    const meta = {
      eyes: eyes.map((e) => ({
        x: +(e.cx / CANVAS * 100).toFixed(2),
        y: +(e.cy / CANVAS * 100).toFixed(2),
        rx: +(Math.max(e.rw, 6) / CANVAS * 100 * 1.7).toFixed(2),
        ry: +(Math.max(e.rh, 6) / CANVAS * 100 * 1.9).toFixed(2),
      })),
      face,
    };
    fs.writeFileSync(path.join(OUT_DIR, "peko-meta.json"), JSON.stringify(meta, null, 2));
    console.log("  ✓ peko-meta.json  eyes:", JSON.stringify(meta.eyes), "face:", face);
  } else {
    console.warn("  ! Eye detection failed — blink overlay will use squash fallback");
  }
}

console.log("\nDone → web/public/peko/");
