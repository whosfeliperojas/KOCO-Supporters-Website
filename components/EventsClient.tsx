"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";
import { companionReact } from "@/components/Companion";
import { DATE_LOCALE, type Locale } from "@/lib/i18n";

type Event = {
  id: string;
  name: string;
  host: string | null;
  event_date_start: string;
  event_date_end: string | null;
  start_time: string | null;
  end_time: string | null;
  place: string | null;
  description: string | null;
  max_invited_koco: number | null;
  approval_status: string;
  registration_status: string;
};

type Rsvp = "accepted" | "declined";

function formatDate(start: string, end: string | null, locale: Locale) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  const langCode = DATE_LOCALE[locale];
  const s = new Date(start + "T12:00:00").toLocaleDateString(langCode, opts);
  if (!end) return s;
  const e = new Date(end + "T12:00:00").toLocaleDateString(langCode, opts);
  return `${s} – ${e}`;
}

function formatTime(start: string | null, end: string | null) {
  if (!start) return null;
  const s = start.slice(0, 5);
  return end ? `${s} – ${end.slice(0, 5)}` : s;
}

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type Proposal = {
  id: string;
  name: string;
  event_date_start: string;
  place: string | null;
  description: string | null;
  approval_status: "pending" | "confirmed" | "rejected";
};

