import { CONTENT_STATUS_LABEL, EVENT_APPROVAL_LABEL, type Locale } from "@/lib/i18n";
import type { ContentStatus, EventApproval } from "@/lib/types";

export type NotificationKind =
  | "content_proposal_new"
  | "content_decision"
  | "content_feedback"
  | "event_proposal_new"
  | "event_decision"
  | "event_signup";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  entity_type: "content" | "event";
  entity_id: string;
  actor_id: string | null;
  /** Denormalized at the moment of creation - who did it. Null for older rows. */
  actor_name: string | null;
  title: string;
  body: string | null;
  /** Only set on content_decision / event_decision - the exact transition. */
  from_status: string | null;
  to_status: string | null;
  /** content_proposal_new only: a resubmission after feedback, not a first idea. */
  is_resubmission: boolean;
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

const SOMEONE = { es: "Alguien", en: "Someone", ko: "누군가" } as const;

/**
 * Turns one notification into an actual sentence, naming who did what.
 *
 * This is the one place that composition happens, so the bell's rendering
 * stays a straight map over the list. actor_name/from_status/to_status/
 * is_resubmission are only populated from migration 32 onward - older rows
 * (or a row somehow missing the actor) fall back to a generic phrase rather
 * than rendering "null" or an empty name.
 */
export function describeNotification(n: AppNotification, locale: Locale): string {
  const who = n.actor_name?.trim() || SOMEONE[locale];
  const to = n.to_status
    ? (n.entity_type === "content"
        ? CONTENT_STATUS_LABEL[n.to_status as ContentStatus]?.[locale]
        : EVENT_APPROVAL_LABEL[n.to_status as EventApproval]?.[locale])
    : null;

  switch (n.kind) {
    case "content_proposal_new":
      return n.is_resubmission
        ? { es: `${who} corrigió y reenvió`, en: `${who} revised and resent`, ko: `${who}님이 수정 후 다시 보냈어요:` }[locale]
        : { es: `Nueva propuesta de ${who}`, en: `New proposal from ${who}`, ko: `${who}님의 새 제안이에요:` }[locale];

    case "content_decision":
      return to
        ? { es: `Tu propuesta pasó a: ${to}`, en: `Your proposal is now: ${to}`, ko: `제안 상태가 바뀌었어요: ${to}` }[locale]
        : { es: "El estado de tu propuesta cambió", en: "Your proposal's status changed", ko: "제안 상태가 바뀌었어요" }[locale];

    case "content_feedback":
      return { es: `Nuevo comentario de ${who}`, en: `New comment from ${who}`, ko: `${who}님의 새 댓글이에요:` }[locale];

    case "event_proposal_new":
      return { es: `Nuevo evento propuesto por ${who}`, en: `New event proposed by ${who}`, ko: `${who}님이 새 행사를 제안했어요:` }[locale];

    case "event_decision":
      return to
        ? { es: `Tu evento pasó a: ${to}`, en: `Your event is now: ${to}`, ko: `행사 상태가 바뀌었어요: ${to}` }[locale]
        : { es: "El estado de tu evento cambió", en: "Your event's status changed", ko: "행사 상태가 바뀌었어요" }[locale];

    case "event_signup":
      return { es: `${who} se inscribió en`, en: `${who} signed up for`, ko: `${who}님이 신청했어요:` }[locale];
  }
}
