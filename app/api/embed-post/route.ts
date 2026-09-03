import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { embed, postText } from "@/lib/embeddings";
import { checkRateLimit, clientIdentifier } from "@/lib/ratelimit";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/embed-post   Body: { postId }
 * Computes and stores the embedding for one content post.
 * Caller must be authenticated and be the post's owner or an admin.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = await checkRateLimit("embedPost", clientIdentifier(request, user.id));
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });
  }

  const { postId } = await request.json();
  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const { data: caller } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("auth_user_id", user.id)
    .single();
  if (!caller) {
    return NextResponse.json({ error: "No profile" }, { status: 403 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: post } = await admin
    .from("content_posts")
    .select("id, responsible_id, title, caption, script, content_type")
    .eq("id", postId)
    .single();
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (post.responsible_id !== caller.id && !caller.is_admin) {
    return NextResponse.json({ error: "Not your post" }, { status: 403 });
  }

  // Indexing a post for future similarity search is a nicety. The post is
  // already saved by the time this runs, so a model that cannot load must not
  // turn into a red error in the volunteer's console.
  let vectorData: number[];
  try {
    vectorData = await embed(postText(post), "passage");
  } catch (e) {
    console.warn("[embed-post] semantic indexing skipped:", (e as Error).message);
    return NextResponse.json({ ok: true, indexed: false });
  }

  const { error } = await admin
    .from("content_posts")
    .update({ embedding: JSON.stringify(vectorData) })
    .eq("id", postId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, indexed: true });
}
