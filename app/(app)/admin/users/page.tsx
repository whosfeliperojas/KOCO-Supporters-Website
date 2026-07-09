import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminUsersClient from "@/components/AdminUsersClient";
import type { Profile } from "@/lib/types";

export default async function AdminUsersPage() {
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

  const [profilesRes, pointsRes, groupsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, display_name, is_admin, active, auth_user_id, group:groups(code, name)")
      .order("full_name"),

    supabase
      .from("point_log_entries")
      .select("volunteer_id, points_earned"),

    supabase
      .from("groups")
      .select("id, code, name")
      .order("code"),
  ]);

  const pointTotals: Record<string, number> = {};
  for (const e of (pointsRes.data ?? [])) {
    const entry = e as { volunteer_id: string; points_earned: number };
    pointTotals[entry.volunteer_id] = (pointTotals[entry.volunteer_id] ?? 0) + entry.points_earned;
  }

  return (
    <AdminUsersClient
      profiles={(profilesRes.data ?? []) as unknown as Parameters<typeof AdminUsersClient>[0]["profiles"]}
      pointTotals={pointTotals}
      groups={groupsRes.data ?? []}
      locale={profile.locale}
    />
  );
}
