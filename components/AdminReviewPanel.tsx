"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { companionReact } from "@/components/Companion";
import type { ContentPost, ContentStatus } from "@/lib/types";
import { CONTENT_STATUS_LABEL, DATE_LOCALE } from "@/lib/i18n";
import GlassDatePicker from "@/components/glass/GlassDatePicker";
import Button, { type ButtonVariant } from "@/components/ui/Button";

/**
 * Where a post can go from where it is.
 *
 * `in_review` is deliberately absent as a destination. It differed from
 * `submitted` in nothing a human could observe: both sat in the review queue,
 * both meant "with an admin, nothing for you to do", both render the same
 * blush, and the review queue itself never offered it - only this panel did.
 * What it did do was notify the volunteer about a change that asked nothing of
 * them, and put a fourth button on `submitted`, the busiest decision there is.
 * Production bears that out: 5 uses in 32 recorded decisions, against 46 posts
 * that went through `submitted`.
 *
 * So `submitted` carries the "waiting on us" state on its own - it is the
 * hand-off the volunteer actually performs, and it stamps the timestamp the
 * queue is ordered by. The status itself is NOT deleted: one post still sits
 * in it and five notifications reference it, so it still renders, still shows
 * in the queue, and still has a row out of here.
 */
const TRANSITIONS: Partial<Record<ContentStatus, ContentStatus[]>> = {
  // The workbook's two starting states feed into the same review flow.
  not_started: ["in_progress", "cancelled"],
  // "Request changes" sends a post here: it is the one not-approved state whose
  // author can still edit it, and "En progreso" is what the workbook calls it.
  in_progress: ["approved", "rejected"],
  submitted:  ["approved", "in_progress", "rejected"],
  // Kept so the posts already in this state can still be moved out of it.
  in_review:  ["approved", "in_progress", "rejected"],
  approved:   ["published", "rescheduled", "in_progress"],
  published:  ["rescheduled"],
  rescheduled:["published", "cancelled"],
  // A rejection used to be a dead end for everyone, so a misclick was
  // permanent. The author can still edit a rejected post, and an admin can
  // now put it back into the flow.
  rejected:   ["in_progress", "approved"],
  draft:      ["in_progress", "cancelled"],
  cancelled:  ["in_progress"],
};


/**
 * What each transition DOES, and how loudly it should say so.
 *
 * The buttons used to be labelled with their destination ("→ Aprobado") and
 * filled with that destination's own colour. Two things went wrong. An admin
 * could only work out the post's current state by reading the destinations
 * backwards, and because every button was a saturated fill of equal weight,
 * rejecting shouted exactly as loud as approving - while "→ En revisión",
 * whose colour is the same blush as the panel itself, had no visible edge at
 * all and read as plain text.
 *
 * So: verbs, not destinations. One `confirm` per row is the expected move;
 * the reversible middle ground is quiet; and the two that take something away
 * are outlined and pushed to the end, away from the constructive cluster.
 */
const ACTION: Record<string, { variant: ButtonVariant; es: string; en: string; ko: string }> = {
  approved:    { variant: "confirm",     es: "Aprobar",            en: "Approve",         ko: "승인하기" },
  published:   { variant: "confirm",     es: "Publicar",           en: "Publish",         ko: "게시하기" },
  in_progress: { variant: "secondary",   es: "Pedir cambios",      en: "Request changes", ko: "수정 요청" },
  rescheduled: { variant: "secondary",   es: "Reagendar",          en: "Reschedule",      ko: "일정 변경" },
  rejected:    { variant: "destructive", es: "Rechazar",           en: "Reject",          ko: "반려하기" },
  cancelled:   { variant: "destructive", es: "Cancelar",           en: "Cancel",          ko: "취소하기" },
};

