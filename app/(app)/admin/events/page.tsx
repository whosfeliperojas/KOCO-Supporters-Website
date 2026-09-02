import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminEventsClient from "@/components/AdminEventsClient";
import type { Profile } from "@/lib/types";

export default async function AdminEventsPage() {
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

  const [eventsRes, attendeesRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, host, event_date_start, event_date_end, date_note, start_time, end_time, place, description, max_invited_koco, approval_status, registration_status, proposer:profiles!events_proposed_by_id_fkey(display_name, full_name)")
      .order("event_date_start", { ascending: false, nullsFirst: false }),

    supabase
      .from("event_attendees")
      .select("event_id, rsvp"),
  ]);

  const acceptedCounts: Record<string, number> = {};
  for (const a of (attendeesRes.data ?? []) as { event_id: string; rsvp: string }[]) {
    if (a.rsvp === "accepted") {
      acceptedCounts[a.event_id] = (acceptedCounts[a.event_id] ?? 0) + 1;
    }
  }

  return (
    <AdminEventsClient
      events={(eventsRes.data ?? []) as unknown as Parameters<typeof AdminEventsClient>[0]["events"]}
      acceptedCounts={acceptedCounts}
      adminId={profile.id}
      locale={profile.locale}
    />
  );
}
