// ─── Database types (mirrors 00_schema.sql) ───────────────────────────────────

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type ContentStatus =
  | "draft"
  // The workbook's own Estatus values. "Sin comenzar" and "En progreso" were
  // both imported as draft and shown as "Borrador", a word the sheet never
  // uses; migration 17 separated them.
  | "not_started"
  | "in_progress"
  | "submitted"
  | "in_review"
  | "approved"
  | "published"
  | "rejected"
  | "cancelled"
  | "rescheduled";

export type EventApproval = "pending" | "confirmed" | "rejected" | "cancelled";
export type EventRegistration = "open" | "closed";
export type AttendeeRole = "attendee" | "support";
export type CriteriaType = "core" | "extra";
export type Locale = "es" | "en" | "ko";

export interface Group {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface Profile {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  display_name: string | null;
  group_id: string | null;
  is_admin: boolean;
  locale: Locale;
  active: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  group?: Group;
}

export interface PointCriteria {
  id: string;
  group_id: string | null;
  type: CriteriaType;
  category: string;
  description_es: string | null;
  description_en: string | null;
  points_per_unit: number;
  max_points: number | null;
  notes_es: string | null;
  notes_en: string | null;
  active: boolean;
  sort_order: number;
}

export interface Event {
  id: string;
  name: string;
  host: string | null;
  proposed_by_text: string | null;
  proposed_by_id: string | null;
  /** NULL when the event is planned but not yet scheduled - see date_note. */
  event_date_start: string | null;
  event_date_end: string | null;
  /** The sheet's own wording when the date cell is not a date, e.g. "Early November". */
  date_note: string | null;
  start_time: string | null;
  end_time: string | null;
  place: string | null;
  description: string | null;
  max_invited_koco: number | null;
  approval_status: EventApproval;
  registration_status: EventRegistration;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  attendee_count?: number;
  user_is_attending?: boolean;
}

export interface EventAttendee {
  id: string;
  event_id: string;
  volunteer_id: string;
  role: AttendeeRole;
  /** NULL until an admin records whether they actually turned up. */
  attended: boolean | null;
  /** Answered once at signup and permanent - see migration 04. */
  rsvp: "accepted" | "declined";
  signed_up_at: string;
  // Joined
  volunteer?: Profile;
  event?: Event;
}

export interface PublicationCycle {
  id: string;
  year: number;
  cycle_number: number;
  label: string | null;
  first_draft_deadline: string | null;
  second_draft_deadline: string | null;
  final_deadline: string | null;
}

export interface ContentPost {
  id: string;
  title: string;
  responsible_id: string | null;
  publication_cycle_id: string | null;
  publication_date: string | null;
  channel: string | null;
  format: string | null;
  content_type: string | null;
  status: ContentStatus;
  caption: string | null;
  script: string | null;
  hashtags: string | null;
  design_url: string | null;
  preview_url: string | null;
  /** Workbook Responsable said "Colaboraciones" - the team worked on it together. */
  is_collaboration: boolean;
  admin_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_feedback: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  responsible?: Profile;
  publication_cycle?: PublicationCycle;
  reel_specs?: ReelSpecs;
}

/**
 * One person credited on a post. `responsible_id` above stays the single
 * accountable lead; this is the full credit list, including the collaborators
 * recovered from the Parrilla cell comments.
 *
 * `name` comes from list_post_contributors, not from a join: volunteers may
 * read only their own profiles row, so an ordinary join returns nulls for
 * everyone else. That function returns the stored full_name for everyone —
 * the roster has four Lauras, so first names alone are not identifying.
 */
export interface Contributor {
  content_post_id: string;
  profile_id: string;
  name: string;
  role: "lead" | "collaborator";
  /** app = added in the app; the other two are the imported record. */
  source: "app" | "sheet_comment" | "team_credit";
}

/** post id -> everyone credited on it, lead first. */
export type ContributorMap = Record<string, Contributor[]>;

export interface ReelSpecs {
  id: string;
  content_post_id: string;
  duration_seconds: number | null;
  aspect_ratio_confirmed: boolean | null;
  audio_clean_confirmed: boolean | null;
  subject_framing_ok: boolean | null;
  safe_margins_ok: boolean | null;
  subtitles_included: boolean | null;
  subtitle_note: string | null;
  music_not_embedded: boolean | null;
  cover_designed: boolean | null;
  cover_headline: string | null;
  brand_typography_ok: boolean | null;
}

export interface PointLogEntry {
  id: string;
  volunteer_id: string;
  criteria_id: string;
  /** NULL when the source Points Log left the date cell blank. */
  date: string | null;
  points_earned: number;
  notes: string | null;
  event_id: string | null;
  content_post_id: string | null;
  recorded_by: string | null;
  created_at: string;
  // Joined
  volunteer?: Profile;
  criteria?: PointCriteria;
}

export interface ContentRule {
  id: string;
  source: "content_grid" | "point_system";
  rule_number: number | null;
  title_es: string | null;
  title_en: string | null;
  description_es: string | null;
  description_en: string | null;
  active: boolean;
  sort_order: number;
}

// ─── Supabase Database shape (for createClient generics) ─────────────────────

export interface Database {
  public: {
    Tables: {
      groups: { Row: Group; Insert: Omit<Group, "id">; Update: Partial<Group> };
      profiles: { Row: Profile; Insert: Omit<Profile, "id" | "created_at" | "updated_at">; Update: Partial<Profile> };
      point_criteria: { Row: PointCriteria; Insert: Omit<PointCriteria, "id">; Update: Partial<PointCriteria> };
      events: { Row: Event; Insert: Omit<Event, "id" | "created_at" | "updated_at">; Update: Partial<Event> };
      event_attendees: { Row: EventAttendee; Insert: Omit<EventAttendee, "id" | "signed_up_at">; Update: Partial<EventAttendee> };
      publication_cycles: { Row: PublicationCycle; Insert: Omit<PublicationCycle, "id">; Update: Partial<PublicationCycle> };
      content_posts: { Row: ContentPost; Insert: Omit<ContentPost, "id" | "created_at" | "updated_at">; Update: Partial<ContentPost> };
      reel_specs: { Row: ReelSpecs; Insert: Omit<ReelSpecs, "id">; Update: Partial<ReelSpecs> };
      point_log_entries: { Row: PointLogEntry; Insert: Omit<PointLogEntry, "id" | "created_at">; Update: Partial<PointLogEntry> };
      content_rules: { Row: ContentRule; Insert: Omit<ContentRule, "id">; Update: Partial<ContentRule> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// ─── App-level helpers ────────────────────────────────────────────────────────

export interface AppUser {
  profile: Profile;
  isAdmin: boolean;
}

export type TranslationKey = "es" | "en" | "ko";