/** Plain language for where the post stands right now, from the admin's side. */
const MEANS: Record<string, { es: string; en: string; ko: string }> = {
  submitted:   { es: "Esperando tu decisión.",                      en: "Waiting on your decision.",           ko: "결정을 기다리고 있어요." },
  in_review:   { es: "Marcado para revisar con calma.",             en: "Parked for a closer look.",           ko: "자세히 검토하려고 표시해 두었어요." },
  in_progress: { es: "Con quien lo propuso, esperando cambios.",    en: "Back with its author for changes.",   ko: "수정 요청 후 작성자에게 있어요." },
  approved:    { es: "Aprobado. Falta publicarlo.",                 en: "Approved. Not published yet.",        ko: "승인됨. 아직 게시 전이에요." },
  published:   { es: "Publicado.",                                  en: "Published.",                          ko: "게시됐어요." },
  rejected:    { es: "Rechazado. Puede corregirlo y reenviarlo.",   en: "Rejected. They can fix it and resend.", ko: "반려됨. 수정 후 다시 보낼 수 있어요." },
  rescheduled: { es: "Reagendado.",                                 en: "Rescheduled.",                        ko: "일정이 변경됐어요." },
  cancelled:   { es: "Fuera del calendario.",                       en: "Off the calendar.",                   ko: "캘린더에서 빠졌어요." },
  draft:       { es: "Aún sin enviar.",                             en: "Not sent yet.",                       ko: "아직 제출 전이에요." },
  not_started: { es: "Aún sin empezar.",                            en: "Not started.",                        ko: "아직 시작 전이에요." },
};

