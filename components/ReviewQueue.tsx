"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";
import { companionReact } from "@/components/Companion";
import Button from "@/components/ui/Button";

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
    rejectSure: "¿Seguro?", rejectYes: "Sí, rechazar", rejectNo: "No",
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
    rejectSure: "Sure?", rejectYes: "Yes, reject", rejectNo: "No",
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
    rejectSure: "정말요?", rejectYes: "네, 반려할게요", rejectNo: "아니요",
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
  const [failed, setFailed] = useState<string | null>(null);
  // Reject is the one decision here that is not casually reversible and the
  // row disappears the moment it is pressed, so it asks once first.
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  /** Which decision is in flight, so only that button spins. */
  const [pendingKind, setPendingKind] = useState<"approved" | "in_progress" | "rejected" | null>(null);
  // Removed the instant a decision is made, before the network round-trip even
  // resolves. Without this, an admin's click sat there through a full
  // request + router.refresh() before the item finally vanished — correct,
  // but felt like the click hadn't registered. router.refresh() still runs
  // afterward, so the next real fetch is the source of truth; this is purely
  // about not making someone stare at a button waiting for it.
  const [decidedIds, setDecidedIds] = useState<Set<string>>(new Set());

  async function decide(post: PendingPost, next: "approved" | "in_progress" | "rejected") {
    setBusyId(post.id);
    setPendingKind(next);
    setFailed(null);
    setDecidedIds((prev) => new Set(prev).add(post.id));

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
    if (error) {
      setFailed(post.id);
      // The write failed — put it back rather than leaving it looking decided.
      setDecidedIds((prev) => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
      return;
    }
    if (next === "approved") companionReact("celebrate");
    router.refresh();
  }

  const visiblePosts = posts.filter((p) => !decidedIds.has(p.id));
  if (visiblePosts.length === 0) return null;

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
          {visiblePosts.length}
        </span>
      </div>

      {visiblePosts.map((p) => (
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
              style={{ color: "#1F7A6E" }}
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
              style={{ backgroundColor: "#FDFAF3", border: "1.5px solid #DDD0C4", color: "#1C1C1C" }}
            />
          </div>

          {/* Same decision as the review panel inside the post, so it uses the
              same buttons: one confirm, a quiet middle option, and the
              destructive path outlined and pushed to the far end. It used to
              be three tinted pills of equal weight with reject next to the
              thumb. */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="confirm"
              size="md"
              onClick={() => decide(p, "approved")}
              loading={busyId === p.id && pendingKind === "approved"}
              loadingLabel={L.working}
              disabled={busyId === p.id}
            >
              {L.approve}
            </Button>
            <Button
              variant="secondary"
              size="md"
              title={L.changesHint}
              onClick={() => decide(p, "in_progress")}
              loading={busyId === p.id && pendingKind === "in_progress"}
              loadingLabel={L.working}
              disabled={busyId === p.id}
            >
              {L.changes}
            </Button>

            <span className="ml-auto flex items-center gap-2">
              {confirmRejectId === p.id ? (
                <>
                  <span className="text-xs font-medium" style={{ color: "#8C3010" }}>{L.rejectSure}</span>
                  <Button
                    variant="destructive"
                    size="md"
                    onClick={() => { setConfirmRejectId(null); decide(p, "rejected"); }}
                    loading={busyId === p.id && pendingKind === "rejected"}
                    loadingLabel={L.working}
                    disabled={busyId === p.id}
                  >
                    {L.rejectYes}
                  </Button>
                  <Button variant="ghost" size="md" onClick={() => setConfirmRejectId(null)} disabled={busyId === p.id}>
                    {L.rejectNo}
                  </Button>
                </>
              ) : (
                <Button
                  variant="destructive"
                  size="md"
                  onClick={() => setConfirmRejectId(p.id)}
                  disabled={busyId === p.id}
                >
                  {L.reject}
                </Button>
              )}
            </span>
          </div>

          {/* Keyed to the post: one shared boolean at the bottom of the
              section could not say which of eight rows had failed. */}
          {failed === p.id && (
            <p role="alert" className="text-xs font-medium" style={{ color: "#8C3010" }}>{L.failed}</p>
          )}
        </div>
      ))}

    </section>
  );
}
