import { CONTENT_STATUS_LABEL, EVENT_APPROVAL_LABEL, type Locale } from "@/lib/i18n";
import type { ContentStatus, EventApproval } from "@/lib/types";

export type NotificationKind =
  | "content_proposal_new"
  | "content_decision"
  | "content_feedback"
  | "event_proposal_new"
  | "event_decision"
  | "event_signup"
  | "points_awarded";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  entity_type: "content" | "event" | "points";
  entity_id: string;
  actor_id: string | null;
  /** Denormalized at the moment of creation - who did it. Null for older rows. */
  actor_name: string | null;
  /**
   * The linked post/event's own name. Locale-invariant (a title is the same
   * text regardless of viewer language), which is why it is safe to render
   * directly - unlike criteria_es/criteria_en below.
   *
   * Nullable only for points_awarded: a general award (attendance,
   * participation) names no specific post or event, and the criteria
   * description is the only detail there is.
   */
  title: string | null;
  body: string | null;
  /** Only set on content_decision / event_decision - the exact transition. */
  from_status: string | null;
  to_status: string | null;
  /** content_proposal_new only: a resubmission after feedback, not a first idea. */
  is_resubmission: boolean;
  /** points_awarded only. */
  points: number | null;
  /** points_awarded only - what kind of work it was for, when it names one. */
  points_source: "content" | "event" | null;
  /**
   * points_awarded only. point_criteria has no Korean column - PointsClient
   * already falls back to English for ko, and this does the same - so the
   * choice has to happen at render time, per viewer, rather than being
   * resolved once when the row was written.
   */
  criteria_es: string | null;
  criteria_en: string | null;
  read_at: string | null;
  created_at: string;
}

/**
 * Where a notification should take the viewer.
 *
 * Content has a single detail route that already adapts to the viewer's role
 * (admin or owner) - see app/(app)/content/[id]/page.tsx. Events have no
 * per-event page, so a notification about one opens the right list instead of
 * a deep link that does not exist. Points notifications only ever go to the
 * volunteer who earned them - admins award points, they never receive one.
 */
export function notificationHref(n: Pick<AppNotification, "entity_type" | "entity_id">, isAdmin: boolean): string {
  if (n.entity_type === "content") return `/content/${n.entity_id}`;
  if (n.entity_type === "points") return "/points";
  return isAdmin ? "/admin/events" : "/events";
}

const SOMEONE = { es: "Alguien", en: "Someone", ko: "누군가" } as const;

/** The criteria text in the viewer's language, same es-first/en-first fallback PointsClient already uses. */
export function pointsCriteriaLabel(
  n: Pick<AppNotification, "criteria_es" | "criteria_en">,
  locale: Locale,
): string | null {
  return locale === "es"
    ? (n.criteria_es ?? n.criteria_en)
    : (n.criteria_en ?? n.criteria_es);
}

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

    case "points_awarded": {
      const pts = n.points ?? 0;
      if (n.points_source === "content") {
        return { es: `Recibiste ${pts} puntos por tu contenido`, en: `You received ${pts} points for your content`, ko: `콘텐츠로 ${pts}포인트를 받았어요` }[locale];
      }
      if (n.points_source === "event") {
        return { es: `Recibiste ${pts} puntos por tu propuesta`, en: `You received ${pts} points for your proposal`, ko: `제안으로 ${pts}포인트를 받았어요` }[locale];
      }
      return { es: `Recibiste ${pts} puntos`, en: `You received ${pts} points`, ko: `${pts}포인트를 받았어요` }[locale];
    }
  }
}
