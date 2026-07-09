// Server-only embedding util. Runs a small multilingual model locally with
// transformers.js — no external API, no cost. First call downloads the model
// (~100 MB, cached); after that embeddings take ~50ms.
// Model: multilingual-e5-small (384 dims) — handles Spanish, English, Korean.
import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

let extractor: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor() {
  if (!extractor) {
    extractor = (
      pipeline("feature-extraction", "Xenova/multilingual-e5-small", {
        dtype: "q8",
      }) as Promise<FeatureExtractionPipeline>
    ).catch((err) => {
      // Don't cache a failed load — a transient network/download hiccup would
      // otherwise permanently disable semantic search for the process's
      // lifetime (every future call would keep getting this same rejection).
      extractor = null;
      throw err;
    });
  }
  return extractor;
}

/**
 * e5 models expect a task prefix: "query:" for search text,
 * "passage:" for stored documents.
 */
export async function embed(text: string, kind: "query" | "passage"): Promise<number[]> {
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
