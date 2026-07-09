// One-time backfill: compute embeddings for all existing content posts.
// RUN AFTER migrations/06_similarity.sql has been applied in Supabase.
// From the web/ folder:  node scripts/backfill-embeddings.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { pipeline } from "@huggingface/transformers";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = fs.readFileSync(path.join(here, "..", ".env.local"), "utf8");
const env = Object.fromEntries(
  envFile.split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

console.log("Loading embedding model (first run downloads ~100 MB)...");
const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small", { dtype: "q8" });

const { data: posts, error } = await admin
  .from("content_posts")
  .select("id, title, caption, script, content_type, embedding");
if (error) { console.error(error.message); process.exit(1); }

const todo = posts.filter((p) => !p.embedding);
console.log(`${posts.length} posts total, ${todo.length} need embeddings.`);

for (const post of todo) {
  const text = "passage: " + [post.title, post.content_type, post.caption, post.script]
    .filter(Boolean).join("\n").slice(0, 2000);
  const output = await extractor(text, { pooling: "mean", normalize: true });
  const vector = Array.from(output.data);

  const { error: upErr } = await admin
    .from("content_posts")
    .update({ embedding: JSON.stringify(vector) })
    .eq("id", post.id);

  console.log(upErr ? `  ✕ ${post.title}: ${upErr.message}` : `  ✓ ${post.title}`);
}

console.log("Backfill complete.");
