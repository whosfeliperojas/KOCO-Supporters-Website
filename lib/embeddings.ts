// Server-only embedding util, used for semantic near-duplicate detection.
//
// The model runs locally through transformers.js — no external API, no cost.
// That works well on a developer machine, where the ~100 MB model downloads
// once and is cached.
//
// It does NOT work on Vercel. Serverless functions get a read-only filesystem
// apart from /tmp, and every cold start would have to re-download the model,
// which either times out or exhausts the function's memory. Worse, the package
// pulls in onnxruntime's native binary, which fails to load in the serverless
// bundle at IMPORT time — so a plain top-level `import` took down the whole
// route with a 500 before any handler code ran. That is what broke
// /api/similar-ideas and /api/embed-post in production.
//
// So: the import is dynamic (a load failure can be caught), and semantic search
// is off unless EMBEDDINGS_ENABLED is set. The trigram title check in
// match_similar_titles is pure Postgres, needs none of this, and is the part
// that actually catches duplicate proposals — it keeps working either way.
import type { FeatureExtractionPipeline } from "@huggingface/transformers";

/** Thrown when semantic search is unavailable. Callers degrade; they never fail. */
export class EmbeddingsUnavailableError extends Error {}

/**
 * Whether to attempt semantic search at all.
 *
 * Opt-in rather than opt-out: on a host that cannot run the model, trying and
 * failing costs a cold start's worth of download on every single request.
 */
export function embeddingsEnabled(): boolean {
  return process.env.EMBEDDINGS_ENABLED === "true";
}

let extractor: Promise<FeatureExtractionPipeline> | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    extractor = (async () => {
      // Dynamic: if the native runtime cannot load here, it throws where we can
      // catch it, instead of killing the route at module scope.
      const { pipeline } = await import("@huggingface/transformers");
      return (await pipeline("feature-extraction", "Xenova/multilingual-e5-small", {
        dtype: "q8",
      })) as FeatureExtractionPipeline;
    })().catch((err) => {
      // Don't cache a failed load — a transient download hiccup would otherwise
      // disable semantic search for the whole process lifetime.
      extractor = null;
      throw new EmbeddingsUnavailableError(String((err as Error)?.message ?? err));
    });
  }
  return extractor;
}

/**
 * e5 models expect a task prefix: "query:" for search text,
 * "passage:" for stored documents.
 *
 * Throws EmbeddingsUnavailableError when the model is off or cannot load.
 */
export async function embed(text: string, kind: "query" | "passage"): Promise<number[]> {
  if (!embeddingsEnabled()) {
    throw new EmbeddingsUnavailableError("EMBEDDINGS_ENABLED is not set");
  }
  const pipe = await getExtractor();
  const input = `${kind}: ${text.slice(0, 2000)}`;
  const output = await pipe(input, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/** The text we index for a content post */
export function postText(post: { title?: string | null; caption?: string | null; script?: string | null; content_type?: string | null }) {
  return [post.title, post.content_type, post.caption, post.script]
    .filter(Boolean)
    .join("\n");
}