export default function EventsClient({
  events,
  myRsvps: initialRsvps,
  acceptedCounts: initialCounts,
  myProposals: initialProposals,
  profileId,
  isAdmin,
  locale: initialLocale,
}: {
  events: Event[];
  myRsvps: Record<string, Rsvp>;
  acceptedCounts: Record<string, number>;
  myProposals: Proposal[];
  profileId: string;
  isAdmin: boolean;
  locale: "es" | "en" | "ko";
}) {
  const { locale } = useLocale();
  const [myRsvps, setMyRsvps] = useState<Record<string, Rsvp>>(initialRsvps);
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Volunteer event proposals
  const [proposals, setProposals] = useState<Proposal[]>(initialProposals);
  const [showPropose, setShowPropose] = useState(false);
  const [pName, setPName] = useState("");
  const [pDate, setPDate] = useState("");
  const [pPlace, setPPlace] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pStatus, setPStatus] = useState<"idle" | "sending" | "error">("idle");

  const today = new Date().toISOString().split("T")[0];
  const upcoming = events.filter((e) => e.event_date_start >= today);
  const past = events.filter((e) => e.event_date_start < today);

  const T = {
    es: {
      title: "Eventos", upcoming: "Próximos eventos", past: "Eventos pasados",
      noUp: "No hay eventos próximos confirmados",
      attend: "Inscribirme", decline: "No asistiré",
      attending: "Inscrito/a ✓", declined: "No asistirás",
      closed: "Registro cerrado", full: "Sin cupos",
      host: "Organizador", place: "Lugar",
      list: "Lista", calendar: "Calendario", noEvents: "Sin eventos",
      prev: "Ant", next: "Sig",
      spots: "cupos", spotsLeft: "cupos disponibles",
      confirmAttend: "¿Confirmas tu inscripción? Esta decisión no se puede cambiar.",
      confirmDecline: "¿Confirmas que NO asistirás? Esta decisión no se puede cambiar.",
      weekDays: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
      myProps: "Mis propuestas", propose: "+ Proponer evento",
      propName: "Nombre del evento", propDate: "Fecha", propDesc: "Descripción",
      propHint: "El equipo KOICA la revisará antes de publicarla.",
      propSend: "Enviar propuesta", propSending: "Enviando...", propCancel: "Cancelar",
      propSaved: "¡Propuesta enviada!", propRequired: "Nombre y fecha son obligatorios.",
      propPending: "Pendiente", propConfirmed: "Confirmado", propRejected: "Rechazado",
    },
    en: {
      title: "Events", upcoming: "Upcoming events", past: "Past events",
      noUp: "No upcoming confirmed events",
      attend: "Sign up", decline: "Not attending",
      attending: "Signed up ✓", declined: "Not attending",
      closed: "Registration closed", full: "No spots left",
      host: "Host", place: "Place",
      list: "List", calendar: "Calendar", noEvents: "No events",
      prev: "Prev", next: "Next",
      spots: "spots", spotsLeft: "spots left",
      myProps: "My proposals", propose: "+ Propose event",
      propName: "Event name", propDate: "Date", propDesc: "Description",
      propHint: "The KOICA team will review it before it goes live.",
      propSend: "Send proposal", propSending: "Sending...", propCancel: "Cancel",
      propSaved: "Proposal sent!", propRequired: "Name and date are required.",
      propPending: "Pending", propConfirmed: "Confirmed", propRejected: "Rejected",
      confirmAttend: "Confirm your sign-up? This choice cannot be changed.",
      confirmDecline: "Confirm you will NOT attend? This choice cannot be changed.",
      weekDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
    ko: {
      title: "행사", upcoming: "다가오는 행사", past: "지난 행사",
      noUp: "예정된 행사가 없어요",
      attend: "신청하기", decline: "불참할게요",
      attending: "신청 완료 ✓", declined: "불참",
      closed: "신청 마감", full: "정원 마감",
      host: "주최", place: "장소",
      list: "목록", calendar: "캘린더", noEvents: "행사 없음",
      prev: "이전", next: "다음",
      spots: "정원", spotsLeft: "자리 남음",
      myProps: "내 제안", propose: "+ 행사 제안하기",
      propName: "행사 이름", propDate: "날짜", propDesc: "설명",
      propHint: "KOICA 팀이 검토한 뒤에 올라가요.",
      propSend: "제안 보내기", propSending: "보내는 중...", propCancel: "취소",
      propSaved: "제안을 보냈어요!", propRequired: "이름과 날짜는 필수예요.",
      propPending: "대기 중", propConfirmed: "확정", propRejected: "반려",
      confirmAttend: "신청할까요? 한 번 정하면 바꿀 수 없어요.",
      confirmDecline: "불참으로 할까요? 한 번 정하면 바꿀 수 없어요.",
      weekDays: ["일", "월", "화", "수", "목", "금", "토"],
    },
  } as const;
  const L = T[locale];

  async function submitProposal(e: React.FormEvent) {
    e.preventDefault();
    if (!pName.trim() || !pDate) return;
    setPStatus("sending");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("events")
      .insert({
        name: pName.trim(),
        event_date_start: pDate,
        place: pPlace.trim() || null,
        description: pDesc.trim() || null,
        approval_status: "pending",
        registration_status: "closed",
        proposed_by_id: profileId,
        created_by: profileId,
      })
      .select("id, name, event_date_start, place, description, approval_status")
      .single();

    if (error || !data) {
      setPStatus("error");
      return;
    }
    setProposals((prev) => [data as Proposal, ...prev]);
    setPName(""); setPDate(""); setPPlace(""); setPDesc("");
    setPStatus("idle");
    setShowPropose(false);
    companionReact("celebrate", L.propSaved);
  }

  async function submitRsvp(event: Event, choice: Rsvp) {
    const message = choice === "accepted" ? L.confirmAttend : L.confirmDecline;
    if (!window.confirm(message)) return;

    setLoadingId(event.id);
    const supabase = createClient();
    const { error } = await supabase.from("event_attendees").insert({
      event_id: event.id,
      volunteer_id: profileId,
      role: "attendee",
      rsvp: choice,
    });
    setLoadingId(null);

    if (!error) {
      setMyRsvps((prev) => ({ ...prev, [event.id]: choice }));
      if (choice === "accepted") {
        setCounts((prev) => ({ ...prev, [event.id]: (prev[event.id] ?? 0) + 1 }));
        companionReact("celebrate");
      }
    }
  }

  function EventCard({ event, showSignup }: { event: Event; showSignup: boolean }) {
    const myChoice = myRsvps[event.id];
    const isOpen = event.registration_status === "open";
    const count = counts[event.id] ?? 0;
    const isFull = event.max_invited_koco != null && count >= event.max_invited_koco;
    const time = formatTime(event.start_time, event.end_time);
    const loading = loadingId === event.id;
    const spotsLeft = event.max_invited_koco != null ? Math.max(0, event.max_invited_koco - count) : null;

    return (
      <div className="rounded-2xl p-5 shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold" style={{ color: "#1C1C1C" }}>{event.name}</h3>
            <p className="text-sm mt-1 font-medium" style={{ color: "#ECA040" }}>
              {formatDate(event.event_date_start, event.event_date_end, locale)}
              {time ? ` · ${time}` : ""}
            </p>
            {event.place && <p className="text-xs mt-0.5" style={{ color: "#888" }}>📍 {event.place}</p>}
            {event.host && <p className="text-xs mt-0.5" style={{ color: "#888" }}>{L.host}: {event.host}</p>}
            {spotsLeft != null && showSignup && !myChoice && (
              <p className="text-xs mt-1 font-medium" style={{ color: isFull ? "#E2693E" : "#38B39E" }}>
                {isFull ? L.full : `${spotsLeft} ${L.spotsLeft}`}
              </p>
            )}
            {event.description && <p className="text-sm mt-2 leading-relaxed" style={{ color: "#555" }}>{event.description}</p>}
          </div>

          {showSignup && (
            <div className="shrink-0 flex flex-col gap-2">
              {myChoice ? (
                <span
                  className="text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap anim-pop"
                  style={{
                    backgroundColor: myChoice === "accepted" ? "rgba(56,179,158,0.12)" : "rgba(0,0,0,0.06)",
                    color: myChoice === "accepted" ? "#38B39E" : "#888",
                  }}
                >
                  {myChoice === "accepted" ? L.attending : L.declined}
                </span>
              ) : !isOpen ? (
                <span className="text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap" style={{ backgroundColor: "rgba(0,0,0,0.06)", color: "#888" }}>
                  {L.closed}
                </span>
              ) : isFull ? (
                <span className="text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap" style={{ backgroundColor: "rgba(226,105,62,0.12)", color: "#E2693E" }}>
                  {L.full}
                </span>
              ) : (
                <>
                  <button
                    onClick={() => submitRsvp(event, "accepted")}
                    disabled={loading}
                    className="text-xs font-bold px-3 py-2 rounded-xl text-white btn-hover whitespace-nowrap"
                    style={{ backgroundColor: "#ECA040", opacity: loading ? 0.6 : 1 }}
                  >
                    {loading ? "..." : L.attend}
                  </button>
                  <button
                    onClick={() => submitRsvp(event, "declined")}
                    disabled={loading}
                    className="text-xs font-bold px-3 py-2 rounded-xl btn-hover whitespace-nowrap"
                    style={{ backgroundColor: "rgba(0,0,0,0.06)", color: "#6B6258", opacity: loading ? 0.6 : 1 }}
                  >
                    {loading ? "..." : L.decline}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Calendar view ──────────────────────────────────────────────────
  function CalendarView() {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const cells = buildCalendarDays(year, month);

    const monthLabel = calMonth.toLocaleDateString(DATE_LOCALE[locale], { month: "long", year: "numeric" });

    function eventsOnDay(day: number) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return events.filter((e) => {
        if (e.event_date_start <= dateStr && (e.event_date_end ?? e.event_date_start) >= dateStr) return true;
        return e.event_date_start === dateStr;
      });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const selectedEvents = selectedDay ? eventsOnDay(selectedDay) : [];

    return (
      <div className="space-y-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setCalMonth(new Date(year, month - 1, 1)); setSelectedDay(null); }}
            className="p-2 rounded-lg btn-hover text-sm font-bold"
            style={{ color: "#ECA040" }}
          >
            ‹ {L.prev}
          </button>
          <h2 className="text-base font-bold capitalize" style={{ color: "#1C1C1C" }}>{monthLabel}</h2>
          <button
            onClick={() => { setCalMonth(new Date(year, month + 1, 1)); setSelectedDay(null); }}
            className="p-2 rounded-lg btn-hover text-sm font-bold"
            style={{ color: "#ECA040" }}
          >
            {L.next} ›
          </button>
        </div>

        {/* Grid — keyed by month so navigation gets a fresh entrance */}
        <div key={`${year}-${month}`} className="rounded-2xl overflow-hidden shadow-koco anim-in" style={{ backgroundColor: "#F8F0DE" }}>
          <div className="grid grid-cols-7 border-b" style={{ borderColor: "#E8DCCF", backgroundColor: "#ECA040" }}>
            {L.weekDays.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-bold text-white">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="aspect-square" style={{ backgroundColor: "rgba(0,0,0,0.02)" }} />;

              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayEvents = eventsOnDay(day);
              const isToday = dateStr === todayStr;
              const isSelected = selectedDay === day;

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className="aspect-square flex flex-col items-center pt-1.5 pb-1 relative transition-colors"
                  style={{
                    backgroundColor: isSelected ? "rgba(236,160,64,0.15)" : isToday ? "rgba(56,179,158,0.08)" : "transparent",
                    borderRight: "1px solid #E8DCCF",
                    borderBottom: "1px solid #E8DCCF",
                  }}
                >
                  <span
                    className="text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full"
                    style={{
                      backgroundColor: isToday ? "#38B39E" : "transparent",
                      color: isToday ? "white" : "#1C1C1C",
                    }}
                  >
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-0.5 mt-0.5 px-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className="block w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: ev.event_date_start >= todayStr ? "#ECA040" : "#CDD909" }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day event list */}
        {selectedDay && (
          <div className="space-y-3 anim-in" key={selectedDay}>
            <h3 className="text-sm font-bold" style={{ color: "#1C1C1C" }}>
              {new Date(year, month, selectedDay).toLocaleDateString(DATE_LOCALE[locale], { weekday: "long", day: "numeric", month: "long" })}
            </h3>
            {selectedEvents.length === 0 ? (
              <p className="text-sm" style={{ color: "#888" }}>{L.noEvents}</p>
            ) : (
              selectedEvents.map((ev) => (
                <EventCard key={ev.id} event={ev} showSignup={!isAdmin && ev.event_date_start >= todayStr} />
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header + propose button (volunteers) + sliding view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 anim-in" style={{ "--i": 0 } as React.CSSProperties}>
        <h1 className="text-2xl font-bold" style={{ color: "#1C1C1C" }}>{L.title}</h1>
        <div className="flex items-center gap-3">
        {!isAdmin && (
          <button
            onClick={() => {
              setView("list");
              setShowPropose(true);
              setTimeout(() => document.getElementById("propose-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
            }}
            className="text-xs font-bold px-3 py-2 rounded-lg text-white btn-hover whitespace-nowrap"
            style={{ backgroundColor: "#38B39E" }}
          >
            {L.propose}
          </button>
        )}
        <div
          role="radiogroup"
          aria-label={`${L.list} / ${L.calendar}`}
          className="relative grid grid-cols-2 rounded-full p-1 w-48"
          style={{ backgroundColor: "rgba(236,160,64,0.12)" }}
        >
          <span
            aria-hidden
            className="absolute top-1 bottom-1 rounded-full"
            style={{
              width: "calc((100% - 8px) / 2)",
              left: 4,
              transform: `translateX(${view === "calendar" ? "100%" : "0%"})`,
              backgroundColor: "#ECA040",
              transition: "transform 200ms var(--ease-out-quart)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
            }}
          />
          {(["list", "calendar"] as const).map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={view === v}
              onClick={() => setView(v)}
              className="relative z-10 py-1.5 text-sm font-bold rounded-full text-center transition-colors"
              style={{ color: view === v ? "#FFFFFF" : "#B07A1A", transitionDuration: "200ms" }}
            >
              {v === "list" ? L.list : L.calendar}
            </button>
          ))}
        </div>
        </div>
      </div>

      {view === "calendar" ? (
        <CalendarView />
      ) : (
        <>
          {/* Upcoming */}
          <section className="space-y-4">
            <h2 className="text-base font-bold anim-in" style={{ color: "#1C1C1C", "--i": 1 } as React.CSSProperties}>{L.upcoming}</h2>
            {upcoming.length === 0 ? (
              <div className="rounded-2xl text-center py-10 shadow-koco anim-in" style={{ backgroundColor: "#F8F0DE", "--i": 2 } as React.CSSProperties}>
                {/* Official brand sticker: the KOICA van will bring the next one */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/art-van.webp" alt="" aria-hidden className="mx-auto mb-3 select-none" style={{ width: 170 }} />
                <p className="text-sm" style={{ color: "#888" }}>{L.noUp}</p>
              </div>
            ) : (
              upcoming.map((ev, i) => (
                <div key={ev.id} className="anim-in" style={{ "--i": Math.min(i + 2, 8) } as React.CSSProperties}>
                  <EventCard event={ev} showSignup={!isAdmin} />
                </div>
              ))
            )}
          </section>

          {/* Volunteer proposals — propose new + track existing */}
          {!isAdmin && (showPropose || proposals.length > 0) && (
            <section className="space-y-3 anim-in" style={{ "--i": 3 } as React.CSSProperties}>
              <h2 className="text-base font-bold" style={{ color: "#1C1C1C" }}>{L.myProps}</h2>

              {showPropose && (
                <form id="propose-form" onSubmit={submitProposal} className="rounded-2xl p-5 shadow-koco space-y-3 anim-pop" style={{ backgroundColor: "#F8F0DE" }}>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.propName} *</label>
                      <input
                        value={pName}
                        onChange={(e) => setPName(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                        style={{ backgroundColor: "#F8F0DE", border: "1.5px solid #DDD0C4", color: "#1C1C1C" }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.propDate} *</label>
                      <input
                        type="date"
                        value={pDate}
                        onChange={(e) => setPDate(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                        style={{ backgroundColor: "#F8F0DE", border: "1.5px solid #DDD0C4", color: "#1C1C1C" }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.place}</label>
                    <input
                      value={pPlace}
                      onChange={(e) => setPPlace(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                      style={{ backgroundColor: "#F8F0DE", border: "1.5px solid #DDD0C4", color: "#1C1C1C" }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.propDesc}</label>
                    <textarea
                      value={pDesc}
                      onChange={(e) => setPDesc(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-y"
                      style={{ backgroundColor: "#F8F0DE", border: "1.5px solid #DDD0C4", color: "#1C1C1C" }}
                    />
                  </div>
                  <p className="text-xs" style={{ color: "#888" }}>{L.propHint}</p>
                  {pStatus === "error" && (
                    <p className="text-xs anim-pop" style={{ color: "#E2693E" }}>{L.propRequired}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={pStatus === "sending"}
                      className="text-xs font-bold px-4 py-2 rounded-lg text-white btn-hover"
                      style={{ backgroundColor: "#38B39E", opacity: pStatus === "sending" ? 0.6 : 1 }}
                    >
                      {pStatus === "sending" ? L.propSending : L.propSend}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowPropose(false); setPStatus("idle"); }}
                      className="text-xs font-medium px-4 py-2 rounded-lg"
                      style={{ color: "#6B6258" }}
                    >
                      {L.propCancel}
                    </button>
                  </div>
                </form>
              )}

              {proposals.length > 0 && (
                <div className="rounded-2xl overflow-hidden shadow-koco divide-y" style={{ backgroundColor: "#F8F0DE", borderColor: "#E8DCCF" }}>
                  {proposals.map((p) => {
                    const chip = p.approval_status === "confirmed"
                      ? { bg: "rgba(56,179,158,0.14)", color: "#1F7A6E", label: L.propConfirmed }
                      : p.approval_status === "rejected"
                      ? { bg: "rgba(226,105,62,0.14)", color: "#B3401E", label: L.propRejected }
                      : { bg: "rgba(236,160,64,0.16)", color: "#B07A1A", label: L.propPending };
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "#1C1C1C" }}>{p.name}</p>
                          <p className="text-xs" style={{ color: "#888" }}>
                            {p.event_date_start}{p.place ? ` · ${p.place}` : ""}
                          </p>
                        </div>
                        <span className="label-style px-2.5 py-0.5 rounded-full text-xs shrink-0" style={{ backgroundColor: chip.bg, color: chip.color }}>
                          {chip.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Past */}
          {past.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-base font-bold" style={{ color: "#888" }}>{L.past}</h2>
              {past.map((ev) => (
                <div key={ev.id} style={{ opacity: 0.65 }}>
                  <EventCard event={ev} showSignup={false} />
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
