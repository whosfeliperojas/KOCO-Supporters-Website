import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/DashboardClient";
import AdminDashboardClient from "@/components/AdminDashboardClient";
import type { Profile } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const profileQuery = await supabase
    .from("profiles")
    .select("*, group:groups(*)")
    .eq("auth_user_id", user.id)
    .single();

  const profile = profileQuery.data as Profile | null;
  if (!profile) redirect("/auth/login");

  // ── Admin dashboard: submission tracker + events calendar ──
  if (profile.is_admin) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString().split("T")[0];

    const [volunteersRes, postsRes, eventsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, display_name")
        .eq("is_admin", false)
        .eq("active", true)
        .order("full_name"),

      supabase
        .from("content_posts")
        .select("responsible_id, status, created_at")
        .gte("created_at", monthStart),

      supabase
        .from("events")
        .select("id, name, host, event_date_start, event_date_end, start_time, end_time, place, description, max_invited_koco, registration_status")
        .eq("approval_status", "confirmed")
        .order("event_date_start"),
    ]);

    return (
      <AdminDashboardClient
        adminName={profile.display_name ?? profile.full_name.split(" ")[0]}
        volunteers={(volunteersRes.data ?? []) as unknown as Parameters<typeof AdminDashboardClient>[0]["volunteers"]}
        monthPosts={(postsRes.data ?? []) as unknown as Parameters<typeof AdminDashboardClient>[0]["monthPosts"]}
        events={(eventsRes.data ?? []) as unknown as Parameters<typeof AdminDashboardClient>[0]["events"]}
        locale={profile.locale}
      />
    );
  }

  // ── Volunteer dashboard ──
  const [pointsRes, eventsRes, postsRes, proposalsRes] = await Promise.all([
    supabase
      .from("point_log_entries")
      .select("points_earned, date, notes, criteria:point_criteria(category, description_es, description_en)")
      .eq("volunteer_id", profile.id)
      .order("date", { ascending: false, nullsFirst: false })
      .limit(50),

    supabase
      .from("events")
      .select("id, name, event_date_start, event_date_end, place, approval_status, registration_status")
      .eq("approval_status", "confirmed")
      .gte("event_date_start", new Date().toISOString().split("T")[0])
      .order("event_date_start")
      .limit(5),

    // All own posts — the dashboard needs full status counts, not just recents
    supabase
      .from("content_posts")
      .select("id, title, status, publication_date, format")
      .eq("responsible_id", profile.id)
      .order("updated_at", { ascending: false }),

    supabase
      .from("events")
      .select("id, name, event_date_start, approval_status")
      .eq("proposed_by_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <DashboardClient
      profile={profile}
      points={(pointsRes.data ?? []) as unknown as Parameters<typeof DashboardClient>[0]["points"]}
      upcomingEvents={(eventsRes.data ?? []) as unknown as Parameters<typeof DashboardClient>[0]["upcomingEvents"]}
      recentPosts={(postsRes.data ?? []) as unknown as Parameters<typeof DashboardClient>[0]["recentPosts"]}
      myProposals={(proposalsRes.data ?? []) as unknown as Parameters<typeof DashboardClient>[0]["myProposals"]}
    />
  );
}
