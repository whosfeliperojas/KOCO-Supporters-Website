"use client";

import { useLocale } from "@/lib/locale-context";
import { DATE_LOCALE } from "@/lib/i18n";
import { COMPLETION_TARGET_POINTS } from "@/lib/points";

/** Group key for entries whose source sheet left the date blank. */
const UNDATED = "undated";

type Entry = {
  id: string;
  /** NULL when the Points Log did not record a date. */
  date: string | null;
  points_earned: number;
  notes: string | null;
  criteria: { category: string; description_es: string | null; description_en: string | null; type: string } | null;
};

export default function PointsClient({
  entries,
  locale: initialLocale,
  volunteerName,
}: {
  entries: Entry[];
  locale: "es" | "en" | "ko";
  volunteerName: string;
}) {
  const { locale } = useLocale();

  const total = entries.reduce((s, e) => s + e.points_earned, 0);

  // Entries the sheet never dated are grouped separately rather than guessed
  // into a month. They arrive last (the query orders nulls last), so their
  // section renders at the bottom.
  const byMonth: Record<string, Entry[]> = {};
  for (const e of entries) {
    const key = e.date ? e.date.slice(0, 7) : UNDATED; // "2026-05"
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(e);
  }

  const T = {
    es: { title: "Mis puntos", total: "Total acumulado", pts: "pts", noPoints: "Sin puntos registrados aún", criteria: "Criterio", date: "Fecha", earned: "Puntos", notes: "Notas", core: "Core", extra: "Extra", toGo: "Te faltan {n} pts para llegar a 80", undated: "Sin fecha registrada", met: "¡Requisito cumplido! Sigue sumando puntos extra" },
    en: { title: "My points", total: "Total accumulated", pts: "pts", noPoints: "No points recorded yet", criteria: "Criteria", date: "Date", earned: "Points", notes: "Notes", core: "Core", extra: "Extra", toGo: "{n} pts to go to reach 80", undated: "No date recorded", met: "Completion requirement met! Keep earning extra points" },
    ko: { title: "내 포인트", total: "누적 포인트", pts: "점", noPoints: "아직 등록된 포인트가 없어요", criteria: "기준", date: "날짜", earned: "포인트", notes: "메모", core: "Core", extra: "Extra", toGo: "80점까지 {n}점 남았어요", undated: "날짜 미기록", met: "이수 조건을 달성했어요! 추가 포인트는 계속 쌓을 수 있어요" },
  } as const;
  const L = T[locale];

  function monthLabel(key: string) {
    if (key === UNDATED) return L.undated;
    const [year, month] = key.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString(DATE_LOCALE[locale], { month: "long", year: "numeric" });
  }

  function monthTotal(entries: Entry[]) {
    return entries.reduce((s, e) => s + e.points_earned, 0);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 anim-in" style={{ "--i": 0 } as React.CSSProperties}>
        <h1 className="text-2xl font-bold" style={{ color: "#1C1C1C" }}>{L.title}</h1>
        <div className="text-right w-40 shrink-0">
          <p className="label-style" style={{ color: "#888" }}>{L.total}</p>
          <p className="text-4xl font-bold anim-pop" style={{ color: "#CDD909" }}>{total}</p>
          <p className="text-xs mb-1.5" style={{ color: "#888" }}>{L.pts}</p>
          {(() => {
            const met = total >= COMPLETION_TARGET_POINTS;
            const pct = Math.min(100, (total / COMPLETION_TARGET_POINTS) * 100);
            return (
              <>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(0,0,0,0.06)" }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      backgroundColor: met ? "#38B39E" : "#CDD909",
                      transition: "width 400ms var(--ease-out-quart)",
                    }}
                  />
                </div>
                <p className="text-xs mt-1 text-right" style={{ color: met ? "#1F7A6E" : "#888" }}>
                  {met ? L.met : L.toGo.replace("{n}", String(Math.ceil(COMPLETION_TARGET_POINTS - total)))}
                </p>
              </>
            );
          })()}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl text-center py-14 shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
          {/* Official brand sticker: hearts for the points to come */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/art-heart.webp" alt="" aria-hidden className="mx-auto mb-3 select-none" style={{ width: 150 }} />
          <p className="text-sm" style={{ color: "#888" }}>{L.noPoints}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byMonth).map(([month, monthEntries], sectionIdx) => (
            <section key={month} className="anim-in" style={{ "--i": Math.min(sectionIdx + 1, 8) } as React.CSSProperties}>
              {/* Month header */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold capitalize" style={{ color: "#1C1C1C" }}>
                  {monthLabel(month)}
                </h2>
                <span className="text-sm font-bold" style={{ color: "#CDD909" }}>
                  +{monthTotal(monthEntries)} {L.pts}
                </span>
              </div>

              {/* Table */}
              <div className="rounded-2xl overflow-hidden shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
                {/* Header row */}
                <div
                  className="grid grid-cols-12 px-4 py-2 text-xs font-bold uppercase tracking-wider"
                  style={{ backgroundColor: "#ECA040", color: "white" }}
                >
                  <span className="col-span-2">{L.date}</span>
                  <span className="col-span-5">{L.criteria}</span>
                  <span className="col-span-3 hidden md:block">{L.notes}</span>
                  <span className="col-span-2 text-right">{L.earned}</span>
                </div>

                <div className="divide-y" style={{ borderColor: "#E8DCCF" }}>
                  {monthEntries.map((entry, i) => {
                    // Criterion name + its full description = the reason the
                    // points were given (description falls back es ↔ en)
                    const reason = locale === "es"
                      ? (entry.criteria?.description_es ?? entry.criteria?.description_en)
                      : (entry.criteria?.description_en ?? entry.criteria?.description_es);
                    const dateLabel = entry.date
                      ? new Date(entry.date + "T12:00:00").toLocaleDateString(
                          DATE_LOCALE[locale],
                          { day: "numeric", month: "short", year: "numeric" }
                        )
                      : "—";
                    return (
                      <div
                        key={entry.id}
                        className="grid grid-cols-12 px-4 py-3 items-center text-sm"
                        style={{ backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#F8F0DE" }}
                      >
                        <span className="col-span-2 text-xs" style={{ color: "#888" }}>{dateLabel}</span>
                        <div className="col-span-8 md:col-span-5 pr-2">
                          <span className="font-medium" style={{ color: "#1C1C1C" }}>
                            {entry.criteria?.category ?? "—"}
                          </span>
                          {entry.criteria?.type && (
                            <span
                              className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                              style={{
                                backgroundColor: entry.criteria.type === "core" ? "rgba(56,179,158,0.12)" : "rgba(205,217,9,0.12)",
                                color: entry.criteria.type === "core" ? "#38B39E" : "#6E7A00",
                              }}
                            >
                              {entry.criteria.type === "core" ? L.core : L.extra}
                            </span>
                          )}
                          {reason && (
                            <p className="text-xs mt-0.5" style={{ color: "#75695C" }}>{reason}</p>
                          )}
                          {entry.notes && (
                            <p className="text-xs mt-0.5 md:hidden" style={{ color: "#888", fontStyle: "italic" }}>
                              {entry.notes}
                            </p>
                          )}
                        </div>
                        <span className="col-span-3 hidden md:block text-xs" style={{ color: "#888" }}>
                          {entry.notes ?? "—"}
                        </span>
                        <span className="col-span-2 text-right font-bold" style={{ color: "#CDD909" }}>
                          +{entry.points_earned}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
