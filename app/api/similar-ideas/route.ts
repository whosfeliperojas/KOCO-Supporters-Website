import { createClient } from "@/lib/supabase/server";
import { embed } from "@/lib/embeddings";
import { checkRateLimit, clientIdentifier } from "@/lib/ratelimit";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/similar-ideas
 * Body: { title: string, text?: string, excludeId?: string }
 * Returns: {
 *   titleMatches: [{ id, title, responsible_name, sim }],
 *   similar:      [{ id, title, status, responsible_name, similarity }]
 * }
 * Authenticated users only. Title check is trigram-based; idea check is semantic.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = await checkRateLimit("similarIdeas", clientIdentifier(request, user.id));
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });
  }

  const body = await request.json();
  const title = (body.title ?? "").trim();
  const text = (body.text ?? "").trim();
  const excludeId = body.excludeId || null;

  if (!title && !text) {
    return NextResponse.json({ titleMatches: [], similar: [] });
  }

  // 1. Fuzzy title duplicates (fast, no AI)
  let titleMatches: unknown[] = [];
  if (title) {
    const { data } = await supabase.rpc("match_similar_titles", {
      q: title,
      exclude_post: excludeId,
    });
    titleMatches = data ?? [];
  }

  // 2. Semantic near-duplicates (embedding + pgvector)
  let similar: unknown[] = [];
  const searchText = [title, text].filter(Boolean).join("\n");
  if (searchText.length >= 8) {
    try {
      const queryEmbedding = await embed(searchText, "query");
      const { data } = await supabase.rpc("match_similar_ideas", {
        query_embedding: JSON.stringify(queryEmbedding),
        match_count: 4,
        exclude_post: excludeId,
      });
      // Only surface meaningful matches
      similar = (data ?? []).filter((r: { similarity: number }) => r.similarity > 0.86);
    } catch (e) {
      // Embedding model unavailable (e.g. first download interrupted) —
      // title check still works; don't fail the request.
      console.error("[similar-ideas] embedding failed:", (e as Error).message);
    }
  }

  return NextResponse.json({ titleMatches, similar });
}
