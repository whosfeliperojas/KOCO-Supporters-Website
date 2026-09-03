"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { companionReact } from "@/components/Companion";
import type { ContentPost, ContentStatus } from "@/lib/types";
import { CONTENT_STATUS_LABEL } from "@/lib/i18n";

const TRANSITIONS: Partial<Record<ContentStatus, ContentStatus[]>> = {
  // The workbook's two starting states feed into the same review flow.
  not_started: ["in_progress", "cancelled"],
  // "Request changes" sends a post here: it is the one not-approved state whose
  // author can still edit it, and "En progreso" is what the workbook calls it.
  in_progress: ["in_review", "approved", "rejected"],
  // A verdict does not require a stop at in_review first — that was an extra
  // click on every proposal. in_review stays for a post worth parking.
  submitted:  ["approved", "in_progress", "in_review", "rejected"],
  in_review:  ["approved", "in_progress", "rejected"],
  approved:   ["published", "rescheduled", "in_progress"],
  published:  ["rescheduled"],
  rescheduled:["published", "cancelled"],
  // A rejection used to be a dead end for everyone, so a misclick was
  // permanent. The author can still edit a rejected post, and an admin can
  // now put it back into the flow.
  rejected:   ["in_progress", "in_review", "approved"],
  draft:      ["in_progress", "cancelled"],
  cancelled:  ["in_progress"],
};



export default function AdminReviewPanel({ post, locale }: { post: ContentPost; locale: "es" | "en" | "ko" }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState(post.admin_notes ?? "");
  const [pubDate, setPubDate] = useState(post.publication_date ?? "");
  const [saving, setSaving] = useState(false);

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
      pubDate: "Fecha de publicación", moveTo: "Cambiar estado a:",
      save: "Enviar feedback", saving: "Guardando...",
      noLead: "Este contenido no tiene responsable asignado, así que nadie recibirá el feedback.",
    },
    en: {
      panel: "Review panel",
      feedback: "Feedback for the person who proposed it",
      feedbackHint: "They see this on their post, and it is flagged to them as new.",
      pubDate: "Publication date", moveTo: "Change status to:",
      save: "Send feedback", saving: "Saving...",
      noLead: "This post has nobody responsible, so no one will receive the feedback.",
    },
    ko: {
      panel: "검토 패널",
      feedback: "제안한 사람에게 전할 피드백",
      feedbackHint: "해당 콘텐츠에서 확인할 수 있고, 새 소식으로 표시돼요.",
      pubDate: "게시일", moveTo: "상태 변경:",
      save: "피드백 보내기", saving: "저장 중...",
      noLead: "담당자가 지정되지 않은 콘텐츠라 피드백을 받을 사람이 없어요.",
    },
  } as const;
  const L = T[locale];

  async function updateStatus(newStatus: ContentStatus) {
    setSaving(true);
    const supabase = createClient();
    const update: Partial<ContentPost> = {
      status: newStatus,
      admin_notes: feedback || null,
      publication_date: pubDate || null,
    };
    if (newStatus === "published") update.published_at = new Date().toISOString();
    if (newStatus === "in_review") update.reviewed_at = new Date().toISOString();
    await supabase.from("content_posts").update(update).eq("id", post.id);
    setSaving(false);
    if (newStatus === "approved" || newStatus === "published") companionReact("celebrate");
    router.refresh();
  }

  async function saveNotes() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("content_posts").update({ admin_notes: feedback, publication_date: pubDate || null }).eq("id", post.id);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl p-5 shadow-koco space-y-4" style={{ backgroundColor: "#FCD4C1" }}>
      <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "#ECA040" }}>{L.panel}</h2>

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
          style={{ backgroundColor: "#F8F0DE", border: "1.5px solid #DDD0C4", color: "#1C1C1C" }}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.pubDate}</label>
        <input
          type="date"
          value={pubDate}
          onChange={(e) => setPubDate(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg outline-none"
          style={{ backgroundColor: "#F8F0DE", border: "1.5px solid #DDD0C4", color: "#1C1C1C" }}
        />
      </div>

      <button
        onClick={saveNotes}
        disabled={saving}
        className="text-sm font-medium px-4 py-1.5 rounded-lg btn-hover"
        style={{ border: "1.5px solid #ECA040", color: "#ECA040" }}
      >
        {saving ? L.saving : L.save}
      </button>

      {available.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: "#1C1C1C" }}>{L.moveTo}</p>
          <div className="flex flex-wrap gap-2">
            {available.map((s) => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                disabled={saving}
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-white btn-hover"
                style={{
                  backgroundColor:
                    s === "approved" || s === "published" ? "#38B39E" :
                    s === "rejected" || s === "cancelled" ? "#E2693E" : "#ECA040",
                }}
              >
                → {statusLabel(s)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
