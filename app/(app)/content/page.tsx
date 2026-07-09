import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ContentListClient from "@/components/ContentListClient";
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

  let query = supabase
    .from("content_posts")
    .select("id, title, status, format, channel, publication_date, updated_at, responsible:profiles!responsible_id(full_name)")
    .order("updated_at", { ascending: false });

  if (!profile.is_admin) {
    query = query.eq("responsible_id", profile.id);
  }

  const { data: posts } = await query;
  const { data: cycles } = await supabase
    .from("publication_cycles")
    .select("id, label, cycle_number, final_deadline")
    .order("cycle_number");

  return (
    <ContentListClient
      posts={(posts ?? []) as unknown as Parameters<typeof ContentListClient>[0]["posts"]}
      cycles={cycles ?? []}
      isAdmin={profile.is_admin}
      locale={profile.locale}
    />
  );
}
