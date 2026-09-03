"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";
import { companionReact } from "@/components/Companion";
import { DATE_LOCALE } from "@/lib/i18n";
import EventAttendeesPanel, { type EventSignup } from "@/components/EventAttendeesPanel";

type Event = {
  id: string;
  name: string;
  host: string | null;
  /** NULL when the event is planned but not yet scheduled - see date_note. */
  event_date_start: string | null;
  event_date_end: string | null;
  date_note: string | null;
  start_time: string | null;
  end_time: string | null;
  place: string | null;
  description: string | null;
  max_invited_koco: number | null;
  approval_status: string;
  registration_status: string;
  proposer: { display_name: string | null; full_name: string } | null;
};

export default function AdminEventsClient({
  events,
  acceptedCounts,
  signupsByEvent,
  roster,
  adminId,
  locale: initialLocale,
}: {
  events: Event[];
  acceptedCounts: Record<string, number>;
  /** event id -> everyone signed up, oldest signup first. */
  signupsByEvent: Record<string, EventSignup[]>;
  /** Active volunteers, for adding someone to an event by hand. */
  roster: { id: string; full_name: string }[];
  adminId: string;
  locale: "es" | "en" | "ko";
}) {
  const { locale } = useLocale();
  const router = useRouter();

  const T = {
    es: {
      title: "Eventos (admin)", createTitle: "Crear evento",
      name: "Nombre del evento", host: "Organizador", place: "Lugar",
      dateStart: "Fecha inicio", dateEnd: "Fecha fin (opcional)",
      timeStart: "Hora inicio", timeEnd: "Hora fin",
      description: "Descripción", maxAttendees: "Cupos (máx. asistentes)",
      noLimit: "Sin límite si queda vacío",
      regOpen: "Inscripciones abiertas",
      createBtn: "Crear evento", creating: "Creando...", created: "¡Evento creado!",
      required: "Nombre y fecha de inicio son obligatorios.",
      existing: "Eventos existentes", spots: "cupos", noEvents: "Sin eventos aún", cancelledState: "Cancelado", rejectedState: "Rechazado", cancelBtn: "Cancelar evento", cancelConfirm: "Sí, cancelar", cancelAbort: "No", restoreBtn: "Reactivar evento",
      open: "Abierto", closed: "Cerrado", full: "Lleno",
      toggleClose: "Cerrar inscripciones", toggleOpen: "Abrir inscripciones",
      proposalsTitle: "Propuestas de voluntarios/as", proposedBy: "Propuesto por",
      approve: "Aprobar", rejectBtn: "Rechazar",
    },
    en: {
      title: "Events (admin)", createTitle: "Create event",
      name: "Event name", host: "Host", place: "Place",
      dateStart: "Start date", dateEnd: "End date (optional)",
      timeStart: "Start time", timeEnd: "End time",
      description: "Description", maxAttendees: "Spots (max attendees)",
      noLimit: "No limit if left empty",
      regOpen: "Registration open",
      createBtn: "Create event", creating: "Creating...", created: "Event created!",
      required: "Name and start date are required.",
      existing: "Existing events", spots: "spots", noEvents: "No events yet", cancelledState: "Cancelled", rejectedState: "Rejected", cancelBtn: "Cancel event", cancelConfirm: "Yes, cancel", cancelAbort: "No", restoreBtn: "Restore event",
      open: "Open", closed: "Closed", full: "Full",
      toggleClose: "Close registration", toggleOpen: "Open registration",
      proposalsTitle: "Volunteer proposals", proposedBy: "Proposed by",
      approve: "Approve", rejectBtn: "Reject",
    },
    ko: {
      title: "행사 관리", createTitle: "행사 만들기",
      name: "행사 이름", host: "주최", place: "장소",
      dateStart: "시작일", dateEnd: "종료일 (선택)",
      timeStart: "시작 시간", timeEnd: "종료 시간",
      description: "설명", maxAttendees: "정원 (최대 인원)",
      noLimit: "비워 두면 제한 없음",
      regOpen: "신청 받기",
      createBtn: "행사 만들기", creating: "만드는 중...", created: "행사를 만들었어요!",
      required: "이름과 시작일은 필수예요.",
      existing: "등록된 행사", spots: "정원", noEvents: "아직 행사가 없어요", cancelledState: "취소됨", rejectedState: "반려됨", cancelBtn: "행사 취소", cancelConfirm: "네, 취소할게요", cancelAbort: "아니요", restoreBtn: "행사 복구",
      open: "모집 중", closed: "마감", full: "정원 마감",
      toggleClose: "신청 마감하기", toggleOpen: "신청 열기",
      proposalsTitle: "서포터즈 제안", proposedBy: "제안:",
      approve: "승인", rejectBtn: "반려",
    },
  } as const;
  const L = T[locale];

  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [place, setPlace] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [description, setDescription] = useState("");
  const [maxAttendees, setMaxAttendees] = useState<number | "">("");
  const [regOpen, setRegOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const inputStyle = { backgroundColor: "#F8F0DE", border: "1.5px solid #DDD0C4", color: "#1C1C1C" };

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !dateStart) { setError(L.required); return; }

    setSaving(true);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("events").insert({
      name: name.trim(),
      host: host.trim() || null,
      place: place.trim() || null,
      event_date_start: dateStart,
      event_date_end: dateEnd || null,
      start_time: timeStart || null,
      end_time: timeEnd || null,
      description: description.trim() || null,
      max_invited_koco: maxAttendees === "" ? null : Number(maxAttendees),
      approval_status: "confirmed",
      registration_status: regOpen ? "open" : "closed",
      created_by: adminId,
    });
    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSuccess(true);
    setName(""); setHost(""); setPlace(""); setDateStart(""); setDateEnd("");
    setTimeStart(""); setTimeEnd(""); setDescription(""); setMaxAttendees(""); setRegOpen(true);
    setTimeout(() => setSuccess(false), 3000);
    router.refresh();
  }

  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  async function decideProposal(event: Event, decision: "confirmed" | "rejected") {
    setTogglingId(event.id);
    const supabase = createClient();
    await supabase.from("events").update({ approval_status: decision }).eq("id", event.id);
    setTogglingId(null);
    if (decision === "confirmed") companionReact("celebrate");
    router.refresh();
  }

  // Cancelling is reversible: an event goes back to confirmed if it was called
  // off by mistake. Registration is forced closed on the way out so nobody can
  // still sign up for something that is not happening.
  async function setCancelled(event: Event, cancelled: boolean) {
    setTogglingId(event.id);
    const supabase = createClient();
    await supabase
      .from("events")
      .update(
        cancelled
          ? { approval_status: "cancelled", registration_status: "closed" }
          : { approval_status: "confirmed" }
      )
      .eq("id", event.id);
    setTogglingId(null);
    setConfirmCancelId(null);
    router.refresh();
  }

  async function toggleRegistration(event: Event) {
    setTogglingId(event.id);
    const supabase = createClient();
    await supabase
      .from("events")
      .update({ registration_status: event.registration_status === "open" ? "closed" : "open" })
      .eq("id", event.id);
    setTogglingId(null);
    router.refresh();
  }

  // Unscheduled events show the sheet's own wording ("Early November") where
  // the date would go, never a fabricated or invalid date.
  function fmtDate(d: string | null, dateNote?: string | null) {
    if (!d) return dateNote ?? "—";
    return new Date(d + "T12:00:00").toLocaleDateString(DATE_LOCALE[locale], { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold anim-in" style={{ color: "#1C1C1C" }}>{L.title}</h1>

      {/* Create form */}
      <section className="rounded-2xl p-5 shadow-koco space-y-4 anim-in" style={{ backgroundColor: "#F8F0DE", "--i": 1 } as React.CSSProperties}>
        <h2 className="text-base font-bold" style={{ color: "#1C1C1C" }}>{L.createTitle}</h2>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{L.name} *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg outline-none" style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{L.host}</label>
              <input value={host} onChange={(e) => setHost(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg outline-none" style={inputStyle} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{L.place}</label>
              <input value={place} onChange={(e) => setPlace(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg outline-none" style={inputStyle} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{L.dateStart} *</label>
              <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg outline-none" style={inputStyle} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{L.dateEnd}</label>
              <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg outline-none" style={inputStyle} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{L.timeStart}</label>
              <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg outline-none" style={inputStyle} />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{L.timeEnd}</label>
              <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg outline-none" style={inputStyle} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{L.description}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2.5 text-sm rounded-lg outline-none resize-none" style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{L.maxAttendees}</label>
              <input
                type="number" min={1}
                value={maxAttendees}
                onChange={(e) => setMaxAttendees(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm rounded-lg outline-none" style={inputStyle}
              />
              <p className="text-xs" style={{ color: "#888" }}>{L.noLimit}</p>
            </div>
            <label className="flex items-center gap-2 pb-6 cursor-pointer">
              <input type="checkbox" checked={regOpen} onChange={(e) => setRegOpen(e.target.checked)} className="w-4 h-4" style={{ accentColor: "#38B39E" }} />
              <span className="text-sm" style={{ color: "#1C1C1C" }}>{L.regOpen}</span>
            </label>
          </div>

          {error && <p className="text-xs anim-pop" style={{ color: "#E2693E" }}>{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="text-sm font-bold px-5 py-2.5 rounded-lg text-white btn-hover"
            style={{ backgroundColor: success ? "#38B39E" : "#ECA040", opacity: saving ? 0.6 : 1, transition: "background-color 0.2s var(--ease-out-quart)" }}
          >
            <span key={success ? "ok" : "idle"} className={success ? "anim-pop inline-block" : undefined}>
              {success ? L.created : saving ? L.creating : L.createBtn}
            </span>
          </button>
        </form>
      </section>

      {/* Volunteer proposals awaiting a decision */}
      {events.some((ev) => ev.approval_status === "pending") && (
        <section className="space-y-3 anim-in" style={{ "--i": 2 } as React.CSSProperties}>
          <h2 className="text-base font-bold" style={{ color: "#1C1C1C" }}>{L.proposalsTitle}</h2>
          {events.filter((ev) => ev.approval_status === "pending").map((ev) => (
            <div key={ev.id} className="rounded-2xl p-5 shadow-koco" style={{ backgroundColor: "#FCD4C1" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold" style={{ color: "#1C1C1C" }}>{ev.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#8C6B55" }}>
                    {fmtDate(ev.event_date_start, ev.date_note)}
                    {ev.place ? ` · ${ev.place}` : ""}
                    {ev.proposer ? ` · ${L.proposedBy} ${ev.proposer.display_name ?? ev.proposer.full_name.split(" ")[0]}` : ""}
                  </p>
                  {ev.description && (
                    <p className="text-xs mt-1.5" style={{ color: "#6B6258" }}>{ev.description}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => decideProposal(ev, "confirmed")}
                    disabled={togglingId === ev.id}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg text-white btn-hover"
                    style={{ backgroundColor: "#38B39E", opacity: togglingId === ev.id ? 0.6 : 1 }}
                  >
                    {L.approve}
                  </button>
                  <button
                    onClick={() => decideProposal(ev, "rejected")}
                    disabled={togglingId === ev.id}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg text-white btn-hover"
                    style={{ backgroundColor: "#E2693E", opacity: togglingId === ev.id ? 0.6 : 1 }}
                  >
                    {L.rejectBtn}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Existing events */}
      <section className="space-y-3 anim-in" style={{ "--i": 2 } as React.CSSProperties}>
        <h2 className="text-base font-bold" style={{ color: "#1C1C1C" }}>{L.existing}</h2>
        {events.filter((ev) => ev.approval_status !== "pending").length === 0 ? (
          <div className="rounded-2xl text-center py-10 shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
            <p className="text-sm" style={{ color: "#888" }}>{L.noEvents}</p>
          </div>
        ) : (
          events.filter((ev) => ev.approval_status !== "pending").map((ev) => {
            const count = acceptedCounts[ev.id] ?? 0;
            const isFull = ev.max_invited_koco != null && count >= ev.max_invited_koco;
            const isOpen = ev.registration_status === "open";
            const isDead = ev.approval_status === "cancelled" || ev.approval_status === "rejected";
            return (
              <div key={ev.id} className="rounded-2xl p-4 shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
                <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className="text-sm font-bold"
                      style={{ color: "#1C1C1C", textDecoration: isDead ? "line-through" : undefined }}
                    >
                      {ev.name}
                    </p>
                    {isDead && (
                      <span
                        className="label-style px-2 py-0.5 rounded-full text-xs"
                        style={{ backgroundColor: "rgba(226,105,62,0.15)", color: "#8C3010" }}
                      >
                        {ev.approval_status === "cancelled" ? L.cancelledState : L.rejectedState}
                      </span>
                    )}
                    <span
                      className="label-style px-2 py-0.5 rounded-full text-xs"
                      style={{
                        backgroundColor: isFull ? "rgba(226,105,62,0.15)" : isOpen ? "rgba(56,179,158,0.12)" : "rgba(0,0,0,0.06)",
                        color: isFull ? "#8C3010" : isOpen ? "#1F7A6E" : "#888",
                      }}
                    >
                      {isFull ? L.full : isOpen ? L.open : L.closed}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#ECA040", fontWeight: 500 }}>
                    {fmtDate(ev.event_date_start, ev.date_note)}{ev.event_date_end ? ` – ${fmtDate(ev.event_date_end)}` : ""}
                    {ev.start_time ? ` · ${ev.start_time.slice(0, 5)}` : ""}
                    {ev.place ? ` · ${ev.place}` : ""}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                    {count}{ev.max_invited_koco != null ? ` / ${ev.max_invited_koco}` : ""} {L.spots}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  {!isDead && (
                    <button
                      onClick={() => toggleRegistration(ev)}
                      disabled={togglingId === ev.id}
                      className="text-xs font-bold px-3 py-2 rounded-xl btn-hover whitespace-nowrap"
                      style={{
                        backgroundColor: isOpen ? "rgba(226,105,62,0.12)" : "rgba(56,179,158,0.12)",
                        color: isOpen ? "#E2693E" : "#38B39E",
                        opacity: togglingId === ev.id ? 0.6 : 1,
                      }}
                    >
                      {isOpen ? L.toggleClose : L.toggleOpen}
                    </button>
                  )}

                  {isDead ? (
                    <button
                      onClick={() => setCancelled(ev, false)}
                      disabled={togglingId === ev.id}
                      className="text-xs font-bold px-3 py-2 rounded-xl btn-hover whitespace-nowrap"
                      style={{
                        backgroundColor: "rgba(56,179,158,0.12)",
                        color: "#38B39E",
                        opacity: togglingId === ev.id ? 0.6 : 1,
                      }}
                    >
                      {L.restoreBtn}
                    </button>
                  ) : confirmCancelId === ev.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCancelled(ev, true)}
                        disabled={togglingId === ev.id}
                        className="text-xs font-bold px-3 py-2 rounded-xl text-white btn-hover whitespace-nowrap"
                        style={{ backgroundColor: "#E2693E", opacity: togglingId === ev.id ? 0.6 : 1 }}
                      >
                        {L.cancelConfirm}
                      </button>
                      <button
                        onClick={() => setConfirmCancelId(null)}
                        className="text-xs font-bold px-3 py-2 rounded-xl btn-hover whitespace-nowrap"
                        style={{ backgroundColor: "rgba(0,0,0,0.06)", color: "#1C1C1C" }}
                      >
                        {L.cancelAbort}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmCancelId(ev.id)}
                      className="text-xs font-bold px-3 py-2 rounded-xl btn-hover whitespace-nowrap"
                      style={{ backgroundColor: "rgba(226,105,62,0.12)", color: "#E2693E" }}
                    >
                      {L.cancelBtn}
                    </button>
                  )}
                </div>
                </div>

                {/* Who signed up, and attendance. Full width under the card so
                    the list is not squeezed next to the action buttons. */}
                <EventAttendeesPanel
                  eventId={ev.id}
                  signups={signupsByEvent[ev.id] ?? []}
                  roster={roster}
                />
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
