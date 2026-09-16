"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import Peko, { triggerPekoBlink } from "@/components/Peko";
import type { ContentStatus, Profile } from "@/lib/types";
import { CONTENT_STATUS_LABEL } from "@/lib/i18n";
import { CONTENT_STATUS_COLOR } from "@/lib/status-colors";

function StatCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="rounded-2xl p-5 shadow-koco" style={{ backgroundColor: "#FDFAF3" }}>
      <p className="label-style mb-1" style={{ color: "#6B6258" }}>{label}</p>
      <p className="text-3xl font-bold anim-pop" style={{ color: accent, animationDelay: "180ms" }}>{value}</p>
    </div>
  );
}

export default function DashboardClient({
  profile,
  points,
  upcomingEvents,
  recentPosts,
}: {
  profile: Profile;
  points: { points_earned: number; date: string | null; notes: string | null; criteria: { category: string; description_es: string | null; description_en: string | null } | null }[];
  upcomingEvents: { id: string; name: string; event_date_start: string; event_date_end: string | null; place: string | null; registration_status: string }[];
  recentPosts: { id: string; title: string; status: string; publication_date: string | null; format: string | null }[];
}) {
  const { locale } = useLocale();
  const firstName = profile.display_name ?? profile.full_name.split(" ")[0];
  const totalPoints = points.reduce((s, p) => s + p.points_earned, 0);

  // The pipeline, one bucket per state, in the order work actually moves
  // through it - and in the shared colours, so the count here and the chip on
  // the post itself are the same colour for the same state.
  //
  // It reads from the volunteer's side: an idea they are still working on,
  // one they have sent, then the two outcomes, with rejected last. in_review
  // is an admin's own step and is not a bucket here - to a volunteer it is
  // simply still sent, which is why it now shares submitted's colour.
  const PIPELINE: ContentStatus[] = ["in_progress", "submitted", "approved", "published", "rejected"];
  const pipelineCounts = PIPELINE.map((status) => ({
    status,
    count: recentPosts.filter((p) => p.status === status).length,
  }));
  // Every idea the volunteer leads, whatever state it is in - including the
  // ones not yet sent (draft, not started, in progress) that the bar leaves
  // out, so the headline number matches the Content tab's own count.
  const totalIdeas = recentPosts.length;
  const inPipeline = pipelineCounts.reduce((n, c) => n + c.count, 0);

  const T = {
    es: {
      greeting: "Hola", totalPoints: "Puntos totales", myIdeas: "Mis ideas",
      recentActivity: "Actividad reciente", upcoming: "Próximos eventos",
      viewAll: "Ver todos", noActivity: "Sin actividad aún", noEvents: "Sin eventos próximos",
      pts: "pts", newContent: "Nuevo contenido", open: "Abierto", closed: "Cerrado",
      ideasTotal: "ideas en total", noIdeas: "Aún no tienes ideas. ¿Propones la primera?",
      notSent: "sin enviar", pipelineLabel: "Estado de tus ideas",
    },
    en: {
      greeting: "Hello", totalPoints: "Total points", myIdeas: "My ideas",
      recentActivity: "Recent activity", upcoming: "Upcoming events",
      viewAll: "View all", noActivity: "No activity yet", noEvents: "No upcoming events",
      pts: "pts", newContent: "New post", open: "Open", closed: "Closed",
      ideasTotal: "ideas in total", noIdeas: "No ideas yet. Want to propose the first one?",
      notSent: "not sent yet", pipelineLabel: "Where your ideas stand",
    },
    ko: {
      greeting: "안녕하세요", totalPoints: "전체 포인트", myIdeas: "내 아이디어",
      recentActivity: "최근 활동", upcoming: "다가오는 행사",
      viewAll: "전체 보기", noActivity: "아직 활동 내역이 없어요", noEvents: "예정된 행사가 없어요",
      pts: "점", newContent: "새 콘텐츠", open: "모집 중", closed: "마감",
      ideasTotal: "개의 아이디어", noIdeas: "아직 아이디어가 없어요. 첫 아이디어를 제안해 볼까요?",
      notSent: "미제출", pipelineLabel: "내 아이디어 현황",
    },
  } as const;
  const L = T[locale];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between gap-4 anim-in" style={{ "--i": 0 } as React.CSSProperties}>
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "#1C1C1C" }}>
            {L.greeting}, {firstName}
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6B6258" }}>
            {profile.group?.name ?? "KOCO Supporters"} · 2026
          </p>
        </div>
        {/* On desktop the sidebar companion greets — Peko appears here only on mobile */}
        <div className="md:hidden shrink-0">
          <Peko pose="wave" size={84} animation="bob" blinkOnEvent />
        </div>
      </div>

      {/* Stats row: two equal cards, so the ideas box matches the points box
          beside it rather than running double its width. */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="anim-in" style={{ "--i": 1 } as React.CSSProperties}>
          <StatCard label={L.totalPoints} value={totalPoints} accent="#6E7A00" />
        </div>

        {/* Where every idea of mine currently stands.

            Built as the points card's partner rather than a dashboard of its
            own: the same label, then one number, then the answer to "how are
            my ideas doing" as a single bar you read in a glance. The hue
            lives in the bar and the legend dots; the words stay dark ink, so
            the blush and lime states are as readable as the teal one. */}
        <div className="anim-in rounded-2xl p-5 shadow-koco flex flex-col" style={{ backgroundColor: "#FDFAF3", "--i": 2 } as React.CSSProperties}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <p className="label-style" style={{ color: "#6B6258" }}>{L.myIdeas}</p>
            <div className="flex items-baseline gap-3">
              <Link href="/content/new" onClick={() => triggerPekoBlink()} className="text-xs font-bold btn-hover" style={{ color: "#B07A1A" }}>
                + {L.newContent}
              </Link>
              <Link href="/content" onClick={() => triggerPekoBlink()} className="text-xs font-medium" style={{ color: "#1F7A6E" }}>
                {L.viewAll}
              </Link>
            </div>
          </div>

          {totalIdeas === 0 ? (
            <p className="text-sm mt-2 measure" style={{ color: "#6B6258" }}>{L.noIdeas}</p>
          ) : (
            <>
              <p className="flex items-baseline gap-2">
                <span className="text-3xl font-bold anim-pop tabular-nums" style={{ color: "#1C1C1C", animationDelay: "180ms" }}>
                  {totalIdeas}
                </span>
                <span className="text-xs" style={{ color: "#6B6258" }}>
                  {L.ideasTotal}
                  {totalIdeas > inPipeline ? ` · ${totalIdeas - inPipeline} ${L.notSent}` : ""}
                </span>
              </p>

              {/* The bar is the picture; the legend below carries the numbers
                  for anyone who cannot see the colours. */}
              {inPipeline > 0 && (
                <div aria-hidden className="flex gap-[3px] h-2.5 mt-3 rounded-full overflow-hidden anim-bar">
                  {pipelineCounts.filter((c) => c.count > 0).map(({ status, count }) => (
                    <span
                      key={status}
                      title={`${CONTENT_STATUS_LABEL[status][locale]}: ${count}`}
                      className="h-full"
                      style={{
                        flexGrow: count,
                        flexBasis: 0,
                        minWidth: 6,
                        backgroundColor: CONTENT_STATUS_COLOR[status].bg,
                        // Blush against warm-white is too faint to read as a
                        // segment on its own; a hairline of its own hue fixes it.
                        boxShadow: status === "submitted" ? "inset 0 0 0 1px rgba(140,48,16,0.22)" : undefined,
                      }}
                    />
                  ))}
                </div>
              )}

              <ul aria-label={L.pipelineLabel} className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                {pipelineCounts.map(({ status, count }) => {
                  const on = count > 0;
                  return (
                    <li key={status} className="flex items-center gap-1.5 text-xs" style={{ color: on ? "#1C1C1C" : "#A0968A" }}>
                      <span
                        aria-hidden
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          // An empty state keeps its place in the legend but
                          // loses its colour, so the eye lands only on what is there.
                          backgroundColor: on ? CONTENT_STATUS_COLOR[status].bg : "transparent",
                          boxShadow: on
                            ? status === "submitted" ? "inset 0 0 0 1px rgba(140,48,16,0.3)" : undefined
                            : "inset 0 0 0 1.5px #D8CEC1",
                        }}
                      />
                      <span>{CONTENT_STATUS_LABEL[status][locale]}</span>
                      <span className="font-bold tabular-nums">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid md:grid-cols-2 gap-6 anim-in" style={{ "--i": 3 } as React.CSSProperties}>
        {/* Recent point activity */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold" style={{ color: "#1C1C1C" }}>{L.recentActivity}</h2>
            <Link href="/points" onClick={() => triggerPekoBlink()} className="text-xs font-medium" style={{ color: "#1F7A6E" }}>{L.viewAll}</Link>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-koco" style={{ backgroundColor: "#FDFAF3" }}>
            {points.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "#6B6258" }}>{L.noActivity}</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "#EFE6D9" }}>
                {points.slice(0, 6).map((p, i) => (
                  <div key={i} className="flex items-start justify-between px-4 py-3">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium truncate" style={{ color: "#1C1C1C" }}>
                        {p.criteria?.category ?? "—"}
                      </p>
                      {p.notes && (
                        <p className="text-xs truncate" style={{ color: "#6B6258" }}>{p.notes}</p>
                      )}
                      <p className="text-xs mt-0.5" style={{ color: "#6B6258" }}>{p.date ?? "—"}</p>
                    </div>
                    <span className="text-sm font-bold shrink-0" style={{ color: "#6E7A00" }}>
                      +{p.points_earned} {L.pts}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Upcoming events */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold" style={{ color: "#1C1C1C" }}>{L.upcoming}</h2>
            <Link href="/events" onClick={() => triggerPekoBlink()} className="text-xs font-medium" style={{ color: "#1F7A6E" }}>{L.viewAll}</Link>
          </div>
          <div className="space-y-3">
            {upcomingEvents.length === 0 ? (
              <div className="rounded-2xl text-center py-8 shadow-koco" style={{ backgroundColor: "#FDFAF3" }}>
                <p className="text-sm" style={{ color: "#6B6258" }}>{L.noEvents}</p>
              </div>
            ) : (
              upcomingEvents.map((ev) => (
                <div key={ev.id} className="rounded-2xl px-4 py-3 shadow-koco" style={{ backgroundColor: "#FDFAF3" }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: "#1C1C1C" }}>{ev.name}</p>
                    <span
                      className="label-style px-2 py-0.5 rounded-full shrink-0 text-xs"
                      style={{
                        backgroundColor: ev.registration_status === "open" ? "rgba(56,179,158,0.12)" : "rgba(0,0,0,0.06)",
                        color: ev.registration_status === "open" ? "#1F7A6E" : "#6B6258",
                      }}
                    >
                      {ev.registration_status === "open" ? L.open : L.closed}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#6B6258" }}>
                    {ev.event_date_start}{ev.event_date_end ? ` – ${ev.event_date_end}` : ""}
                    {ev.place ? ` · ${ev.place}` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

    </div>
  );
}
