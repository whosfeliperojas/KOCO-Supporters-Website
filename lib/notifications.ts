export type NotificationKind =
  | "content_proposal_new"
  | "content_decision"
  | "content_feedback"
  | "event_proposal_new"
  | "event_decision";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  entity_type: "content" | "event";
  entity_id: string;
  actor_id: string | null;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

/**
 * Where a notification should take the viewer.
 *
 * Content has a single detail route that already adapts to the viewer's role
 * (admin or owner) - see app/(app)/content/[id]/page.tsx. Events have no
 * per-event page, so a notification about one opens the right list instead of
 * a deep link that does not exist.
 */
export function notificationHref(n: Pick<AppNotification, "entity_type" | "entity_id">, isAdmin: boolean): string {
  if (n.entity_type === "content") return `/content/${n.entity_id}`;
  return isAdmin ? "/admin/events" : "/events";
}