export default function AdminReviewPanel({ post, locale }: { post: ContentPost; locale: "es" | "en" | "ko" }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState(post.admin_notes ?? "");
  const [pubDate, setPubDate] = useState(post.publication_date ?? "");
  const [saving, setSaving] = useState(false);
  // Which transition is in flight, so that button alone shows the spinner
  // rather than every button looking identical while one of them works.
  const [pending, setPending] = useState<ContentStatus | "notes" | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const available = TRANSITIONS[post.status as ContentStatus] ?? [];
  // Shared map is keyed status-first; keep the local shape status-agnostic.
  const statusLabel = (st: ContentStatus) => CONTENT_STATUS_LABEL[st][locale];

  const T = {
    es: {
      panel: "Panel de revisión",
      feedback: "Feedback para quien propuso el contenido",
      // Admins could not tell that this field is delivered, so it read like a
      // private note. It is what the volunteer sees under "Comentarios del
      // equipo", and saving it now marks their copy as having news.
      feedbackHint: "Lo verá en su contenido y le aparecerá como novedad.",
      pubDate: "Fecha de publicación", moveTo: "Decisión",
      save: "Guardar sin cambiar el estado", saving: "Guardando...",
      saveHint: "Cualquier decisión de abajo también envía el feedback.",
      noLead: "Este contenido no tiene responsable asignado, así que nadie recibirá el feedback.",
      current: "Estado actual", failed: "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.",
      sentOn: "Enviado el",
    },
    en: {
      panel: "Review panel",
      feedback: "Feedback for the person who proposed it",
      feedbackHint: "They see this on their post, and it is flagged to them as new.",
      pubDate: "Publication date", moveTo: "Decision",
      save: "Save without changing the status", saving: "Saving...",
      saveHint: "Any decision below sends the feedback too.",
      noLead: "This post has nobody responsible, so no one will receive the feedback.",
      current: "Current status", failed: "Couldn't save. Check your connection and try again.",
      sentOn: "Sent on",
    },
    ko: {
      panel: "검토 패널",
      feedback: "제안한 사람에게 전할 피드백",
      feedbackHint: "해당 콘텐츠에서 확인할 수 있고, 새 소식으로 표시돼요.",
      pubDate: "게시일", moveTo: "결정",
      save: "상태는 그대로 두고 저장", saving: "저장 중...",
      saveHint: "아래에서 결정을 내리면 피드백도 함께 전달돼요.",
      noLead: "담당자가 지정되지 않은 콘텐츠라 피드백을 받을 사람이 없어요.",
      current: "현재 상태", failed: "저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.",
      sentOn: "제출일",
    },
  } as const;
  const L = T[locale];

  async function updateStatus(newStatus: ContentStatus) {
    setSaving(true);
    setPending(newStatus);
    setFailed(null);
    const supabase = createClient();
    const update: Partial<ContentPost> = {
      status: newStatus,
      admin_notes: feedback || null,
      publication_date: pubDate || null,
    };
    if (newStatus === "published") update.published_at = new Date().toISOString();
    // reviewed_at used to be stamped only on the way into in_review, which is
    // no longer a destination - so it recorded nothing for the vast majority
    // of posts. A verdict IS the review, so stamp it there instead.
    if (["approved", "rejected", "published"].includes(newStatus)) {
      update.reviewed_at = new Date().toISOString();
    }
    // The result used to be thrown away, so a refused write looked exactly
    // like a successful one: same chip, same silence. An admin who thinks
    // they rejected a post and did not leaves a volunteer waiting forever.
    const { error } = await supabase.from("content_posts").update(update).eq("id", post.id);
    setSaving(false);
    setPending(null);
    if (error) {
      setFailed(L.failed);
      return;
    }
    if (newStatus === "approved" || newStatus === "published") companionReact("celebrate");
    router.refresh();
  }

  async function saveNotes() {
    setSaving(true);
    setPending("notes");
    setFailed(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("content_posts")
      .update({ admin_notes: feedback, publication_date: pubDate || null })
      .eq("id", post.id);
    setSaving(false);
    setPending(null);
    if (error) {
      setFailed(L.failed);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl p-5 shadow-koco space-y-4" style={{ backgroundColor: "#FCD4C1" }}>
      {/* What this post IS, before what it could become. The panel used to
          open straight into the destinations, so an admin had to read the
          button row backwards to work out the current state - and the heading
          that sat here was #ECA040 on this blush panel, a 1.6:1 contrast that
          made the panel's own title the least legible text on the page. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "#8C3010" }}>{L.panel}</h2>
        {post.submitted_at && (
          <p className="text-xs" style={{ color: "#8C6B55" }}>
            {L.sentOn} {new Date(post.submitted_at).toLocaleDateString(DATE_LOCALE[locale], { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
      </div>

      <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.6)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="label-style" style={{ color: "#6B6258" }}>{L.current}</span>
          <span className={`chip-${post.status} label-style px-3 py-0.5 rounded-full whitespace-nowrap`}>
            {statusLabel(post.status as ContentStatus)}
          </span>
        </div>
        {MEANS[post.status] && (
          <p className="text-sm mt-1.5" style={{ color: "#1C1C1C" }}>{MEANS[post.status][locale]}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.feedback}</label>
        <p className="text-xs" style={{ color: "#6B6258" }}>
          {post.responsible_id ? L.feedbackHint : L.noLead}
        </p>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-sm rounded-lg resize-none outline-none"
          style={{ backgroundColor: "#FDFAF3", border: "1.5px solid #DDD0C4", color: "#1C1C1C" }}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.pubDate}</label>
        <GlassDatePicker ariaLabel={L.pubDate} value={pubDate} onChange={setPubDate} />
      </div>

      <div className="space-y-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={saveNotes}
          loading={pending === "notes"}
          loadingLabel={L.saving}
          disabled={saving}
        >
          {L.save}
        </Button>
        <p className="text-xs" style={{ color: "#8C6B55" }}>{L.saveHint}</p>
      </div>

      {available.length > 0 && (
        <div>
          <p className="label-style mb-2" style={{ color: "#6B6258" }}>{L.moveTo}</p>
          {/* Constructive choices first, in reading order; anything that takes
              the post away is outlined and pushed to the far end, so the
              destructive click is never the one next to your thumb. */}
          <div className="flex flex-wrap items-center gap-2">
            {available
              .filter((s) => ACTION[s]?.variant !== "destructive")
              // The expected move leads, whatever order the TRANSITIONS map
              // happens to list it in - on a rejected post "Aprobar" was
              // coming out third, behind the two lesser options.
              .sort((a, b) => Number(ACTION[b]?.variant === "confirm") - Number(ACTION[a]?.variant === "confirm"))
              .map((s) => (
                <Button
                  key={s}
                  variant={ACTION[s]?.variant ?? "secondary"}
                  size="sm"
                  onClick={() => updateStatus(s)}
                  loading={pending === s}
                  loadingLabel={L.saving}
                  disabled={saving}
                >
                  {ACTION[s]?.[locale] ?? statusLabel(s)}
                </Button>
              ))}

            {available.some((s) => ACTION[s]?.variant === "destructive") && (
              <span className="ml-auto flex flex-wrap gap-2">
                {available
                  .filter((s) => ACTION[s]?.variant === "destructive")
                  .map((s) => (
                    <Button
                      key={s}
                      variant="destructive"
                      size="sm"
                      onClick={() => updateStatus(s)}
                      loading={pending === s}
                      loadingLabel={L.saving}
                      disabled={saving}
                    >
                      {ACTION[s]?.[locale] ?? statusLabel(s)}
                    </Button>
                  ))}
              </span>
            )}
          </div>
        </div>
      )}

      {/* A write that failed used to look exactly like one that worked. */}
      {failed && (
        <p role="alert" className="text-xs font-medium" style={{ color: "#8C3010" }}>{failed}</p>
      )}
    </div>
  );
}
