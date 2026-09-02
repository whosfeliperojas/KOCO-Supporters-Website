"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import Peko, { triggerPekoBlink } from "@/components/Peko";
import type { Profile } from "@/lib/types";

function StatCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="rounded-2xl p-5 shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
      <p className="label-style mb-1" style={{ color: "#888" }}>{label}</p>
      <p className="text-3xl font-bold anim-pop" style={{ color: accent, animationDelay: "180ms" }}>{value}</p>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`chip-${status} label-style px-3 py-0.5 rounded-full text-xs`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function DashboardClient({
  profile,
  points,
  upcomingEvents,
  recentPosts,
  myProposals,
}: {
  profile: Profile;
  points: { points_earned: number; date: string | null; notes: string | null; criteria: { category: string; description_es: string | null; description_en: string | null } | null }[];
  upcomingEvents: { id: string; name: string; event_date_start: string; event_date_end: string | null; place: string | null; registration_status: string }[];
  recentPosts: { id: string; title: string; status: string; publication_date: string | null; format: string | null }[];
  myProposals: { id: string; name: string; event_date_start: string; approval_status: "pending" | "confirmed" | "rejected" }[];
}) {
  const { locale } = useLocale();
  const firstName = profile.display_name ?? profile.full_name.split(" ")[0];
  const totalPoints = points.reduce((s, p) => s + p.points_earned, 0);

  // Idea pipeline at a glance — same chip vocabulary as everywhere else
  const ideaCounts = {
    inReview: recentPosts.filter((p) => p.status === "submitted" || p.status === "in_review").length,
    approved: recentPosts.filter((p) => p.status === "approved" || p.status === "published").length,
    needsFix: recentPosts.filter((p) => p.status === "rejected").length,
  };

  const T = {
    es: {
      greeting: "Hola", totalPoints: "Puntos totales", myIdeas: "Mis ideas",
      inReview: "En revisión", approvedC: "Aprobadas", needsFix: "Por ajustar",
      myProposals: "Mis propuestas de eventos",
      propPending: "Pendiente", propConfirmed: "Confirmado", propRejected: "Rechazado",
      recentActivity: "Actividad reciente", upcoming: "Próximos eventos", myContent: "Mis contenidos",
      viewAll: "Ver todos", noActivity: "Sin actividad aún", noEvents: "Sin eventos próximos",
      pts: "pts", newContent: "Nuevo contenido", open: "Abierto", closed: "Cerrado",
      noContent: "Sin contenidos aún",
    },
    en: {
      greeting: "Hello", totalPoints: "Total points", myIdeas: "My ideas",
      inReview: "In review", approvedC: "Approved", needsFix: "Needs changes",
      myProposals: "My event proposals",
      propPending: "Pending", propConfirmed: "Confirmed", propRejected: "Rejected",
      recentActivity: "Recent activity", upcoming: "Upcoming events", myContent: "My content",
      viewAll: "View all", noActivity: "No activity yet", noEvents: "No upcoming events",
      pts: "pts", newContent: "New post", open: "Open", closed: "Closed",
      noContent: "No content yet",
    },
    ko: {
      greeting: "안녕하세요", totalPoints: "전체 포인트", myIdeas: "내 아이디어",
      inReview: "검토 중", approvedC: "승인됨", needsFix: "수정 필요",
      myProposals: "내 행사 제안",
      propPending: "대기 중", propConfirmed: "확정", propRejected: "반려",
      recentActivity: "최근 활동", upcoming: "다가오는 행사", myContent: "내 콘텐츠",
      viewAll: "전체 보기", noActivity: "아직 활동 내역이 없어요", noEvents: "예정된 행사가 없어요",
      pts: "점", newContent: "새 콘텐츠", open: "모집 중", closed: "마감",
      noContent: "아직 콘텐츠가 없어요",
    },
  } as const;
  const L = T[locale];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Greeting */}
      <div className="flex items-center justify-between gap-4 anim-in" style={{ "--i": 0 } as React.CSSProperties}>
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "#1C1C1C" }}>
            {L.greeting}, {firstName} ✦
          </h1>
          <p className="text-sm mt-1" style={{ color: "#888" }}>
            {profile.group?.name ?? "KOCO Supporters"} · 2026
          </p>
        </div>
        {/* On desktop the sidebar companion greets — Peko appears here only on mobile */}
        <div className="md:hidden shrink-0">
          <Peko pose="wave" size={84} animation="bob" blinkOnEvent />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="anim-in" style={{ "--i": 1 } as React.CSSProperties}>
          <StatCard label={L.totalPoints} value={totalPoints} accent="#CDD909" />
        </div>
        {/* Idea pipeline — same look as the stat card, statuses side by side */}
        <div className="anim-in rounded-2xl p-5 shadow-koco" style={{ backgroundColor: "#F8F0DE", "--i": 2 } as React.CSSProperties}>
          <p className="label-style mb-1" style={{ color: "#888" }}>{L.myIdeas}</p>
          <div className="flex items-end justify-between gap-3">
            {([
              [L.inReview, ideaCounts.inReview, "#ECA040"],
              [L.approvedC, ideaCounts.approved, "#CDD909"],
              [L.needsFix, ideaCounts.needsFix, "#E2693E"],
            ] as const).map(([label, count, accent], i) => (
              <div key={label} className="min-w-0">
                <p
                  className="text-3xl font-bold anim-pop"
                  style={{ color: count > 0 ? accent : "#CFC5B6", animationDelay: `${180 + i * 60}ms` }}
                >
                  {count}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wide truncate" style={{ color: "#888" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* My event proposals — only when there are any */}
      {myProposals.length > 0 && (
        <section className="anim-in rounded-2xl p-5 shadow-koco space-y-2" style={{ backgroundColor: "#F8F0DE", "--i": 2 } as React.CSSProperties}>
          <p className="label-style" style={{ color: "#888" }}>{L.myProposals}</p>
          {myProposals.map((ev) => {
            const st = ev.approval_status;
            const chip = st === "confirmed"
              ? { bg: "rgba(56,179,158,0.14)", color: "#1F7A6E", label: L.propConfirmed }
              : st === "rejected"
              ? { bg: "rgba(226,105,62,0.14)", color: "#B3401E", label: L.propRejected }
              : { bg: "rgba(236,160,64,0.16)", color: "#B07A1A", label: L.propPending };
            return (
              <div key={ev.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#1C1C1C" }}>{ev.name}</p>
                  <p className="text-xs" style={{ color: "#888" }}>{ev.event_date_start}</p>
                </div>
                <span className="label-style px-2.5 py-0.5 rounded-full text-xs shrink-0" style={{ backgroundColor: chip.bg, color: chip.color }}>
                  {chip.label}
                </span>
              </div>
            );
          })}
        </section>
      )}

      {/* Two-column layout */}
      <div className="grid md:grid-cols-2 gap-6 anim-in" style={{ "--i": 3 } as React.CSSProperties}>
        {/* Recent point activity */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold" style={{ color: "#1C1C1C" }}>{L.recentActivity}</h2>
            <Link href="/points" onClick={() => triggerPekoBlink()} className="text-xs font-medium" style={{ color: "#38B39E" }}>{L.viewAll}</Link>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
            {points.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "#888" }}>{L.noActivity}</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "#E8DCCF" }}>
                {points.slice(0, 6).map((p, i) => (
                  <div key={i} className="flex items-start justify-between px-4 py-3">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium truncate" style={{ color: "#1C1C1C" }}>
                        {p.criteria?.category ?? "—"}
                      </p>
                      {p.notes && (
                        <p className="text-xs truncate" style={{ color: "#888" }}>{p.notes}</p>
                      )}
                      <p className="text-xs mt-0.5" style={{ color: "#AAA" }}>{p.date ?? "—"}</p>
                    </div>
                    <span className="text-sm font-bold shrink-0" style={{ color: "#CDD909" }}>
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
            <Link href="/events" onClick={() => triggerPekoBlink()} className="text-xs font-medium" style={{ color: "#38B39E" }}>{L.viewAll}</Link>
          </div>
          <div className="space-y-3">
            {upcomingEvents.length === 0 ? (
              <div className="rounded-2xl text-center py-8 shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
                <p className="text-sm" style={{ color: "#888" }}>{L.noEvents}</p>
              </div>
            ) : (
              upcomingEvents.map((ev) => (
                <div key={ev.id} className="rounded-2xl px-4 py-3 shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: "#1C1C1C" }}>{ev.name}</p>
                    <span
                      className="label-style px-2 py-0.5 rounded-full shrink-0 text-xs"
                      style={{
                        backgroundColor: ev.registration_status === "open" ? "rgba(56,179,158,0.12)" : "rgba(0,0,0,0.06)",
                        color: ev.registration_status === "open" ? "#1F7A6E" : "#888",
                      }}
                    >
                      {ev.registration_status === "open" ? L.open : L.closed}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "#888" }}>
                    {ev.event_date_start}{ev.event_date_end ? ` – ${ev.event_date_end}` : ""}
                    {ev.place ? ` · ${ev.place}` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* My content */}
      <section className="anim-in" style={{ "--i": 4 } as React.CSSProperties}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold" style={{ color: "#1C1C1C" }}>{L.myContent}</h2>
          <Link
            href="/content/new"
            onClick={() => triggerPekoBlink()}
            className="text-xs font-bold px-3 py-1.5 rounded-lg text-white btn-hover"
            style={{ backgroundColor: "#ECA040" }}
          >
            + {L.newContent}
          </Link>
        </div>
        {recentPosts.length === 0 ? (
          <div className="rounded-2xl text-center py-8 shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
            <p className="text-sm" style={{ color: "#888" }}>{L.noContent}</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
            <div className="divide-y" style={{ borderColor: "#E8DCCF" }}>
              {recentPosts.slice(0, 6).map((post) => (
                <Link
                  key={post.id}
                  href={`/content/${post.id}`}
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-koco-blush/30"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium truncate" style={{ color: "#1C1C1C" }}>{post.title}</p>
                    {post.format && (
                      <p className="text-xs" style={{ color: "#888" }}>{post.format}</p>
                    )}
                  </div>
                  <StatusChip status={post.status} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
