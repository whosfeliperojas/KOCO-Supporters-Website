"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";
import type { AppNotification } from "@/lib/notifications";
import { describeNotification, notificationHref, pointsCriteriaLabel } from "@/lib/notifications";

const T = {
  es: {
    label: "Notificaciones",
    empty: "No tienes notificaciones.",
    markAll: "Marcar todas como leídas",
    loading: "Cargando...",
    failed: "No se pudieron cargar las notificaciones.",
  },
  en: {
    label: "Notifications",
    empty: "You have no notifications.",
    markAll: "Mark all as read",
    loading: "Loading...",
    failed: "Couldn't load notifications.",
  },
  ko: {
    label: "알림",
    empty: "알림이 없어요.",
    markAll: "모두 읽음으로 표시",
    loading: "불러오는 중...",
    failed: "알림을 불러오지 못했어요.",
  },
} as const;

/** "just now" / "5m" / "3h" / "2d" - short, no library, three languages. */
function relativeTime(iso: string, locale: "es" | "en" | "ko"): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  const now = { es: "ahora", en: "now", ko: "방금" }[locale];
  if (mins < 1) return now;
  if (mins < 60) return `${mins}m`;
  if (hrs < 24) return `${hrs}h`;
  return `${days}d`;
}

const SELECT_COLUMNS =
  "id, kind, entity_type, entity_id, actor_id, actor_name, title, body, from_status, to_status, " +
  "is_resubmission, points, criteria_es, criteria_en, points_source, read_at, created_at";

/**
 * The bell, top-right in the app shell.
 *
 * Server-rendered pages already compute the unread count once per navigation
 * (see app/(app)/layout.tsx); this component starts from that number so the
 * badge never flashes 0 on first paint.
 *
 * It used to STAY on that server-passed number until the layout happened to
 * re-render with a fresh one, which relies on Next's client router cache
 * invalidating on cue - it often didn't. A volunteer could mark a proposal's
 * notification read by opening it (the page does that server-side on load),
 * resubmit, navigate back, and the badge would still show the old count until
 * a hard reload. Every content/event page that marks something read already
 * changes the URL to get there, so the badge now re-fetches the real count
 * directly on every route change, via usePathname() - a live query, not a
 * value trusted to have propagated through the render tree correctly. Same
 * fix covers admins: nothing about the old bug was volunteer-specific.
 */
export default function NotificationBell({
  isAdmin,
  initialUnread,
}: {
  isAdmin: boolean;
  initialUnread: number;
}) {
  const { locale } = useLocale();
  const L = T[locale];
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const rootRef = useRef<HTMLDivElement>(null);

  // The one authoritative refresh: re-count directly from the database
  // whenever the route changes, including on mount. Cheap (one indexed
  // count-only query) and immune to whatever the router cache is doing.
  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .then(({ count }) => {
        if (!cancelled) setUnread(count ?? initialUnread);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch on navigation only, not on every initialUnread prop tick
  }, [pathname]);

  // Close on an outside click or Escape - standard dropdown behavior, and the
  // panel overlays page content so it must not trap the viewer.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function load() {
    setStatus("loading");
    const { data, error } = await createClient()
      .from("notifications")
      .select(SELECT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) { setStatus("error"); return; }
    setItems((data ?? []) as unknown as AppNotification[]);
    setStatus("ready");
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    // Always refetch on open, not just the first time - otherwise reopening
    // the panel later in the session could show items as unread that were
    // already cleared by visiting whatever they pointed to.
    if (next) load();
  }

  async function openItem(n: AppNotification) {
    setOpen(false);
    if (!n.read_at) {
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) ?? prev);
      await createClient().rpc("mark_notification_read", { p_id: n.id });
    }
    router.push(notificationHref(n, isAdmin));
    router.refresh();
  }

  async function markAll() {
    setUnread(0);
    setItems((prev) => prev?.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) ?? prev);
    await createClient().rpc("mark_all_notifications_read");
    router.refresh();
  }

  /** points_awarded shows the criteria; every other kind shows the linked title. */
  function secondaryLine(n: AppNotification): string | null {
    return n.kind === "points_awarded" ? pointsCriteriaLabel(n, locale) : n.title;
  }

  /** points_awarded's third line is the linked post/event name, if there is one. */
  function tertiaryLine(n: AppNotification): string | null {
    return n.kind === "points_awarded" ? n.title : n.body;
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={toggle}
        aria-label={L.label}
        aria-expanded={open}
        className="relative w-9 h-9 flex items-center justify-center rounded-full btn-hover"
        style={{ color: "#1C1C1C" }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: "#E2693E" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl shadow-koco overflow-hidden anim-pop z-50"
          style={{ backgroundColor: "#F8F0DE", border: "1px solid #E8DCCF" }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #E8DCCF" }}>
            <h3 className="text-sm font-bold" style={{ color: "#1C1C1C" }}>{L.label}</h3>
            {!!items?.some((n) => !n.read_at) && (
              <button
                onClick={markAll}
                className="text-xs font-bold btn-hover"
                style={{ color: "#38B39E" }}
              >
                {L.markAll}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {status === "loading" || status === "idle" ? (
              <p className="text-sm text-center py-8" style={{ color: "#888" }}>{L.loading}</p>
            ) : status === "error" ? (
              <p className="text-sm text-center py-8" style={{ color: "#888" }}>{L.failed}</p>
            ) : (items ?? []).length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "#888" }}>{L.empty}</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "#E8DCCF" }}>
                {(items ?? []).map((n) => {
                  const secondary = secondaryLine(n);
                  const tertiary = tertiaryLine(n);
                  return (
                    <button
                      key={n.id}
                      onClick={() => openItem(n)}
                      className="w-full text-left px-4 py-3 flex gap-2.5 transition-colors btn-hover"
                      style={{ backgroundColor: n.read_at ? "transparent" : "rgba(56,179,158,0.07)" }}
                    >
                      <span
                        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: n.read_at ? "transparent" : "#38B39E" }}
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-bold" style={{ color: "#1F7A6E" }}>
                          {describeNotification(n, locale)}
                        </span>
                        {secondary && (
                          <span className="block text-sm font-medium truncate" style={{ color: "#1C1C1C" }}>
                            {secondary}
                          </span>
                        )}
                        {tertiary && (
                          <span className="block text-xs truncate" style={{ color: "#6B6258" }}>
                            {tertiary}
                          </span>
                        )}
                        <span className="block text-xs mt-0.5" style={{ color: "#9A8F84" }}>
                          {relativeTime(n.created_at, locale)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
