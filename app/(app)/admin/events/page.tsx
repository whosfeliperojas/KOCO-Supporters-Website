import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminEventsClient from "@/components/AdminEventsClient";
import type { EventSignup } from "@/components/EventAttendeesPanel";
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

  const [eventsRes, attendeesRes, rosterRes, groupsRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, host, event_date_start, event_date_end, date_note, start_time, end_time, place, description, max_invited_koco, approval_status, registration_status, proposer:profiles!events_proposed_by_id_fkey(display_name, full_name)")
      .order("event_date_start", { ascending: false, nullsFirst: false }),

    // Who signed up, by name. Admins can read profiles directly, so this is a
    // plain join - no RPC needed as there is on the content side.
    supabase
      .from("event_attendees")
      .select("id, event_id, volunteer_id, role, attended, rsvp, signed_up_at, volunteer:profiles!event_attendees_volunteer_id_fkey(full_name, group_id)")
      .order("signed_up_at", { ascending: true }),

    // For the "add a person" control: anyone active can be put on a list.
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("active", true)
      .eq("is_admin", false)
      .order("full_name"),

    supabase.from("groups").select("id, code"),
  ]);

  const groupCode: Record<string, string> = {};
  for (const g of (groupsRes.data ?? []) as { id: string; code: string }[]) {
    groupCode[g.id] = g.code;
  }

  type AttendeeRow = {
    id: string;
    event_id: string;
    volunteer_id: string;
    role: "attendee" | "support";
    attended: boolean | null;
    rsvp: "accepted" | "declined";
    signed_up_at: string;
    volunteer: { full_name: string; group_id: string | null } | null;
  };

  const signupsByEvent: Record<string, EventSignup[]> = {};
  const acceptedCounts: Record<string, number> = {};
  for (const a of (attendeesRes.data ?? []) as unknown as AttendeeRow[]) {
    if (a.rsvp === "accepted") {
      acceptedCounts[a.event_id] = (acceptedCounts[a.event_id] ?? 0) + 1;
    }
    (signupsByEvent[a.event_id] ??= []).push({
      id: a.id,
      event_id: a.event_id,
      volunteer_id: a.volunteer_id,
      role: a.role,
      attended: a.attended,
      rsvp: a.rsvp,
      signed_up_at: a.signed_up_at,
      // A signup whose profile was deleted would otherwise render blank.
      name: a.volunteer?.full_name ?? "—",
      group_code: a.volunteer?.group_id ? groupCode[a.volunteer.group_id] ?? null : null,
    });
  }

  return (
    <AdminEventsClient
      events={(eventsRes.data ?? []) as unknown as Parameters<typeof AdminEventsClient>[0]["events"]}
      acceptedCounts={acceptedCounts}
      signupsByEvent={signupsByEvent}
      roster={rosterRes.data ?? []}
      adminId={profile.id}
      locale={profile.locale}
    />
  );
}
