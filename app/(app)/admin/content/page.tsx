import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ContentListClient from "@/components/ContentListClient";
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
    .select("id, title, status, format, channel, publication_date, updated_at, in_general, in_final, publication_cycle_id, design_url, caption, responsible:profiles!responsible_id(full_name)")
    // Oldest proposal first, by its planned publication date. Ideas with no
    // date yet sort last instead of leading the list, and title breaks ties so
    // the order is stable for the several posts that share a date.
    .order("publication_date", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true });

  const { data: cycles } = await supabase
    .from("publication_cycles")
    .select("id, label, cycle_number, final_deadline")
    .order("cycle_number");

  return (
    <ContentListClient
      posts={(posts ?? []) as unknown as Parameters<typeof ContentListClient>[0]["posts"]}
      cycles={cycles ?? []}
      isAdmin={true}
      locale={profile.locale}
    />
  );
}
