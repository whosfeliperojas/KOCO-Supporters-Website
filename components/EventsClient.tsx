"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import EventStatusChip from "@/components/EventStatusChip";
import { useLocale } from "@/lib/locale-context";
import { companionReact } from "@/components/Companion";
import { DATE_LOCALE, type Locale } from "@/lib/i18n";
import EventEditForm from "@/components/EventEditForm";
import EventSignupsList from "@/components/EventSignupsList";
import GlassDatePicker from "@/components/glass/GlassDatePicker";
import GlassTimePicker from "@/components/glass/GlassTimePicker";

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
  proposed_by_id: string | null;
};

type Rsvp = "accepted" | "declined";

function formatDate(
  start: string | null,
  end: string | null,
  locale: Locale,
  dateNote?: string | null
) {
  // Unscheduled events show the sheet's own wording ("Early November")
  // rather than a fabricated date.
  if (!start) return dateNote ?? "—";
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
  /** Keyed to the event, so the message lands on the card that failed. */
  const [rsvpError, setRsvpError] = useState<{ id: string; message: string } | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Volunteer event proposals
  const [proposals, setProposals] = useState<Proposal[]>(initialProposals);
  const [showPropose, setShowPropose] = useState(false);
  // The proposal form carries every field the admin create form does, minus
  // the two decisions that are not a volunteer's to make: approval, and
  // whether registration is open. A proposal that arrives with the host and
  // the times already filled in can be approved as-is.
  const [pName, setPName] = useState("");
  const [pHost, setPHost] = useState("");
  const [pDate, setPDate] = useState("");
  const [pDateEnd, setPDateEnd] = useState("");
  const [pTimeStart, setPTimeStart] = useState("");
  const [pTimeEnd, setPTimeEnd] = useState("");
  const [pPlace, setPPlace] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pMax, setPMax] = useState<number | "">("");
  const [pStatus, setPStatus] = useState<"idle" | "sending" | "error">("idle");

  const today = new Date().toISOString().split("T")[0];
  // An event with no date yet is still ahead of us, not in the past - a null
  // start would otherwise compare false and silently land in "past".
  const upcoming = events.filter((e) => !e.event_date_start || e.event_date_start >= today);
  const past = events.filter((e) => !!e.event_date_start && e.event_date_start < today);

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
      rsvpFailed: "No pudimos registrar tu inscripción. Inténtalo de nuevo.",
      confirmAttend: "¿Confirmas tu inscripción? Esta decisión no se puede cambiar.",
      confirmDecline: "¿Confirmas que NO asistirás? Esta decisión no se puede cambiar.",
      weekDays: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
      myProps: "Mis propuestas", propose: "+ Proponer evento",
      propName: "Nombre del evento", propDate: "Fecha inicio", propDesc: "Descripción",
      propDateEnd: "Fecha fin (opcional)", propTimeStart: "Hora inicio", propTimeEnd: "Hora fin",
      propMax: "Cupos (máx. asistentes)", propMaxHint: "Sin límite si queda vacío",
      propHint: "El equipo KOICA la revisará antes de publicarla.",
      propSend: "Enviar propuesta", propSending: "Enviando...", propCancel: "Cancelar",
      propSaved: "¡Propuesta enviada!", propRequired: "Nombre y fecha son obligatorios.",
      editBtn: "Editar mi evento", editHint: "Puedes editarlo mientras las inscripciones están abiertas.",
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
      propName: "Event name", propDate: "Start date", propDesc: "Description",
      propDateEnd: "End date (optional)", propTimeStart: "Start time", propTimeEnd: "End time",
      propMax: "Spots (max attendees)", propMaxHint: "No limit if left empty",
      propHint: "The KOICA team will review it before it goes live.",
      propSend: "Send proposal", propSending: "Sending...", propCancel: "Cancel",
      propSaved: "Proposal sent!", propRequired: "Name and date are required.",
      editBtn: "Edit my event", editHint: "You can edit it while registration is open.",
      rsvpFailed: "We couldn’t register your sign-up. Please try again.",
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
      propName: "행사 이름", propDate: "시작 날짜", propDesc: "설명",
      propDateEnd: "종료 날짜 (선택)", propTimeStart: "시작 시간", propTimeEnd: "종료 시간",
      propMax: "정원 (최대 인원)", propMaxHint: "비워 두면 제한 없음",
      propHint: "KOICA 팀이 검토한 뒤에 올라가요.",
      propSend: "제안 보내기", propSending: "보내는 중...", propCancel: "취소",
      propSaved: "제안을 보냈어요!", propRequired: "이름과 날짜는 필수예요.",
      editBtn: "내 행사 수정", editHint: "신청이 열려 있는 동안 수정할 수 있어요.",
      confirmAttend: "신청할까요? 한 번 정하면 바꿀 수 없어요.",
      confirmDecline: "불참으로 할까요? 한 번 정하면 바꿀 수 없어요.",
      rsvpFailed: "신청을 등록하지 못했어요. 다시 시도해 주세요.",
      weekDays: ["일", "월", "화", "수", "목", "금", "토"],
    },
  } as const;
  const L = T[locale];

  /** Matches the admin create form's inputStyle, field for field. */
  const propInput = { backgroundColor: "#FDFAF3", border: "1.5px solid #DDD0C4", color: "#1C1C1C" };

  async function submitProposal(e: React.FormEvent) {
    e.preventDefault();
    if (!pName.trim() || !pDate) return;
    setPStatus("sending");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("events")
      .insert({
        name: pName.trim(),
        host: pHost.trim() || null,
        event_date_start: pDate,
        event_date_end: pDateEnd || null,
        start_time: pTimeStart || null,
        end_time: pTimeEnd || null,
        place: pPlace.trim() || null,
        description: pDesc.trim() || null,
        // Same field the admin create form uses, so a proposal arrives with
        // everything an admin needs to approve it as-is — no back-and-forth
        // just to ask "how many spots?".
        max_invited_koco: pMax === "" ? null : Number(pMax),
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
    setPName(""); setPHost(""); setPDate(""); setPDateEnd("");
    setPTimeStart(""); setPTimeEnd(""); setPPlace(""); setPDesc(""); setPMax("");
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

    if (error) {
      // This branch did not exist: a refused sign-up left the card completely
      // unchanged, after the volunteer had already confirmed. The single most
      // important action on this screen failed in total silence.
      console.error("event_attendees insert failed:", error);
      setRsvpError({ id: event.id, message: L.rsvpFailed });
      return;
    }
    setRsvpError(null);
    setMyRsvps((prev) => ({ ...prev, [event.id]: choice }));
    if (choice === "accepted") {
      setCounts((prev) => ({ ...prev, [event.id]: (prev[event.id] ?? 0) + 1 }));
      companionReact("celebrate");
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
    // A cancelled or not-yet-approved event is shown, but never signable.
    const state = event.approval_status;
    const isCancelled = state === "cancelled" || state === "rejected";
    const canSignUp = showSignup && state === "confirmed";
    // The proposer can fix their own event's details once it is live, but only
    // while registration is open — once closed, only an admin still can
    // (migration 30). Admins manage events from their own page, not here.
    const canEditMine =
      !isAdmin && event.proposed_by_id === profileId && state === "confirmed" && isOpen;

    return (
      <div className="rounded-2xl p-5 shadow-koco" style={{ backgroundColor: "#FDFAF3" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="text-base font-bold"
                style={{ color: "#1C1C1C", textDecoration: isCancelled ? "line-through" : undefined }}
              >
                {event.name}
              </h3>
              <EventStatusChip status={state} />
            </div>
            <p className="text-sm mt-1 font-medium" style={{ color: "#8A5A00" }}>
              {formatDate(event.event_date_start, event.event_date_end, locale, event.date_note)}
              {time ? ` · ${time}` : ""}
            </p>
            {event.place && <p className="text-xs mt-0.5" style={{ color: "#6B6258" }}>📍 {event.place}</p>}
            {event.host && <p className="text-xs mt-0.5" style={{ color: "#6B6258" }}>{L.host}: {event.host}</p>}
            {spotsLeft != null && canSignUp && !myChoice && (
              <p className="text-xs mt-1 font-medium" style={{ color: isFull ? "#E2693E" : "#38B39E" }}>
                {isFull ? L.full : `${spotsLeft} ${L.spotsLeft}`}
              </p>
            )}
            {event.description && <p className="text-sm mt-2 leading-relaxed measure" style={{ color: "#555" }}>{event.description}</p>}
            {rsvpError?.id === event.id && (
              <p role="alert" className="text-xs font-medium mt-2" style={{ color: "#8C3010" }}>{rsvpError.message}</p>
            )}
          </div>

          {canSignUp && (
            <div className="shrink-0 flex flex-col gap-2">
              {myChoice ? (
                <span
                  className="text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap anim-pop"
                  style={{
                    backgroundColor: myChoice === "accepted" ? "rgba(56,179,158,0.12)" : "rgba(0,0,0,0.06)",
                    color: myChoice === "accepted" ? "#1F7A6E" : "#6B6258",
                  }}
                >
                  {myChoice === "accepted" ? L.attending : L.declined}
                </span>
              ) : !isOpen ? (
                <span className="text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap" style={{ backgroundColor: "rgba(0,0,0,0.06)", color: "#6B6258" }}>
                  {L.closed}
                </span>
              ) : isFull ? (
                <span className="text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap" style={{ backgroundColor: "rgba(226,105,62,0.12)", color: "#8C3010" }}>
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

        {canEditMine && editingId !== event.id && (
          <button
            onClick={() => setEditingId(event.id)}
            title={L.editHint}
            className="text-xs font-bold btn-hover mt-2 px-1 py-0.5 -ml-1 rounded"
            style={{ color: "#1F7A6E" }}
          >
            ✎ {L.editBtn}
          </button>
        )}
        {canEditMine && editingId === event.id && (
          <div className="mt-3">
            <EventEditForm
              event={event}
              onCancel={() => setEditingId(null)}
              onSaved={() => setEditingId(null)}
            />
          </div>
        )}

        {/* Who's coming — any confirmed event, so a volunteer can see who else
            will be there before deciding to sign up. Admins manage the full
            list with attendance controls from /admin/events instead. */}
        {!isAdmin && state === "confirmed" && (
          <EventSignupsList eventId={event.id} count={count} />
        )}
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
        if (!e.event_date_start) return false; // unscheduled: no day to land on
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
            style={{ color: "#8A5A00" }}
          >
            ‹ {L.prev}
          </button>
          <h2 className="text-base font-bold capitalize" style={{ color: "#1C1C1C" }}>{monthLabel}</h2>
          <button
            onClick={() => { setCalMonth(new Date(year, month + 1, 1)); setSelectedDay(null); }}
            className="p-2 rounded-lg btn-hover text-sm font-bold"
            style={{ color: "#8A5A00" }}
          >
            {L.next} ›
          </button>
        </div>

        {/* Grid — keyed by month so navigation gets a fresh entrance */}
        <div key={`${year}-${month}`} className="rounded-2xl overflow-hidden shadow-koco anim-in" style={{ backgroundColor: "#FDFAF3" }}>
          <div className="grid grid-cols-7 border-b" style={{ borderColor: "#EFE6D9", backgroundColor: "#ECA040" }}>
            {L.weekDays.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-bold" style={{ color: "#4A2C00" }}>{d}</div>
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
                    borderRight: "1px solid #EFE6D9",
                    borderBottom: "1px solid #EFE6D9",
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
                          style={{ backgroundColor: !ev.event_date_start || ev.event_date_start >= todayStr ? "#ECA040" : "#CDD909" }}
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
              <p className="text-sm" style={{ color: "#6B6258" }}>{L.noEvents}</p>
            ) : (
              selectedEvents.map((ev) => (
                <EventCard key={ev.id} event={ev} showSignup={!isAdmin && (!ev.event_date_start || ev.event_date_start >= todayStr)} />
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
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
              <div className="rounded-2xl text-center py-10 shadow-koco anim-in" style={{ backgroundColor: "#FDFAF3", "--i": 2 } as React.CSSProperties}>
                {/* Official brand sticker: the KOICA van will bring the next one */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/art-van.webp" alt="" aria-hidden className="mx-auto mb-3 select-none" style={{ width: 170 }} />
                <p className="text-sm" style={{ color: "#6B6258" }}>{L.noUp}</p>
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
                <form id="propose-form" onSubmit={submitProposal} className="rounded-2xl p-5 shadow-koco space-y-3 anim-pop" style={{ backgroundColor: "#FDFAF3" }}>
                  {/* Same fields, same order, same pairings as the admin
                      create form in AdminEventsClient - a volunteer describes
                      an event exactly the way an admin does. */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.propName} *</label>
                    <input
                      value={pName}
                      onChange={(e) => setPName(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                      style={propInput}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.host}</label>
                      <input value={pHost} onChange={(e) => setPHost(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={propInput} />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.place}</label>
                      <input value={pPlace} onChange={(e) => setPPlace(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg outline-none" style={propInput} />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.propDate} *</label>
                      <GlassDatePicker ariaLabel={L.propDate} value={pDate} onChange={setPDate} required />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.propDateEnd}</label>
                      <GlassDatePicker ariaLabel={L.propDateEnd} value={pDateEnd} onChange={setPDateEnd} min={pDate || undefined} />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.propTimeStart}</label>
                      <GlassTimePicker ariaLabel={L.propTimeStart} value={pTimeStart} onChange={setPTimeStart} />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.propTimeEnd}</label>
                      <GlassTimePicker ariaLabel={L.propTimeEnd} value={pTimeEnd} onChange={setPTimeEnd} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.propDesc}</label>
                    <textarea
                      value={pDesc}
                      onChange={(e) => setPDesc(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-y"
                      style={propInput}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-medium" style={{ color: "#1C1C1C" }}>{L.propMax}</label>
                    <input
                      type="number"
                      min={1}
                      value={pMax}
                      onChange={(e) => setPMax(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full sm:w-40 px-3 py-2 text-sm rounded-lg outline-none"
                      style={propInput}
                    />
                    <p className="text-xs" style={{ color: "#6B6258" }}>{L.propMaxHint}</p>
                  </div>
                  <p className="text-xs" style={{ color: "#6B6258" }}>{L.propHint}</p>
                  {pStatus === "error" && (
                    <p className="text-xs anim-pop" style={{ color: "#8C3010" }}>{L.propRequired}</p>
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
                <div className="rounded-2xl overflow-hidden shadow-koco divide-y" style={{ backgroundColor: "#FDFAF3", borderColor: "#EFE6D9" }}>
                  {proposals.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "#1C1C1C" }}>{p.name}</p>
                        <p className="text-xs" style={{ color: "#6B6258" }}>
                          {p.event_date_start}{p.place ? ` · ${p.place}` : ""}
                        </p>
                      </div>
                      {/* `always`: on your own proposals the verdict is the
                          whole point, so "approved" is spelled out here even
                          though it stays implicit on the events list. */}
                      <span className="shrink-0">
                        <EventStatusChip status={p.approval_status} always />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Past */}
          {past.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-base font-bold" style={{ color: "#6B6258" }}>{L.past}</h2>
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
