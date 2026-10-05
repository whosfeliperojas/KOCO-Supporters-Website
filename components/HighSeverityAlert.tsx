"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";
import Button from "@/components/ui/Button";

const T = {
  es: {
    title: "Cambios urgentes",
    one: "Una propuesta volvió marcada como urgente.",
    many: "{n} propuestas volvieron marcadas como urgentes.",
    open: "Ver propuesta",
    dismiss: "Entendido",
    by: "de",
  },
  en: {
    title: "Urgent changes",
    one: "A proposal came back marked urgent.",
    many: "{n} proposals came back marked urgent.",
    open: "Open proposal",
    dismiss: "Got it",
    by: "from",
  },
  ko: {
    title: "긴급 수정",
    one: "긴급으로 표시된 제안이 돌아왔어요.",
    many: "긴급으로 표시된 제안이 {n}건 있어요.",
    open: "제안 열기",
    dismiss: "확인",
    by: "·",
  },
} as const;

type Urgent = { id: string; entity_id: string; title: string | null; actor_name: string | null };

/**
 * Both ways a volunteer can raise the alarm: sending work for review marked
 * Urgente, and saving an urgent correction to a post they cannot send (a
 * collaborator's, or one already published). They are separate events, but
 * to an admin they are one question - "which posts need me now?" - so the
 * dialog lists each post once, newest first.
 */
const URGENT_KINDS = ["content_proposal_new", "content_urgent_edit"];

/**
 * The one notification allowed to interrupt an admin.
 *
 * Everything else in this app waits in the bell. A volunteer who marks a
 * resubmission "urgent" is saying the schedule is at risk, so that single
 * case gets a dialog on the dashboard instead — which only works as long as
 * it stays rare. Hence the narrow query: unread, kind=content_proposal_new,
 * severity=high. Nothing else can raise it, and the trigger only writes
 * `high` when a volunteer chose it (migrations 37 and 38).
 *
 * Dismissing marks the notifications read, so it clears the bell too and the
 * dialog does not reappear on the next load or on another device.
 */
export default function HighSeverityAlert() {
  const { locale } = useLocale();
  const L = T[locale];
  const [items, setItems] = useState<Urgent[] | null>(null);
  // Every matching row, including the duplicates collapsed out of the list.
  // Dismissing has to clear all of them or the hidden one re-raises the
  // dialog on the next load.
  const allIds = useRef<string[]>([]);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("notifications")
      .select("id, entity_id, title, actor_name")
      .in("kind", URGENT_KINDS)
      .eq("severity", "high")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        // Before migration 35 the `severity` column does not exist and this
        // query fails. That is expected and must stay silent: the dashboard
        // simply has no urgent items to show until the migration is applied.
        if (cancelled || error) return;
        // One row per post. A volunteer who saves an urgent correction and
        // then sends it for review produces two notifications about the same
        // post; the admin should see one line, not the same title twice.
        const rows = (data ?? []) as Urgent[];
        allIds.current = rows.map((i) => i.id);
        const seen = new Set<string>();
        setItems(rows.filter((i) => (seen.has(i.entity_id) ? false : (seen.add(i.entity_id), true))));
      });
    return () => { cancelled = true; };
  }, []);

  const open = !!items && items.length > 0;

  const close = useCallback(() => {
    setItems([]);
    restoreFocus.current?.focus();
  }, []);

  // Move focus into the dialog, and put it back where it was on close - a
  // dialog that appears without focus is one a keyboard user cannot reach.
  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus({ preventScroll: true });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function dismiss() {
    if (!items?.length) return;
    setBusy(true);
    const supabase = createClient();
    await Promise.all(allIds.current.map((id) => supabase.rpc("mark_notification_read", { p_id: id })));
    setBusy(false);
    close();
  }

  if (!open) return null;
  const n = items.length;

  return (
    <div
      className="fixed inset-0 z-[900] flex items-start justify-center p-4 pt-[12vh]"
      style={{ backgroundColor: "rgba(28,28,28,0.32)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="urgent-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl p-5 shadow-koco anim-pop outline-none"
        style={{ backgroundColor: "#FDFAF3", border: "1.5px solid #E2693E" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span aria-hidden style={{ color: "#8C3010" }}>⚠</span>
          <h2 id="urgent-title" className="text-base font-bold" style={{ color: "#8C3010" }}>
            {L.title}
          </h2>
        </div>
        <p className="text-sm measure" style={{ color: "#1C1C1C" }}>
          {n === 1 ? L.one : L.many.replace("{n}", String(n))}
        </p>

        <ul className="mt-3 space-y-2">
          {items.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
              style={{ backgroundColor: "rgba(226,105,62,0.10)" }}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium truncate" style={{ color: "#1C1C1C" }}>
                  {i.title ?? "—"}
                </span>
                {i.actor_name && (
                  <span className="block text-xs truncate" style={{ color: "#6B6258" }}>
                    {L.by} {i.actor_name}
                  </span>
                )}
              </span>
              <Link
                href={`/content/${i.entity_id}`}
                onClick={close}
                className="text-xs font-bold underline shrink-0"
                style={{ color: "#8C3010" }}
              >
                {L.open} →
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex justify-end mt-4">
          <Button variant="secondary" size="md" onClick={dismiss} loading={busy} loadingLabel={L.dismiss}>
            {L.dismiss}
          </Button>
        </div>
      </div>
    </div>
  );
}
