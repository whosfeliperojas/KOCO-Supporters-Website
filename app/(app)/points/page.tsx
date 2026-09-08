import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PointsClient from "@/components/PointsClient";
import type { Profile } from "@/lib/types";

export default async function PointsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, is_admin, locale, full_name")
    .eq("auth_user_id", user.id)
    .single();

  const profile = profileData as Pick<Profile, "id" | "is_admin" | "locale" | "full_name"> | null;
  if (!profile) redirect("/auth/login");

  // Every point award is already listed below - visiting here IS seeing them,
  // so it clears the matching bell notifications the same way opening a
  // content post or the events pages clears theirs.
  await supabase.rpc("mark_notifications_by_kind_read", { p_kinds: ["points_awarded"] });

  const { data: entries } = await supabase
    .from("point_log_entries")
    .select("id, date, points_earned, notes, criteria:point_criteria(category, description_es, description_en, type)")
    .eq("volunteer_id", profile.id)
    .order("date", { ascending: false, nullsFirst: false });

  return (
    <PointsClient
      entries={(entries ?? []) as unknown as Parameters<typeof PointsClient>[0]["entries"]}
      locale={profile.locale}
      volunteerName={profile.full_name}
    />
  );
}
