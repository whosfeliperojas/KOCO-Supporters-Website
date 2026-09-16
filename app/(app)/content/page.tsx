import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ContentListClient from "@/components/ContentListClient";
import { fetchContributors } from "@/lib/contributors";
import type { Profile } from "@/lib/types";

export default async function ContentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, is_admin, locale")
    .eq("auth_user_id", user.id)
    .single();

  const profile = profileData as Pick<Profile, "id" | "is_admin" | "locale"> | null;
  if (!profile) redirect("/auth/login");

  // No responsible_id filter: posts_select already scopes a volunteer to the
  // posts they lead PLUS the ones they are credited on (migration 14), so
  // filtering here would hide exactly the collaborations we just recovered.
  // Admins see everything, as before.
  const { data: posts } = await supabase
    .from("content_posts")
    .select("id, title, status, format, channel, publication_date, created_at, updated_at, is_collaboration, publication_cycle_id, design_url, caption, status_changed_at, volunteer_seen_at, responsible:profiles!responsible_id(full_name)");

  const { data: cycles } = await supabase
    .from("publication_cycles")
    .select("id, label, cycle_number, final_deadline")
    .order("cycle_number");

  // Newest first, matching the admin review tab: the idea you are working on
  // now belongs at the top, not eight months of programme history above it.
  // An idea with no publication date yet sorts by when it was created rather
  // than sinking to the bottom - a brand-new proposal is the newest thing
  // there is. (Scroll position is restored per list in the client, so a long
  // list still comes back where you left it.)
  const sorted = ((posts ?? []) as unknown as { publication_date: string | null; created_at: string; id: string }[])
    .sort((a, b) => (b.publication_date ?? b.created_at).localeCompare(a.publication_date ?? a.created_at));

  const contributors = await fetchContributors(supabase, sorted.map((p) => p.id));

  return (
    <ContentListClient
      posts={sorted as unknown as Parameters<typeof ContentListClient>[0]["posts"]}
      cycles={cycles ?? []}
      contributors={contributors}
      viewerId={profile.id}
      isAdmin={profile.is_admin}
      locale={profile.locale}
    />
  );
}
