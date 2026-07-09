import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EventsClient from "@/components/EventsClient";
import type { Profile } from "@/lib/types";

export default async function EventsPage() {
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

  const [eventsRes, attendeesRes, proposalsRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, host, event_date_start, event_date_end, start_time, end_time, place, description, max_invited_koco, approval_status, registration_status")
      .eq("approval_status", "confirmed")
      .order("event_date_start"),

    supabase
      .from("event_attendees")
      .select("event_id, volunteer_id, rsvp"),

    // The volunteer's own proposals, whatever their review state
    supabase
      .from("events")
      .select("id, name, event_date_start, place, description, approval_status")
      .eq("proposed_by_id", profile.id)
      .order("created_at", { ascending: false }),
  ]);

  const attendees = (attendeesRes.data ?? []) as { event_id: string; volunteer_id: string; rsvp: string }[];

  const acceptedCounts: Record<string, number> = {};
  const myRsvps: Record<string, "accepted" | "declined"> = {};
  for (const a of attendees) {
    if (a.rsvp === "accepted") {
      acceptedCounts[a.event_id] = (acceptedCounts[a.event_id] ?? 0) + 1;
    }
    if (a.volunteer_id === profile.id) {
      myRsvps[a.event_id] = a.rsvp as "accepted" | "declined";
    }
  }

  return (
    <EventsClient
      events={(eventsRes.data ?? []) as unknown as Parameters<typeof EventsClient>[0]["events"]}
      myRsvps={myRsvps}
      acceptedCounts={acceptedCounts}
      myProposals={(proposalsRes.data ?? []) as unknown as Parameters<typeof EventsClient>[0]["myProposals"]}
      profileId={profile.id}
      isAdmin={profile.is_admin}
      locale={profile.locale}
    />
  );
}
