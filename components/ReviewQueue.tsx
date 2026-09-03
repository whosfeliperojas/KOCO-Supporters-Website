"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";
import { companionReact } from "@/components/Companion";

export type PendingPost = {
  id: string;
  title: string;
  status: string;
  format: string | null;
  channel: string | null;
  publication_date: string | null;
  responsible_name: string | null;
  submitted_at: string | null;
  /**
   * Another post already carries this exact title. Set when the queue should
   * warn before a decision: a duplicate of an already-published post sat at the
   * top of this list looking like new work.
   */
  duplicateOf?: { status: string; date: string | null } | null;
};

const T = {
  es: {
    heading: "Por revisar",
    empty: "Nada pendiente de revisión.",
    by: "por",
    noDate: "Sin fecha",
    approve: "Aprobar",
    changes: "Pedir cambios",
    reject: "Rechazar",
    open: "Ver propuesta",
    note: "Nota para quien la propuso (opcional)",
    notePlaceholder: "Qué cambiarías, o por qué no sigue adelante...",
    changesHint: "Vuelve a “En progreso” para que pueda editarla y enviarla de nuevo.",
    dupWarn: "Ya existe otro contenido con este mismo título",
    dupCheck: "Revísalo antes de decidir: puede ser el mismo contenido cargado dos veces.",
    working: "Guardando...",
    failed: "No se pudo guardar. Intenta de nuevo.",
  },
  en: {
    heading: "To review",
    empty: "Nothing waiting for review.",
    by: "by",
    noDate: "No date",
    approve: "Approve",
    changes: "Request changes",
    reject: "Reject",
    open: "Open proposal",
    note: "Note for the person who proposed it (optional)",
    notePlaceholder: "What you'd change, or why it isn't going ahead...",
    changesHint: "Goes back to “In progress” so they can edit and resubmit.",
    dupWarn: "Another post already has this exact title",
    dupCheck: "Check before deciding — it may be the same content entered twice.",
    working: "Saving...",
    failed: "Couldn't save. Try again.",
  },
  ko: {
    heading: "검토 대기",
    empty: "검토할 항목이 없어요.",
    by: "담당:",
    noDate: "날짜 미정",
    approve: "승인",
    changes: "수정 요청",
    reject: "반려",
    open: "제안 보기",
    note: "제안한 사람에게 남길 메모 (선택)",
    notePlaceholder: "고쳤으면 하는 점, 또는 진행하지 않는 이유...",
    changesHint: "“진행 중”으로 돌아가서 수정 후 다시 제출할 수 있어요.",
    dupWarn: "같은 제목의 콘텐츠가 이미 있어요",
    dupCheck: "결정하기 전에 확인해 주세요. 같은 콘텐츠가 두 번 등록됐을 수 있어요.",
    working: "저장 중...",
    failed: "저장하지 못했어요. 다시 시도해 주세요.",
  },
} as const;

/**
 * The proposals waiting on an admin, at the top of the review tab.
 *
 * Without this the tab sorted every post by publication date, so a freshly
 * submitted proposal landed somewhere in the middle of ~90 rows with nothing
 * marking it as needing attention. The events tab already surfaces volunteer
 * proposals this way; content now matches.
 *
 * A decision is one click. "En revisión" still exists for a post an admin wants
 * to park, but it is no longer a compulsory stop on the way to a verdict.
 */
export default function ReviewQueue({ posts }: { posts: PendingPost[] }) {
  const { locale } = useLocale();
  const L = T[locale];
  const router = useRouter();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  async function decide(post: PendingPost, next: "approved" | "in_progress" | "rejected") {
    setBusyId(post.id);
    setFailed(false);

    const note = (notes[post.id] ?? "").trim();
    const patch: Record<string, unknown> = {
      status: next,
      reviewed_at: new Date().toISOString(),
    };
    // Only overwrite the feedback when something was actually typed, so
    // approving without a note does not wipe an earlier round of comments.
    if (note) patch.admin_notes = note;

    const { error } = await createClient()
      .from("content_posts")
      .update(patch)
      .eq("id", post.id);

    setBusyId(null);
    if (error) { setFailed(true); return; }
    if (next === "approved") companionReact("celebrate");
    router.refresh();
  }

  if (posts.length === 0) return null;

  return (
    <section
      className="rounded-2xl p-5 shadow-koco space-y-3 anim-in"
      style={{ backgroundColor: "#FCD4C1", "--i": 1 } as React.CSSProperties}
    >
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold" style={{ color: "#1C1C1C" }}>{L.heading}</h2>
        <span
          className="label-style text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: "#E2693E", color: "#FFFFFF" }}
        >
          {posts.length}
        </span>
      </div>

      {posts.map((p) => (
        <div key={p.id} className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "#FFFFFF" }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: "#1C1C1C" }}>{p.title}</p>
              <p className="text-xs mt-0.5" style={{ color: "#8C6B55" }}>
                {[
                  p.responsible_name ? `${L.by} ${p.responsible_name}` : null,
                  p.publication_date ?? L.noDate,
                  p.channel,
                  p.format,
                ].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Link
              href={`/content/${p.id}`}
              className="text-xs font-bold underline shrink-0"
              style={{ color: "#38B39E" }}
            >
              {L.open} →
            </Link>
          </div>

          {p.duplicateOf && (
            <div
              className="rounded-lg px-3 py-2 text-xs"
              style={{ backgroundColor: "rgba(226,105,62,0.12)", color: "#8C3010" }}
            >
              <span className="font-bold">⚠ {L.dupWarn}</span>
              {" — "}
              {p.duplicateOf.status}
              {p.duplicateOf.date ? `, ${p.duplicateOf.date}` : ""}.
              {" "}
              {L.dupCheck}
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-medium" style={{ color: "#6B6258" }}>{L.note}</label>
            <textarea
              rows={2}
              value={notes[p.id] ?? ""}
              onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })}
              placeholder={L.notePlaceholder}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
              style={{ backgroundColor: "#F8F0DE", border: "1.5px solid #DDD0C4", color: "#1C1C1C" }}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => decide(p, "approved")}
              disabled={busyId === p.id}
              className="text-xs font-bold px-3 py-2 rounded-lg text-white btn-hover"
              style={{ backgroundColor: "#38B39E", opacity: busyId === p.id ? 0.6 : 1 }}
            >
              {busyId === p.id ? L.working : L.approve}
            </button>
            <button
              onClick={() => decide(p, "in_progress")}
              disabled={busyId === p.id}
              title={L.changesHint}
              className="text-xs font-bold px-3 py-2 rounded-lg btn-hover"
              style={{
                backgroundColor: "rgba(236,160,64,0.15)",
                color: "#B07A1A",
                opacity: busyId === p.id ? 0.6 : 1,
              }}
            >
              {L.changes}
            </button>
            <button
              onClick={() => decide(p, "rejected")}
              disabled={busyId === p.id}
              className="text-xs font-bold px-3 py-2 rounded-lg btn-hover"
              style={{
                backgroundColor: "rgba(226,105,62,0.12)",
                color: "#E2693E",
                opacity: busyId === p.id ? 0.6 : 1,
              }}
            >
              {L.reject}
            </button>
          </div>
        </div>
      ))}

      {failed && <p className="text-xs" style={{ color: "#8C3010" }}>{L.failed}</p>}
    </section>
  );
}
