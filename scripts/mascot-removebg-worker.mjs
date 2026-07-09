// Child-process worker: AI background removal only (no sharp import —
// onnxruntime and libvips crash when loaded into the same process on Windows).
// Usage: node scripts/mascot-removebg-worker.mjs <in.png> <out.png>
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { removeBackground } from "@imgly/background-removal-node";

const [inPath, outPath, model = "medium"] = process.argv.slice(2);
const blob = await removeBackground(pathToFileURL(inPath).href, {
  model,
  output: { format: "image/png" },
});
fs.writeFileSync(outPath, Buffer.from(await blob.arrayBuffer()));
console.log("cut → " + outPath);
