"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";
import { DATE_LOCALE } from "@/lib/i18n";
import type { ContentStatus } from "@/lib/types";

const STATUS_LABEL: Record<ContentStatus, { es: string; en: string; ko: string }> = {
  draft:        { es: "Borrador",    en: "Draft",       ko: "임시 저장" },
  submitted:    { es: "Enviado",     en: "Submitted",   ko: "제출됨" },
  in_review:    { es: "En revisión", en: "In review",   ko: "검토 중" },
  approved:     { es: "Aprobado",    en: "Approved",    ko: "승인됨" },
  published:    { es: "Publicado",   en: "Published",   ko: "게시됨" },
  rejected:     { es: "Rechazado",   en: "Rejected",    ko: "반려됨" },
  cancelled:    { es: "Cancelado",   en: "Cancelled",   ko: "취소됨" },
  rescheduled:  { es: "Reagendado",  en: "Rescheduled", ko: "일정 변경" },
};

// Calendar dot colors per status (chip palette)
const STATUS_DOT: Record<string, string> = {
  draft: "#ECA040", submitted: "#ECA040", in_review: "#38B39E",
  approved: "#CDD909", published: "#1C1C1C", rejected: "#E2693E",
  cancelled: "#999999", rescheduled: "#CDD909",
};

function StatusChip({ status }: { status: ContentStatus }) {
  const { locale } = useLocale();
  return (
    <span className={`chip-${status} label-style px-3 py-0.5 rounded-full whitespace-nowrap`}>
      {STATUS_LABEL[status][locale]}
    </span>
  );
}

type Post = {
  id: string;
  title: string;
  status: ContentStatus;
  format: string | null;
  channel: string | null;
  publication_date: string | null;
  updated_at: string;
  responsible: { full_name: string } | { full_name: string }[] | null;
  /** Which Parrilla grid the idea belongs to. Maintained in this tab. */
  in_general: boolean;
  in_final: boolean;
  publication_cycle_id: string | null;
  design_url: string | null;
  caption: string | null;
};

type Grid = "general" | "final";

/**
 * Ideas that look like the same post entered twice.
 *
 * Two signals, both seen in the source workbook:
 *  - the same title appearing more than once (one idea scheduled on two dates);
 *  - two differently-named rows on the same publication date carrying an
 *    identical design link or caption — the two grids named the same content
 *    differently ("KOICAST EP 1" vs "KOICAST (Podcast) 1° Episodio.").
 *
 * Returns id -> the title it collides with. Nothing is merged; this only marks.
 */
function findDuplicates(posts: Post[]): Record<string, string> {
  const flat = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const out: Record<string, string> = {};

  const byTitle = new Map<string, Post[]>();
  for (const p of posts) {
    const k = flat(p.title);
    if (!k) continue;
    byTitle.set(k, [...(byTitle.get(k) ?? []), p]);
  }
  for (const group of byTitle.values()) {
    if (group.length < 2) continue;
    for (const p of group) out[p.id] = p.title;
  }

  const dated = posts.filter((p) => p.publication_date);
  for (let i = 0; i < dated.length; i++) {
    for (let j = i + 1; j < dated.length; j++) {
      const a = dated[i], b = dated[j];
      if (a.publication_date !== b.publication_date) continue;
      const sameLink = !!flat(a.design_url) && flat(a.design_url) === flat(b.design_url);
      const sameCaption = !!flat(a.caption) && flat(a.caption) === flat(b.caption);
      if (sameLink || sameCaption) {
        out[a.id] = b.title;
        out[b.id] = a.title;
      }
    }
  }
  return out;
}

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type SharedIdea = {
  id: string;
  title: string;
  format: string | null;
  channel: string | null;
  content_type: string | null;
  status: ContentStatus;
  publication_date: string | null;
  created_at: string;
  owner_name: string;
};

function responsibleName(p: Post) {
  if (!p.responsible) return null;
  return Array.isArray(p.responsible) ? p.responsible[0]?.full_name : p.responsible.full_name;
}

