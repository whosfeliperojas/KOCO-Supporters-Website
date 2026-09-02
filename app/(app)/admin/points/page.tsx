import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminPointsClient from "@/components/AdminPointsClient";
import type { Profile } from "@/lib/types";

export default async function AdminPointsPage() {
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

  const [groupsRes, volunteersRes, criteriaRes, entriesRes] = await Promise.all([
    supabase
      .from("groups")
      .select("id, code, name")
      .order("code"),

    supabase
      .from("profiles")
      .select("id, full_name, group_id")
      .eq("is_admin", false)
      .eq("active", true)
      .order("full_name"),

    supabase
      .from("point_criteria")
      .select("id, category, description_es, description_en, type, points_per_unit, group_id")
      .eq("active", true)
      .order("sort_order"),

    // No limit: only ~150-200 rows for this whole program, and the admin
    // roster needs every volunteer's full total, not just the recent slice.
    supabase
      .from("point_log_entries")
      .select("id, volunteer_id, criteria_id, date, points_earned, notes, criteria:point_criteria(category, description_es, description_en)")
      .order("date", { ascending: false, nullsFirst: false }),
  ]);

  return (
    <AdminPointsClient
      groups={(groupsRes.data ?? []) as unknown as Parameters<typeof AdminPointsClient>[0]["groups"]}
      volunteers={(volunteersRes.data ?? []) as unknown as Parameters<typeof AdminPointsClient>[0]["volunteers"]}
      criteria={(criteriaRes.data ?? []) as unknown as Parameters<typeof AdminPointsClient>[0]["criteria"]}
      entries={(entriesRes.data ?? []) as unknown as Parameters<typeof AdminPointsClient>[0]["entries"]}
      adminId={profile.id}
      locale={profile.locale}
    />
  );
}
