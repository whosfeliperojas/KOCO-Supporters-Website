"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import Peko from "@/components/Peko";
import { DATE_LOCALE } from "@/lib/i18n";

type Volunteer = { id: string; full_name: string; display_name: string | null };
type Post = { responsible_id: string | null; status: string };
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
  registration_status: string;
};

// Status palette — validated with the dataviz six-checks (CVD ΔE 15.8 worst pair)
const STATUS = {
  approved: "#38B39E", // teal  — reviewed & approved
  pipeline: "#ECA040", // amber — idea in the pipeline, not approved yet
  missing:  "#E2693E", // coral — nothing submitted this month
};

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function AdminDashboardClient({
  adminName,
  volunteers,
  monthPosts,
  events,
  locale: initialLocale,
}: {
  adminName: string;
  volunteers: Volunteer[];
  monthPosts: Post[];
  events: Event[];
  locale: "es" | "en" | "ko";
}) {
  const { locale } = useLocale();
  const [calView, setCalView] = useState<"week" | "month">("week");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const T = {
    es: {
      greeting: "Hola", tracker: "Contenidos del mes", trackerDesc: "Una idea por voluntario/a este mes",
      approved: "Aprobados", pipeline: "En proceso", missing: "Sin enviar",
      allDone: "¡Todo el equipo envió su idea este mes! ✦",
      pendingTitle: "Pendientes de enviar su propuesta",
      calTitle: "Eventos", week: "Semana", month: "Mes",
      thisWeek: "Esta semana", noWeekEvents: "No hay eventos esta semana",
      host: "Organizador", place: "Lugar", spots: "cupos", open: "Abierto", closedReg: "Cerrado",
      noEvents: "Sin eventos", prev: "Ant", next: "Sig",
      weekDays: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
      of: "de",
    },
    en: {
      greeting: "Hello", tracker: "This month's content", trackerDesc: "One idea per volunteer this month",
      approved: "Approved", pipeline: "In progress", missing: "Not submitted",
      allDone: "The whole team submitted their idea this month! ✦",
      pendingTitle: "Still pending their proposal",
      calTitle: "Events", week: "Week", month: "Month",
      thisWeek: "This week", noWeekEvents: "No events this week",
      host: "Host", place: "Place", spots: "spots", open: "Open", closedReg: "Closed",
      noEvents: "No events", prev: "Prev", next: "Next",
      weekDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      of: "of",
    },
    ko: {
      greeting: "안녕하세요", tracker: "이번 달 콘텐츠 현황", trackerDesc: "이번 달, 서포터즈 1인당 아이디어 1건",
      approved: "승인됨", pipeline: "진행 중", missing: "미제출",
      allDone: "이번 달은 전원이 아이디어를 냈어요! ✦",
      pendingTitle: "아직 제안을 기다리고 있어요",
      calTitle: "행사", week: "주간", month: "월간",
      thisWeek: "이번 주", noWeekEvents: "이번 주에는 행사가 없어요",
      host: "주최", place: "장소", spots: "정원", open: "모집 중", closedReg: "마감",
      noEvents: "행사 없음", prev: "이전", next: "다음",
      weekDays: ["일", "월", "화", "수", "목", "금", "토"],
      of: "/",
    },
  } as const;
  const L = T[locale];

  // ── Submission tracker ──────────────────────────────────────────
  const APPROVED_STATUSES = ["approved", "published"];
  const byVolunteer: Record<string, "approved" | "pipeline" | "missing"> = {};
  for (const v of volunteers) byVolunteer[v.id] = "missing";
  for (const p of monthPosts) {
    if (!p.responsible_id || !(p.responsible_id in byVolunteer)) continue;
    if (APPROVED_STATUSES.includes(p.status)) {
      byVolunteer[p.responsible_id] = "approved";
    } else if (byVolunteer[p.responsible_id] !== "approved") {
      byVolunteer[p.responsible_id] = "pipeline";
    }
  }

  const counts = { approved: 0, pipeline: 0, missing: 0 };
  for (const v of volunteers) counts[byVolunteer[v.id]]++;
  const total = volunteers.length || 1;
  const pending = volunteers.filter((v) => byVolunteer[v.id] === "missing");

  const monthLabel = new Date().toLocaleDateString(DATE_LOCALE[locale], { month: "long", year: "numeric" });

  const segments = [
    { key: "approved" as const, color: STATUS.approved, count: counts.approved, label: L.approved },
    { key: "pipeline" as const, color: STATUS.pipeline, count: counts.pipeline, label: L.pipeline },
    { key: "missing" as const,  color: STATUS.missing,  count: counts.missing,  label: L.missing },
  ].filter((s) => s.count > 0);

  // ── Events: week range ──────────────────────────────────────────
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split("T")[0];
  const weekEvents = events.filter((e) => e.event_date_start >= todayStr && e.event_date_start <= weekEndStr);

  function fmtDate(d: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
    return new Date(d + "T12:00:00").toLocaleDateString(DATE_LOCALE[locale], opts);
  }

  function EventDetailCard({ ev, i }: { ev: Event; i: number }) {
    const isOpen = ev.registration_status === "open";
    return (
      <div className="rounded-2xl p-4 shadow-koco anim-in" style={{ backgroundColor: "#FFFFFF", "--i": Math.min(i, 8) } as React.CSSProperties}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold" style={{ color: "#1C1C1C" }}>{ev.name}</p>
          <span
            className="label-style px-2 py-0.5 rounded-full text-xs shrink-0"
            style={{
              backgroundColor: isOpen ? "rgba(56,179,158,0.12)" : "rgba(0,0,0,0.06)",
              color: isOpen ? "#1F7A6E" : "#888",
            }}
          >
            {isOpen ? L.open : L.closedReg}
          </span>
        </div>
        <p className="text-xs mt-1 font-medium capitalize" style={{ color: "#ECA040" }}>
          {fmtDate(ev.event_date_start)}
          {ev.start_time ? ` · ${ev.start_time.slice(0, 5)}${ev.end_time ? `–${ev.end_time.slice(0, 5)}` : ""}` : ""}
        </p>
        {(ev.place || ev.host) && (
          <p className="text-xs mt-0.5" style={{ color: "#888" }}>
            {ev.place ? `📍 ${ev.place}` : ""}{ev.place && ev.host ? " · " : ""}{ev.host ? `${L.host}: ${ev.host}` : ""}
          </p>
        )}
        {ev.max_invited_koco != null && (
          <p className="text-xs mt-0.5" style={{ color: "#888" }}>{ev.max_invited_koco} {L.spots}</p>
        )}
        {ev.description && <p className="text-xs mt-2 leading-relaxed" style={{ color: "#555" }}>{ev.description}</p>}
      </div>
    );
  }

  // ── Month calendar ──────────────────────────────────────────────
  function MonthView() {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const cells = buildCalendarDays(year, month);
    const label = calMonth.toLocaleDateString(DATE_LOCALE[locale], { month: "long", year: "numeric" });

    function eventsOnDay(day: number) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return events.filter((e) =>
        e.event_date_start <= dateStr && (e.event_date_end ?? e.event_date_start) >= dateStr
      );
    }

    const selectedEvents = selectedDay ? eventsOnDay(selectedDay) : [];

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={() => { setCalMonth(new Date(year, month - 1, 1)); setSelectedDay(null); }} className="p-2 rounded-lg btn-hover text-sm font-bold" style={{ color: "#ECA040" }}>
            ‹ {L.prev}
          </button>
          <h3 className="text-sm font-bold capitalize" style={{ color: "#1C1C1C" }}>{label}</h3>
          <button onClick={() => { setCalMonth(new Date(year, month + 1, 1)); setSelectedDay(null); }} className="p-2 rounded-lg btn-hover text-sm font-bold" style={{ color: "#ECA040" }}>
            {L.next} ›
          </button>
        </div>

        <div key={`${year}-${month}`} className="rounded-2xl overflow-hidden shadow-koco anim-in" style={{ backgroundColor: "#F8F0DE" }}>
          <div className="grid grid-cols-7" style={{ backgroundColor: "#ECA040" }}>
            {L.weekDays.map((d) => <div key={d} className="py-1.5 text-center text-xs font-bold text-white">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="h-12" style={{ backgroundColor: "rgba(0,0,0,0.02)" }} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayEvents = eventsOnDay(day);
              const isToday = dateStr === todayStr;
              const isSelected = selectedDay === day;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className="h-12 flex flex-col items-center justify-center relative transition-colors"
                  style={{
                    backgroundColor: isSelected ? "rgba(236,160,64,0.15)" : isToday ? "rgba(56,179,158,0.08)" : "transparent",
                    borderRight: "1px solid #E8DCCF",
                    borderBottom: "1px solid #E8DCCF",
                  }}
                >
                  <span
                    className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full"
                    style={{ backgroundColor: isToday ? "#38B39E" : "transparent", color: isToday ? "white" : "#1C1C1C" }}
                  >
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="flex gap-0.5 mt-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span key={ev.id} className="block w-1 h-1 rounded-full" style={{ backgroundColor: "#ECA040" }} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {selectedDay && (
          <div key={selectedDay} className="space-y-2 anim-in">
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-center py-3" style={{ color: "#888" }}>{L.noEvents}</p>
            ) : (
              selectedEvents.map((ev, i) => <EventDetailCard key={ev.id} ev={ev} i={i} />)
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Greeting — the scrapbook moment */}
      <div className="flex items-center justify-between gap-4 anim-in" style={{ "--i": 0 } as React.CSSProperties}>
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "#1C1C1C" }}>
            {L.greeting}, {adminName} ✦
          </h1>
          <p className="text-sm mt-1 capitalize" style={{ color: "#888" }}>{monthLabel}</p>
        </div>
        {/* On desktop the sidebar companion greets — Peko appears here only on mobile */}
        <div className="md:hidden shrink-0">
          <Peko pose={pending.length === 0 ? "celebrate" : "wave"} size={84} animation="bob" blinkOnEvent />
        </div>
      </div>

      {/* ── Submission tracker ── */}
      <section className="rounded-2xl p-5 shadow-koco space-y-4 anim-in" style={{ backgroundColor: "#F8F0DE", "--i": 1 } as React.CSSProperties}>
        <div>
          <h2 className="text-base font-bold" style={{ color: "#1C1C1C" }}>{L.tracker}</h2>
          <p className="text-xs mt-0.5" style={{ color: "#888" }}>{L.trackerDesc}</p>
        </div>

        {/* Stacked horizontal bar — 2px surface gaps, rounded ends */}
        <div
          className="flex w-full h-6 rounded-md overflow-hidden"
          style={{ gap: 2 }}
          role="img"
          aria-label={`${L.approved}: ${counts.approved} · ${L.pipeline}: ${counts.pipeline} · ${L.missing}: ${counts.missing}`}
        >
          {segments.map((s) => (
            <div
              key={s.key}
              title={`${s.label}: ${s.count} ${L.of} ${volunteers.length}`}
              className="h-full transition-all"
              style={{
                width: `${(s.count / total) * 100}%`,
                backgroundColor: s.color,
                borderRadius: 4,
                transitionDuration: "400ms",
                transitionTimingFunction: "var(--ease-out-quart)",
              }}
            />
          ))}
        </div>

        {/* Legend — labels in ink, colored dots carry identity */}
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {[
            { color: STATUS.approved, label: L.approved, count: counts.approved },
            { color: STATUS.pipeline, label: L.pipeline, count: counts.pipeline },
            { color: STATUS.missing,  label: L.missing,  count: counts.missing },
          ].map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5 text-xs" style={{ color: "#555" }}>
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: s.color }} />
              <span className="font-medium" style={{ color: "#1C1C1C" }}>{s.label}</span>
              <span className="font-bold">{s.count}</span>
            </span>
          ))}
        </div>

        {/* Pending list / celebration */}
        {pending.length === 0 ? (
          <p className="text-sm font-medium anim-pop" style={{ color: "#1F7A6E" }}>{L.allDone}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#8C3010" }}>{L.pendingTitle}</p>
            <div className="flex flex-wrap gap-2">
              {pending.map((v, i) => (
                <span
                  key={v.id}
                  className="text-xs font-medium px-3 py-1.5 rounded-full anim-in"
                  style={{ backgroundColor: "rgba(226,105,62,0.10)", color: "#8C3010", "--i": Math.min(i, 8) } as React.CSSProperties}
                >
                  {v.display_name ?? v.full_name.split(" ")[0]} {v.full_name.split(" ").slice(-1)[0] !== (v.display_name ?? v.full_name.split(" ")[0]) ? v.full_name.split(" ").slice(-1)[0] : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Events calendar ── */}
      <section className="space-y-4 anim-in" style={{ "--i": 2 } as React.CSSProperties}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: "#1C1C1C" }}>{L.calTitle}</h2>
          {/* Week / Month sliding toggle */}
          <div
            role="radiogroup"
            aria-label={`${L.week} / ${L.month}`}
            className="relative grid grid-cols-2 rounded-full p-1 w-40"
            style={{ backgroundColor: "rgba(56,179,158,0.10)" }}
          >
            <span
              aria-hidden
              className="absolute top-1 bottom-1 rounded-full"
              style={{
                width: "calc((100% - 8px) / 2)",
                left: 4,
                transform: `translateX(${calView === "month" ? "100%" : "0%"})`,
                backgroundColor: "#38B39E",
                transition: "transform 200ms var(--ease-out-quart)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
              }}
            />
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                role="radio"
                aria-checked={calView === v}
                onClick={() => setCalView(v)}
                className="relative z-10 py-1.5 text-xs font-bold rounded-full text-center transition-colors"
                style={{ color: calView === v ? "#FFFFFF" : "#38B39E", transitionDuration: "200ms" }}
              >
                {v === "week" ? L.week : L.month}
              </button>
            ))}
          </div>
        </div>

        {calView === "week" ? (
          <div className="space-y-3" key="week">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#888" }}>{L.thisWeek}</p>
            {weekEvents.length === 0 ? (
              <div className="rounded-2xl text-center py-10 shadow-koco anim-in" style={{ backgroundColor: "#F8F0DE" }}>
                <p className="text-sm" style={{ color: "#888" }}>{L.noWeekEvents}</p>
              </div>
            ) : (
              weekEvents.map((ev, i) => <EventDetailCard key={ev.id} ev={ev} i={i} />)
            )}
            <Link href="/admin/events" className="inline-block text-xs font-bold underline" style={{ color: "#38B39E" }}>
              → {L.calTitle}
            </Link>
          </div>
        ) : (
          <MonthView key="month" />
        )}
      </section>
    </div>
  );
}
