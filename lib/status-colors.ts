import type { ContentStatus, EventApproval } from "@/lib/types";

/**
 * The one place a workflow state becomes a colour.
 *
 * Five colours, in the order work actually moves, and the same run whether
 * the thing being tracked is a content post or a proposed event:
 *
 *   being worked on       #ECA040  orange  (in_progress)
 *   with an admin         #FCD4C1  blush   (submitted, in_review / event pending)
 *   approved              #38B39E  teal    (approved / event confirmed)
 *   published             #CDD909  lime
 *   rejected              #E2693E  coral
 *
 * States outside that run keep a deliberately quiet neutral so the five above
 * are the only ones carrying signal: nothing has started yet (draft,
 * not_started), or it is over (cancelled).
 *
 * The chip-* classes in globals.css paint the same palette for the places that
 * style by class name; these values exist for everything that needs the raw
 * colour - calendar squares, dots, event chips. Change both together.
 */
export type StatusColor = {
  /** Fill. */
  bg: string;
  /** Text on that fill, chosen for contrast rather than brand consistency. */
  fg: string;
};

const NEUTRAL: StatusColor = { bg: "#EFE7DA", fg: "#6B6258" };
const WORKING: StatusColor = { bg: "#F7E3CE", fg: "#B07A1A" };
/** With an admin, waiting on a decision - submitted and in_review alike. */
const WAITING: StatusColor = { bg: "#FCD4C1", fg: "#8C3010" };

export const CONTENT_STATUS_COLOR: Record<ContentStatus, StatusColor> = {
  // Nothing has been handed over yet.
  not_started: NEUTRAL,
  draft:       NEUTRAL,
  // The five that carry the real signal - the pipeline a volunteer watches:
  // in progress -> submitted -> approved -> published, with rejected aside.
  //
  // in_progress holds the amber that in_review used to: it is now a pipeline
  // state and needs a colour of its own, and its old pale tint sat too close
  // to submitted's blush to tell apart in the dashboard bar. in_review, no
  // longer in that run, shares submitted's blush - from anyone's point of
  // view both mean the same thing: it is with an admin, awaiting a decision.
  in_progress: { bg: "#ECA040", fg: "#4A2C00" },
  submitted:   WAITING,
  // Retired from the flow (see AdminReviewPanel's TRANSITIONS): nothing new
  // enters it. Existing rows keep rendering, and they mean what submitted
  // means - it is with an admin - so they share its colour.
  in_review:   WAITING,
  approved:    { bg: "#38B39E", fg: "#FFFFFF" },
  published:   { bg: "#CDD909", fg: "#3F4700" },
  rejected:    { bg: "#E2693E", fg: "#FFFFFF" },
  // Done with, one way or another.
  cancelled:   NEUTRAL,
  rescheduled: WORKING,
};

export const EVENT_STATUS_COLOR: Record<EventApproval, StatusColor> = {
  // An event proposal waiting on a decision is the same "waiting on an admin"
  // state as a submitted post, and reads the same colour.
  pending:   { bg: "#FCD4C1", fg: "#8C3010" },
  confirmed: { bg: "#38B39E", fg: "#FFFFFF" },
  rejected:  { bg: "#E2693E", fg: "#FFFFFF" },
  cancelled: NEUTRAL,
};

/** Only the states an admin actually schedules around show up on the calendar. */
export const CALENDAR_STATUSES: ContentStatus[] = ["approved", "published"];
