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
    .select("id, title, status, format, channel, publication_date, updated_at, in_general, in_final, is_collaboration, publication_cycle_id, design_url, caption, responsible:profiles!responsible_id(full_name)")
    // Oldest first, by planned publication date: the list reads as the story of
    // the programme from March forward. Undated ideas sort last rather than
    // leading, and title breaks ties so the order never shuffles between loads.
    .order("publication_date", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });

  const { data: cycles } = await supabase
    .from("publication_cycles")
    .select("id, label, cycle_number, final_deadline")
    .order("cycle_number");

  const contributors = await fetchContributors(supabase, (posts ?? []).map((p) => p.id));

  return (
    <ContentListClient
      posts={(posts ?? []) as unknown as Parameters<typeof ContentListClient>[0]["posts"]}
      cycles={cycles ?? []}
      contributors={contributors}
      viewerId={profile.id}
      isAdmin={profile.is_admin}
      locale={profile.locale}
    />
  );
}
