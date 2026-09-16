import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ContentListClient from "@/components/ContentListClient";
import { fetchContributors } from "@/lib/contributors";
import ReviewQueue, { type PendingPost } from "@/components/ReviewQueue";
import type { ContentStatus, Profile } from "@/lib/types";

export default async function AdminContentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, is_admin, locale")
    .eq("auth_user_id", user.id)
    .single();

  const profile = profileData as Pick<Profile, "id" | "is_admin" | "locale"> | null;
  if (!profile?.is_admin) redirect("/dashboard");

  // All proposals — admins review, approve, cancel, or schedule from here.
  //
  // in_general / in_final are no longer selected: the Parrilla general/final
  // toggle is gone from this tab (the sheet it mirrored is retired). The
  // columns stay in the database as the record of which grid each idea came
  // from; nothing in the app reads them any more.
  const [{ data: rawPosts }, { data: groups }, { data: cycles }] = await Promise.all([
    supabase
      .from("content_posts")
      .select("id, title, status, format, channel, publication_date, created_at, updated_at, is_collaboration, publication_cycle_id, design_url, caption, responsible:profiles!responsible_id(full_name, group_id)"),
    supabase.from("groups").select("id, code"),
    supabase
      .from("publication_cycles")
      .select("id, label, cycle_number, final_deadline")
      .order("cycle_number"),
  ]);

  const groupCode: Record<string, string> = {};
  for (const g of (groups ?? []) as { id: string; code: string }[]) groupCode[g.id] = g.code;

  type Responsible = { full_name: string; group_id: string | null };
  type RawPost = {
    id: string;
    title: string;
    status: ContentStatus;
    format: string | null;
    channel: string | null;
    publication_date: string | null;
    created_at: string;
    updated_at: string;
    is_collaboration: boolean;
    publication_cycle_id: string | null;
    design_url: string | null;
    caption: string | null;
    responsible: Responsible | Responsible[] | null;
  };

  // Newest first. An idea's date on this tab is the day it is meant to go out,
  // but a fresh proposal has no date yet — sorting those last would bury the
  // rows most likely to need a decision, so an undated idea sorts by when it
  // was created instead. Both are "when does this belong on the calendar",
  // answered by the best fact available.
  const posts = ((rawPosts ?? []) as unknown as RawPost[])
    .map((p) => {
      const r = Array.isArray(p.responsible) ? p.responsible[0] : p.responsible;
      return {
        ...p,
        // KOCO-B / KOCO-R, carried from the responsible volunteer. Null when
        // nobody is assigned (the unattributed workbook collaborations).
        group_code: r?.group_id ? groupCode[r.group_id] ?? null : null,
      };
    })
    .sort((a, b) => (b.publication_date ?? b.created_at).localeCompare(a.publication_date ?? a.created_at));

  const contributors = await fetchContributors(supabase, posts.map((p) => p.id));

  // What is actually waiting on an admin. Sorted oldest-submitted first, so the
  // proposal that has been waiting longest is answered first.
  const { data: pendingData } = await supabase
    .from("content_posts")
    .select("id, title, status, format, channel, publication_date, submitted_at, responsible:profiles!responsible_id(full_name)")
    .in("status", ["submitted", "in_review"])
    .order("submitted_at", { ascending: true, nullsFirst: false });

  type PendingRow = Omit<PendingPost, "responsible_name"> & {
    responsible: { full_name: string } | { full_name: string }[] | null;
  };
  // A queued proposal that shares a title with a post already in the grid is
  // almost always the same idea reaching the queue twice — that is how a
  // duplicate of an already-published post ended up sitting at the top of the
  // review list waiting for a decision. Flag it; never merge it automatically.
  const flat = (t: string) =>
    t
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // strip accents: "Acompañame" === "Acompaname"
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const pending: PendingPost[] = ((pendingData ?? []) as unknown as PendingRow[]).map((p) => {
    const r = Array.isArray(p.responsible) ? p.responsible[0] : p.responsible;
    const twins = posts.filter((o) => o.id !== p.id && flat(o.title) === flat(p.title));
    // An already-published twin is the one worth warning about.
    const twin = twins.find((o) => o.status === "published") ?? twins[0];
    return {
      ...p,
      responsible_name: r?.full_name ?? null,
      duplicateOf: twin
        ? { status: twin.status, date: twin.publication_date as string | null }
        : null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <ReviewQueue posts={pending} />
      </div>
      <ContentListClient
      posts={posts as unknown as Parameters<typeof ContentListClient>[0]["posts"]}
      cycles={cycles ?? []}
      contributors={contributors}
      viewerId={profile.id}
      isAdmin={true}
      locale={profile.locale}
      />
    </div>
  );
}