export default function ContentListClient({
  posts,
  cycles,
  isAdmin,
  locale: initialLocale,
}: {
  posts: Post[];
  cycles: { id: string; label: string | null; cycle_number: number; final_deadline: string | null }[];
  isAdmin: boolean;
  locale: "es" | "en" | "ko";
}) {
  const { locale } = useLocale();
  const router = useRouter();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [savingDateId, setSavingDateId] = useState<string | null>(null);
  // Which Parrilla grid the admin list is showing. General is the full
  // pipeline (every idea, any status); final is what actually shipped.
  const [grid, setGrid] = useState<Grid>("general");
  const [savingGridId, setSavingGridId] = useState<string | null>(null);

  // Admins browse one grid at a time; volunteers see their own posts, which
  // have no grid concept.
  const shownPosts = isAdmin
    ? posts.filter((p) => (grid === "final" ? p.in_final : p.in_general))
    : posts;

  const duplicates = findDuplicates(shownPosts);

  function cycleLabel(cycleId: string | null) {
    if (!cycleId) return null;
    return cycles.find((c) => c.id === cycleId)?.label ?? null;
  }

  async function toggleFinal(post: Post) {
    setSavingGridId(post.id);
    const supabase = createClient();
    await supabase
      .from("content_posts")
      .update({ in_final: !post.in_final })
      .eq("id", post.id);
    setSavingGridId(null);
    router.refresh();
  }

  // Shared team view (volunteers): safe subset of everyone's ideas via RPC
  const [volView, setVolView] = useState<"mine" | "team">("mine");
  const [teamIdeas, setTeamIdeas] = useState<SharedIdea[] | null>(null);
  const [teamStatus, setTeamStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");

  async function openTeamView() {
    setVolView("team");
    if (teamStatus === "ready" || teamStatus === "loading") return;
    setTeamStatus("loading");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("list_shared_ideas");
    if (error || !data) {
      setTeamStatus("error");
      return;
    }
    setTeamIdeas(data as SharedIdea[]);
    setTeamStatus("ready");
  }

  const T = {
    es: {
      title: "Contenidos", adminTitle: "Revisión de contenidos", newPost: "+ Nuevo contenido",
      noContent: "Aún no hay contenidos.", colTitle: "Título", format: "Formato",
      status: "Estado", pubDate: "Publicación", by: "por",
      list: "Lista", calendar: "Calendario", prev: "Ant", next: "Sig", grid: "Parrilla", gridGeneral: "General", gridFinal: "Final", inFinal: "En final", addToFinal: "+ Final", addToFinalHint: "Agregar a la parrilla final", removeFromFinalHint: "Quitar de la parrilla final", dupBadge: "Duplicado?", dupTitle: "Posible duplicado de",
      noPosts: "Sin publicaciones este día", changeDate: "Cambiar fecha", open: "Abrir",
      unscheduled: "Sin fecha programada",
      weekDays: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
      mine: "Mis ideas", team: "Equipo",
      teamHint: "Mira lo que están creando tus compañeros/as para no repetir ideas.",
      teamEmpty: "Aún no hay ideas del equipo.",
      teamUnavailable: "La vista de equipo aún no está disponible.",
      loading: "Cargando...",
    },
    en: {
      title: "Content", adminTitle: "Content review", newPost: "+ New post",
      noContent: "No content yet.", colTitle: "Title", format: "Format",
      status: "Status", pubDate: "Pub. date", by: "by",
      list: "List", calendar: "Calendar", prev: "Prev", next: "Next", grid: "Grid", gridGeneral: "General", gridFinal: "Final", inFinal: "In final", addToFinal: "+ Final", addToFinalHint: "Add to the final grid", removeFromFinalHint: "Remove from the final grid", dupBadge: "Duplicate?", dupTitle: "Possible duplicate of",
      noPosts: "Nothing scheduled this day", changeDate: "Change date", open: "Open",
      unscheduled: "No date scheduled",
      weekDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      mine: "My ideas", team: "Team",
      teamHint: "See what your teammates are creating so ideas don't repeat.",
      teamEmpty: "No team ideas yet.",
      teamUnavailable: "The team view isn't available yet.",
      loading: "Loading...",
    },
    ko: {
      title: "콘텐츠", adminTitle: "콘텐츠 검토", newPost: "+ 새 콘텐츠",
      noContent: "아직 콘텐츠가 없어요.", colTitle: "제목", format: "포맷",
      status: "상태", pubDate: "게시일", by: "담당:",
      list: "목록", calendar: "캘린더", prev: "이전", next: "다음", grid: "그리드", gridGeneral: "전체", gridFinal: "최종", inFinal: "최종 포함", addToFinal: "+ 최종", addToFinalHint: "최종 그리드에 추가", removeFromFinalHint: "최종 그리드에서 제외", dupBadge: "중복?", dupTitle: "중복 가능성",
      noPosts: "이 날짜에는 게시물이 없어요", changeDate: "날짜 변경", open: "열기",
      unscheduled: "게시일 미정",
      weekDays: ["일", "월", "화", "수", "목", "금", "토"],
      mine: "내 아이디어", team: "팀",
      teamHint: "친구들이 만들고 있는 콘텐츠를 둘러보고 아이디어가 겹치지 않게 해요.",
      teamEmpty: "아직 팀 아이디어가 없어요.",
      teamUnavailable: "팀 보기는 아직 준비 중이에요.",
      loading: "불러오는 중...",
    },
  } as const;
  const L = T[locale];

  async function updateDate(postId: string, newDate: string) {
    setSavingDateId(postId);
    const supabase = createClient();
    await supabase
      .from("content_posts")
      .update({ publication_date: newDate || null })
      .eq("id", postId);
    setSavingDateId(null);
    router.refresh();
  }

  // ── Calendar view (admin schedule) ────────────────────────────────
  function CalendarView() {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const cells = buildCalendarDays(year, month);
    const monthLabel = calMonth.toLocaleDateString(DATE_LOCALE[locale], { month: "long", year: "numeric" });
    const todayStr = new Date().toISOString().split("T")[0];

    function postsOnDay(day: number) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return posts.filter((p) => p.publication_date === dateStr);
    }

    const selectedPosts = selectedDay ? postsOnDay(selectedDay) : [];
    const unscheduled = posts.filter((p) => !p.publication_date && !["rejected", "cancelled"].includes(p.status));

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { setCalMonth(new Date(year, month - 1, 1)); setSelectedDay(null); }} className="p-2 rounded-lg btn-hover text-sm font-bold" style={{ color: "#ECA040" }}>
            ‹ {L.prev}
          </button>
          <h2 className="text-base font-bold capitalize" style={{ color: "#1C1C1C" }}>{monthLabel}</h2>
          <button onClick={() => { setCalMonth(new Date(year, month + 1, 1)); setSelectedDay(null); }} className="p-2 rounded-lg btn-hover text-sm font-bold" style={{ color: "#ECA040" }}>
            {L.next} ›
          </button>
        </div>

        <div key={`${year}-${month}`} className="rounded-2xl overflow-hidden shadow-koco anim-in" style={{ backgroundColor: "#F8F0DE" }}>
          <div className="grid grid-cols-7" style={{ backgroundColor: "#ECA040" }}>
            {L.weekDays.map((d) => <div key={d} className="py-2 text-center text-xs font-bold text-white">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="h-14" style={{ backgroundColor: "rgba(0,0,0,0.02)" }} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayPosts = postsOnDay(day);
              const isToday = dateStr === todayStr;
              const isSelected = selectedDay === day;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className="h-14 flex flex-col items-center justify-center relative transition-colors"
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
                  {dayPosts.length > 0 && (
                    <span className="flex gap-0.5 mt-1">
                      {dayPosts.slice(0, 4).map((p) => (
                        <span key={p.id} className="block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_DOT[p.status] ?? "#ECA040" }} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day post list with date editing */}
        {selectedDay && (
          <div key={selectedDay} className="space-y-2 anim-in">
            {selectedPosts.length === 0 ? (
              <p className="text-sm text-center py-3" style={{ color: "#888" }}>{L.noPosts}</p>
            ) : (
              selectedPosts.map((p, i) => <PostCard key={p.id} post={p} i={i} />)
            )}
          </div>
        )}

        {/* Unscheduled posts */}
        {unscheduled.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#888" }}>{L.unscheduled} ({unscheduled.length})</p>
            {unscheduled.map((p, i) => <PostCard key={p.id} post={p} i={i} />)}
          </div>
        )}
      </div>
    );
  }

  function PostCard({ post, i }: { post: Post; i: number }) {
    const name = responsibleName(post);
    return (
      <div className="rounded-2xl p-4 shadow-koco anim-in" style={{ backgroundColor: "#FFFFFF", "--i": Math.min(i, 8) } as React.CSSProperties}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: "#1C1C1C" }}>{post.title}</p>
            <p className="text-xs mt-0.5" style={{ color: "#888" }}>
              {[post.channel, post.format, name ? `${L.by} ${name}` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          <StatusChip status={post.status} />
        </div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs" style={{ color: "#555" }}>
            {L.changeDate}:
            <input
              type="date"
              defaultValue={post.publication_date ?? ""}
              onChange={(e) => updateDate(post.id, e.target.value)}
              disabled={savingDateId === post.id}
              className="px-2 py-1 text-xs rounded-lg outline-none"
              style={{ backgroundColor: "#F8F0DE", border: "1.5px solid #DDD0C4", color: "#1C1C1C", opacity: savingDateId === post.id ? 0.5 : 1 }}
            />
          </label>
          <Link href={`/content/${post.id}`} className="text-xs font-bold underline" style={{ color: "#38B39E" }}>
            {L.open} →
          </Link>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between anim-in" style={{ "--i": 0 } as React.CSSProperties}>
        <h1 className="text-2xl font-bold" style={{ color: "#1C1C1C" }}>
          {isAdmin ? L.adminTitle : L.title}
        </h1>

        {isAdmin ? (
          <div className="flex items-center gap-3 flex-wrap">
          {/* Parrilla general / final — list view only */}
          {view === "list" && (
            <div
              role="radiogroup"
              aria-label={`${L.gridGeneral} / ${L.gridFinal}`}
              className="relative grid grid-cols-2 rounded-full p-1 w-52"
              style={{ backgroundColor: "rgba(56,179,158,0.10)" }}
            >
              <span
                aria-hidden
                className="absolute top-1 bottom-1 rounded-full"
                style={{
                  width: "calc((100% - 8px) / 2)",
                  left: 4,
                  transform: `translateX(${grid === "final" ? "100%" : "0%"})`,
                  backgroundColor: "#38B39E",
                  transition: "transform 200ms var(--ease-out-quart)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
                }}
              />
              {(["general", "final"] as const).map((g) => (
                <button
                  key={g}
                  role="radio"
                  aria-checked={grid === g}
                  onClick={() => setGrid(g)}
                  className="relative z-10 py-1.5 text-sm font-bold rounded-full text-center transition-colors"
                  style={{ color: grid === g ? "#FFFFFF" : "#1F7A6E", transitionDuration: "200ms" }}
                >
                  {g === "general" ? L.gridGeneral : L.gridFinal}
                </button>
              ))}
            </div>
          )}

          {/* List / Calendar sliding toggle — admins schedule, they don't create */}
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
        ) : (
          <div className="flex items-center gap-3">
            {/* Mine / Team sliding toggle */}
            <div
              role="radiogroup"
              aria-label={`${L.mine} / ${L.team}`}
              className="relative grid grid-cols-2 rounded-full p-1 w-44"
              style={{ backgroundColor: "rgba(56,179,158,0.10)" }}
            >
              <span
                aria-hidden
                className="absolute top-1 bottom-1 rounded-full"
                style={{
                  width: "calc((100% - 8px) / 2)",
                  left: 4,
                  transform: `translateX(${volView === "team" ? "100%" : "0%"})`,
                  backgroundColor: "#38B39E",
                  transition: "transform 200ms var(--ease-out-quart)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
                }}
              />
              {(["mine", "team"] as const).map((v) => (
                <button
                  key={v}
                  role="radio"
                  aria-checked={volView === v}
                  onClick={() => (v === "team" ? openTeamView() : setVolView("mine"))}
                  className="relative z-10 py-1.5 text-xs font-bold rounded-full text-center transition-colors"
                  style={{ color: volView === v ? "#FFFFFF" : "#38B39E", transitionDuration: "200ms" }}
                >
                  {v === "mine" ? L.mine : L.team}
                </button>
              ))}
            </div>
            <Link
              href="/content/new"
              className="text-sm font-bold px-4 py-2 rounded-lg text-white btn-hover whitespace-nowrap"
              style={{ backgroundColor: "#ECA040" }}
            >
              {L.newPost}
            </Link>
          </div>
        )}
      </div>

      {isAdmin && view === "calendar" ? (
        <CalendarView />
      ) : !isAdmin && volView === "team" ? (
        <div className="space-y-3 anim-in" style={{ "--i": 1 } as React.CSSProperties}>
          <p className="text-sm" style={{ color: "#75695C" }}>{L.teamHint}</p>
          {teamStatus === "loading" || teamStatus === "idle" ? (
            <div className="rounded-2xl text-center py-10 shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
              <p className="text-sm" style={{ color: "#888" }}>{L.loading}</p>
            </div>
          ) : teamStatus === "error" ? (
            <div className="rounded-2xl text-center py-10 shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
              <p className="text-sm" style={{ color: "#888" }}>{L.teamUnavailable}</p>
            </div>
          ) : (teamIdeas ?? []).length === 0 ? (
            <div className="rounded-2xl text-center py-10 shadow-koco" style={{ backgroundColor: "#F8F0DE" }}>
              <p className="text-sm" style={{ color: "#888" }}>{L.teamEmpty}</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden shadow-koco divide-y" style={{ backgroundColor: "#F8F0DE", borderColor: "#E8DCCF" }}>
              {(teamIdeas ?? []).map((idea, i) => (
                <div
                  key={idea.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{ backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#F8F0DE" }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#1C1C1C" }}>{idea.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#888" }}>
                      {idea.owner_name}
                      {idea.format ? ` · ${idea.format}` : ""}
                      {idea.channel ? ` · ${idea.channel}` : ""}
                      {idea.publication_date ? ` · ${idea.publication_date}` : ""}
                    </p>
                  </div>
                  <StatusChip status={idea.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl text-center py-14 shadow-koco anim-in" style={{ backgroundColor: "#F8F0DE", "--i": 1 } as React.CSSProperties}>
          {/* Official brand sticker: Peko already on his way to create */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/art-running.webp" alt="" aria-hidden className="mx-auto mb-3 select-none" style={{ width: 130 }} />
          <p className="text-sm" style={{ color: "#888" }}>{L.noContent}</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden shadow-koco anim-in" style={{ backgroundColor: "#F8F0DE", "--i": 1 } as React.CSSProperties}>
          {/* Header */}
          <div
            className="grid grid-cols-12 px-4 py-2 text-xs font-bold uppercase tracking-wider"
            style={{ backgroundColor: "#ECA040", color: "white" }}
          >
            <span className={isAdmin ? "col-span-4" : "col-span-5"}>{L.colTitle}</span>
            <span className="col-span-2 hidden md:block">{L.format}</span>
            <span className="col-span-2 hidden md:block">{L.pubDate}</span>
            <span className="col-span-3 md:col-span-2">{L.status}</span>
            {isAdmin && <span className="col-span-2 md:col-span-2 text-right">{L.grid}</span>}
          </div>

          <div className="divide-y" style={{ borderColor: "#E8DCCF" }}>
            {shownPosts.map((post, i) => {
              const dupOf = duplicates[post.id];
              const cycle = cycleLabel(post.publication_cycle_id);
              return (
                <div
                  key={post.id}
                  className="grid grid-cols-12 px-4 py-3 items-center transition-colors"
                  style={{ backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#F8F0DE" }}
                >
                  <Link
                    href={`/content/${post.id}`}
                    className={`${isAdmin ? "col-span-4" : "col-span-5"} min-w-0`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "#1C1C1C" }}>
                        {post.title}
                      </p>
                      {dupOf && (
                        <span
                          title={`${L.dupTitle}: ${dupOf}`}
                          className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ backgroundColor: "rgba(226,105,62,0.15)", color: "#8C3010" }}
                        >
                          {L.dupBadge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs truncate" style={{ color: "#6B6258" }}>
                      {[
                        isAdmin && post.responsible ? `${L.by} ${responsibleName(post)}` : null,
                        post.channel,
                        cycle,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </Link>
                  <span className="col-span-2 text-xs hidden md:block" style={{ color: "#6B6258" }}>
                    {post.format ?? "—"}
                  </span>
                  <span className="col-span-2 text-xs hidden md:block" style={{ color: "#6B6258" }}>
                    {post.publication_date ?? "—"}
                  </span>
                  <div className="col-span-3 md:col-span-2">
                    <StatusChip status={post.status} />
                  </div>
                  {isAdmin && (
                    <div className="col-span-2 flex justify-end">
                      <button
                        onClick={() => toggleFinal(post)}
                        disabled={savingGridId === post.id}
                        title={post.in_final ? L.removeFromFinalHint : L.addToFinalHint}
                        className="text-xs font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors"
                        style={{
                          border: "1.5px solid #E8DCCF",
                          backgroundColor: post.in_final ? "rgba(56,179,158,0.12)" : "#F8F0DE",
                          color: post.in_final ? "#1F7A6E" : "#6B6258",
                          opacity: savingGridId === post.id ? 0.6 : 1,
                        }}
                      >
                        {post.in_final ? L.inFinal : L.addToFinal}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
