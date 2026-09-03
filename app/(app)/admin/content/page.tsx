import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ContentListClient from "@/components/ContentListClient";
import { fetchContributors } from "@/lib/contributors";
import ReviewQueue, { type PendingPost } from "@/components/ReviewQueue";
import type { Profile } from "@/lib/types";

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

  // All proposals — admins review, approve, cancel, or schedule from here
  const { data: posts } = await supabase
    .from("content_posts")
    .select("id, title, status, format, channel, publication_date, updated_at, in_general, in_final, is_collaboration, publication_cycle_id, design_url, caption, responsible:profiles!responsible_id(full_name)")
    // Oldest proposal first, by its planned publication date. Ideas with no
    // date yet sort last instead of leading the list, and title breaks ties so
    // the order is stable for the several posts that share a date.
    .order("publication_date", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });

  const { data: cycles } = await supabase
    .from("publication_cycles")
    .select("id, label, cycle_number, final_deadline")
    .order("cycle_number");

  const contributors = await fetchContributors(supabase, (posts ?? []).map((p) => p.id));

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
  const pending: PendingPost[] = ((pendingData ?? []) as unknown as PendingRow[]).map((p) => {
    const r = Array.isArray(p.responsible) ? p.responsible[0] : p.responsible;
    return { ...p, responsible_name: r?.full_name ?? null };
  });

  return (
    <div className="space-y-6">
      <div className="max-w-4xl mx-auto">
        <ReviewQueue posts={pending} />
      </div>
      <ContentListClient
      posts={(posts ?? []) as unknown as Parameters<typeof ContentListClient>[0]["posts"]}
      cycles={cycles ?? []}
      contributors={contributors}
      viewerId={profile.id}
      isAdmin={true}
      locale={profile.locale}
      />
    </div>
  );
}
