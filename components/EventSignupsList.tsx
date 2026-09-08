"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";

type Signup = { profile_id: string; name: string; role: "attendee" | "support"; rsvp: string };

const T = {
  es: {
    show: "Ver quién se inscribió",
    hide: "Ocultar",
    none: "Nadie se ha inscrito todavía.",
    support: "Apoyo",
    failed: "No se pudo cargar la lista.",
  },
  en: {
    show: "See who signed up",
    hide: "Hide",
    none: "Nobody has signed up yet.",
    support: "Support",
    failed: "Couldn't load the list.",
  },
  ko: {
    show: "신청자 보기",
    hide: "접기",
    none: "아직 신청자가 없어요.",
    support: "지원",
    failed: "목록을 불러오지 못했어요.",
  },
} as const;

/**
 * Read-only "who's coming" for a volunteer, so they know who else will be
 * there before deciding to sign up themselves. event_attendees is already
 * readable by any signed-in user for a confirmed event; only the NAMES were
 * unreachable (profiles_select restricts a volunteer to their own row), so
 * this goes through list_event_signups() the same way the content side goes
 * through list_post_contributors(). No attendance marking or removal here —
 * those stay admin-only, in EventAttendeesPanel.
 */
export default function EventSignupsList({ eventId, count }: { eventId: string; count: number }) {
  const { locale } = useLocale();
  const L = T[locale];

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Signup[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && status === "idle") {
      setStatus("loading");
      const { data, error } = await createClient().rpc("list_event_signups", { p_event_ids: [eventId] });
      if (error) { setStatus("error"); return; }
      setItems((data ?? []) as Signup[]);
      setStatus("ready");
    }
  }

  return (
    <div className="mt-2 pt-2" style={{ borderTop: "1px solid #E8DCCF" }}>
      <button
        onClick={toggle}
        aria-expanded={open}
        className="text-xs font-bold btn-hover px-1 py-0.5 -ml-1 rounded"
        style={{ color: "#1F7A6E" }}
      >
        {open ? `▾ ${L.hide}` : `▸ ${L.show}${count > 0 ? ` (${count})` : ""}`}
      </button>

      {open && (
        <div className="mt-1.5 flex flex-wrap gap-1.5 anim-in">
          {status === "loading" ? null : status === "error" ? (
            <p className="text-xs" style={{ color: "#888" }}>{L.failed}</p>
          ) : (items ?? []).length === 0 ? (
            <p className="text-xs" style={{ color: "#888" }}>{L.none}</p>
          ) : (
            (items ?? []).map((s) => (
              <span
                key={s.profile_id}
                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ backgroundColor: "#F8F0DE", color: "#1C1C1C" }}
              >
                {s.name}
                {s.role === "support" && (
                  <span style={{ color: "#9A8F84", fontWeight: 400 }}>· {L.support}</span>
                )}
              </span>
            ))
          )}
        </div>
      )}
    </div>
  );
}
