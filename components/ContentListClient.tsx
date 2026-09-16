"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/locale-context";
import { useScrollRestoration } from "@/lib/use-scroll-restoration";
import { DATE_LOCALE, CONTENT_STATUS_LABEL as STATUS_LABEL } from "@/lib/i18n";
import { CALENDAR_STATUSES, CONTENT_STATUS_COLOR } from "@/lib/status-colors";
import type { ContentStatus, ContributorMap } from "@/lib/types";
import GlassSelect from "@/components/glass/GlassSelect";
import GlassDatePicker, { capitalizeFirst } from "@/components/glass/GlassDatePicker";

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
  /** Admin list only: the responsible volunteer's KOCO-B / KOCO-R. */
  group_code?: string | null;
  /** Admin list only: the sort fallback for an idea with no publication date. */
  created_at?: string;
  publication_cycle_id: string | null;
  design_url: string | null;
  caption: string | null;
  /** Workbook Responsable said "Colaboraciones" - a team effort. */
  is_collaboration: boolean;
  /** Stamped by a trigger whenever status changes. */
  status_changed_at?: string | null;
  /** When the responsible volunteer last opened it. */
  volunteer_seen_at?: string | null;
};

/**
 * "Bogotá" / "Regional" from the group code the database stores (KOCO-B,
 * KOCO-R). The suffix is what carries the meaning, so a renamed programme
 * still reads correctly; an unrecognised code falls through as itself rather
 * than being silently labelled one of the two.
 */
function groupLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code.endsWith("-B")) return "Bogotá";
  if (code.endsWith("-R")) return "Regional";
  return code;
}

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

/** The least a thing needs to be for the calendar to place and colour it. */
type CalItem = {
  id: string;
  title: string;
  status: ContentStatus;
  publication_date: string | null;
  /** Shown under the title in a read-only day list - who the idea belongs to. */
  subtitle?: string | null;
};

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

/**
 * One filter dropdown. `all` is the label for the empty value - naming what
 * the unfiltered view contains ("Whole team", "Bogotá and regional") rather
 * than saying "All", so the bar reads as a sentence about the current view
 * even when nothing is selected. Hidden when there is nothing to choose
 * between, so a filter never offers a single option.
 */
function FilterSelect({
  value, onChange, label, all, options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  all: string;
  options: { value: string; label: string }[];
}) {
  if (options.length < 2) return null;
  return (
    <GlassSelect
      variant="pill"
      ariaLabel={label}
      value={value}
      onChange={onChange}
      active={!!value}
      options={[{ value: "", label: all }, ...options]}
    />
  );
}

/**
 * A two-way sliding switch. Module-level on purpose: declared inside the
 * list component it would be a new component type on every render, and React
 * would tear it down and rebuild it on each click.
 */
function Segmented<V extends string>({
  value, onChange, options, ariaLabel, tone,
}: {
  value: V;
  onChange: (v: V) => void;
  options: readonly [{ value: V; label: string }, { value: V; label: string }];
  ariaLabel: string;
  /** teal = which list, amber = how it is drawn. Two jobs, two colours. */
  tone: "teal" | "amber";
}) {
  const fill = tone === "teal" ? "#38B39E" : "#ECA040";
  const track = tone === "teal" ? "rgba(56,179,158,0.10)" : "rgba(236,160,64,0.12)";
  const idle = tone === "teal" ? "#1F7A6E" : "#B07A1A";
  const on = options[1].value === value;
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="relative grid grid-cols-2 rounded-full p-1 w-full sm:w-48 shrink-0" style={{ backgroundColor: track }}>
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-full"
        style={{
          width: "calc((100% - 8px) / 2)",
          left: 4,
          transform: `translateX(${on ? "100%" : "0%"})`,
          backgroundColor: fill,
          transition: "transform 200ms var(--ease-out-quart)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className="relative z-10 py-1.5 text-xs sm:text-sm font-bold rounded-full text-center transition-colors"
          style={{ color: value === o.value ? "#FFFFFF" : idle, transitionDuration: "200ms" }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function responsibleName(p: Post) {
  if (!p.responsible) return null;
  return Array.isArray(p.responsible) ? p.responsible[0]?.full_name : p.responsible.full_name;
}

export default function ContentListClient({
  posts,
  cycles,
  contributors,
  viewerId,
  isAdmin,
  locale: initialLocale,
}: {
  posts: Post[];
  cycles: { id: string; label: string | null; cycle_number: number; final_deadline: string | null }[];
  /** post id -> everyone credited on it. Empty when the lookup failed. */
  contributors: ContributorMap;
  /** The signed-in profile, to tell "I led this" from "I helped on this". */
  viewerId: string;
  isAdmin: boolean;
  locale: "es" | "en" | "ko";
}) {
  const { locale } = useLocale();
  const router = useRouter();
  // Two independent controls: `tab` is WHICH list, `view` is HOW it is drawn.
  // Neither touches the other - picking Equipo leaves the list/calendar switch
  // exactly where it was, and picking Calendario does not change the list.
  // They were briefly stored per list, which meant switching list also moved
  // the list/calendar switch on its own; that is what made the two buttons
  // feel wired together.
  const [tab, setTab] = useState<"mine" | "team">("mine");
  const [view, setView_] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [savingDateId, setSavingDateId] = useState<string | null>(null);
  /** The post whose date change was refused, so the message lands on its card. */
  const [dateError, setDateError] = useState<string | null>(null);

  // Four filters over the list, each an empty string when off. They are
  // deliberately plain <select>s rather than a filter panel: with ~90 ideas the
  // question is almost always a single one ("what is David's still waiting on
  // me?"), and one row of dropdowns answers it without opening anything.
  const [fStatus, setFStatus] = useState("");
  const [fVolunteer, setFVolunteer] = useState("");
  const [fGroup, setFGroup] = useState("");
  const [fFormat, setFFormat] = useState("");
  const filtersOn = !!(fStatus || fVolunteer || fGroup || fFormat);

  function clearFilters() {
    setFStatus(""); setFVolunteer(""); setFGroup(""); setFFormat("");
  }

  // Options come from the posts actually on screen, not a hardcoded list, so a
  // format or a volunteer that no longer appears never offers an empty filter.
  const uniq = (xs: (string | null | undefined)[]) =>
    [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
  const statusOptions = uniq(posts.map((p) => p.status)) as ContentStatus[];
  const volunteerOptions = uniq(posts.map(responsibleName));
  const groupOptions = uniq(posts.map((p) => p.group_code));
  const formatOptions = uniq(posts.map((p) => p.format));

  // Filters narrow the admin review list and the volunteers' team list. A
  // volunteer's own ideas are a short list they already know by heart, so
  // that one stays unfiltered.
  const shownPosts = isAdmin
    ? posts.filter(
        (p) =>
          (!fStatus || p.status === fStatus) &&
          (!fVolunteer || responsibleName(p) === fVolunteer) &&
          (!fGroup || p.group_code === fGroup) &&
          (!fFormat || p.format === fFormat),
      )
    : posts;

  const duplicates = findDuplicates(shownPosts);

  // The 12-column row, in one place so the header and the rows can never drift
  // apart. Admins carry two extra columns (who, and which side of the
  // programme); on a phone everything but the title and the status folds away.
  //
  // On a phone the row is two columns - the title takes the space and the
  // status sizes to its own chip. A fixed 3-of-12 status cell used to clip
  // longer states ("EN PROGRES…") off the right edge.
  const ROW = "grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-12 gap-x-3";
  const COL = isAdmin
    ? { title: "md:col-span-3", who: "md:col-span-2", zone: "md:col-span-1", format: "md:col-span-2", date: "md:col-span-2", status: "md:col-span-2" }
    : { title: "md:col-span-6", who: "", zone: "", format: "md:col-span-2", date: "md:col-span-2", status: "md:col-span-2" };

  function cycleLabel(cycleId: string | null) {
    if (!cycleId) return null;
    return cycles.find((c) => c.id === cycleId)?.label ?? null;
  }

  /**
   * The people credited beyond the lead, as one short line. Two names fit;
   * beyond that the row would wrap, so the rest collapse into "+N" and the
   * full list stays in the title attribute and on the post page.
   */
  function creditLine(postId: string) {
    const others = (contributors[postId] ?? []).filter((c) => c.role !== "lead");
    if (others.length === 0) return null;
    const names = others.map((c) => c.name);
    const shown = names.slice(0, 2).join(", ");
    return {
      short: names.length > 2 ? `${shown} +${names.length - 2}` : shown,
      full: names.join(", "),
    };
  }

  /** A post the viewer helped on but does not lead. Volunteers only. */
  function isCollaboration(post: Post) {
    if (isAdmin) return false;
    const mine = (contributors[post.id] ?? []).find((c) => c.profile_id === viewerId);
    return !!mine && mine.role !== "lead";
  }

  // Shared team view (volunteers): safe subset of everyone's ideas via RPC
  const [teamIdeas, setTeamIdeas] = useState<SharedIdea[] | null>(null);
  const [teamStatus, setTeamStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");

  // Come back to the row you opened, not to the top of ~90 of them. Keyed by
  // the exact list on screen so switching grid or tab does not restore an
  // offset measured against a different set of rows.
  // Team-list filters, separate from the admin ones above.
  const [tStatus, setTStatus] = useState("");
  const [tOwner, setTOwner] = useState("");
  const [tFormat, setTFormat] = useState("");
  const teamFiltersOn = !!(tStatus || tOwner || tFormat);

  function clearTeamFilters() {
    setTStatus(""); setTOwner(""); setTFormat("");
  }

  // Newest first, same rule as every other content list: by publication date,
  // or by creation for an idea that has no date yet.
  const teamSorted = [...(teamIdeas ?? [])].sort((a, b) =>
    (b.publication_date ?? b.created_at).localeCompare(a.publication_date ?? a.created_at),
  );
  const teamShown = teamSorted.filter(
    (i) =>
      (!tStatus || i.status === tStatus) &&
      (!tOwner || i.owner_name === tOwner) &&
      (!tFormat || i.format === tFormat),
  );

  const scrollFilters = isAdmin
    ? `${fStatus}|${fVolunteer}|${fGroup}|${fFormat}`
    : tab === "team" ? `${tStatus}|${tOwner}|${tFormat}` : "";
  useScrollRestoration(`${isAdmin ? "admin-content" : `content:${tab}`}:${view}:${scrollFilters}`);

  function setView(v: "list" | "calendar") {
    setView_(v);
    // The selected day belonged to the calendar being left behind.
    setSelectedDay(null);
  }

  function switchTab(t: "mine" | "team") {
    setTab(t);
    // Same day number means a different set of ideas on the other list.
    setSelectedDay(null);
    if (t === "team") loadTeam();
  }

  async function loadTeam() {
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
      list: "Lista", calendar: "Calendario", prev: "Ant", next: "Sig",
      dupBadge: "Duplicado?", dupTitle: "Posible duplicado de",
      volunteer: "Voluntario/a", zone: "Zona", allStatus: "Todos los estados",
      allVolunteers: "Todo el equipo", allZones: "Bogotá y regional", allFormats: "Todos los formatos",
      clear: "Limpiar filtros", showing: "Mostrando", of: "de",
      scheduledOnly: "El calendario muestra solo los contenidos aprobados y publicados.",
      noMatches: "Ninguna idea coincide con estos filtros.", views: "Vista", lists: "Lista de ideas",
      more: "más",
      noPosts: "Sin publicaciones este día", changeDate: "Cambiar fecha", open: "Abrir",
      dateFailed: "No se pudo cambiar la fecha. Inténtalo de nuevo.",
      unscheduled: "Sin fecha programada",
      withCollab: "con", collabBadge: "Colaboración", collabTeam: "Colaboraciones",
      collabHint: "Participaste en este contenido; lo lidera otra persona.",
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
      list: "List", calendar: "Calendar", prev: "Prev", next: "Next",
      dupBadge: "Duplicate?", dupTitle: "Possible duplicate of",
      volunteer: "Volunteer", zone: "Zone", allStatus: "All statuses",
      allVolunteers: "Whole team", allZones: "Bogotá and regional", allFormats: "All formats",
      clear: "Clear filters", showing: "Showing", of: "of",
      scheduledOnly: "The calendar shows approved and published content only.",
      noMatches: "No ideas match these filters.", views: "View", lists: "Idea list",
      more: "more",
      noPosts: "Nothing scheduled this day", changeDate: "Change date", open: "Open",
      dateFailed: "Couldn’t change the date. Try again.",
      unscheduled: "No date scheduled",
      withCollab: "with", collabBadge: "Collaboration", collabTeam: "Colaboraciones",
      collabHint: "You worked on this one; someone else leads it.",
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
      list: "목록", calendar: "캘린더", prev: "이전", next: "다음",
      dupBadge: "중복?", dupTitle: "중복 가능성",
      volunteer: "담당자", zone: "지역", allStatus: "모든 상태",
      allVolunteers: "전체 팀", allZones: "보고타 · 지방 전체", allFormats: "모든 포맷",
      clear: "필터 지우기", showing: "표시", of: "/",
      scheduledOnly: "캘린더에는 승인 및 게시된 콘텐츠만 표시돼요.",
      noMatches: "조건에 맞는 아이디어가 없어요.", views: "보기", lists: "아이디어 목록",
      more: "개 더",
      noPosts: "이 날짜에는 게시물이 없어요", changeDate: "날짜 변경", open: "열기",
      dateFailed: "날짜를 변경하지 못했어요. 다시 시도해 주세요.",
      unscheduled: "게시일 미정",
      withCollab: "함께", collabBadge: "협업", collabTeam: "Colaboraciones",
      collabHint: "담당자는 다른 사람이지만 함께 참여한 콘텐츠예요.",
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
    setDateError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("content_posts")
      .update({ publication_date: newDate || null })
      .eq("id", postId);
    setSavingDateId(null);
    if (error) {
      // The result was discarded, so a write the database refused still
      // refreshed the router and read as a successful reschedule.
      console.error("publication_date update failed:", error);
      setDateError(postId);
      return;
    }
    router.refresh();
  }

  // ── Calendar ──────────────────────────────────────────────────────
  /**
   * The publication calendar. Three callers, one grid:
   *  - an admin scheduling the programme,
   *  - a volunteer looking at their own ideas,
   *  - the team view, where it is a read-only guide to the posting cycle -
   *    what the group is putting out and when, so nobody aims an idea at a
   *    day that is already full.
   *
   * `readOnly` drops the date pickers and the unscheduled list: neither means
   * anything when the items on screen belong to other people.
   */
  // Called as a function, never as <Component/>: a component declared inside
  // this one is a brand-new type on every render, so React threw the whole
  // calendar away and rebuilt it on every click - replaying its entrance
  // animation and resetting the date pickers inside it. That rebuild was the
  // "broken" feeling when choosing a day.
  function renderCalendar({
    items,
    readOnly = false,
  }: {
    items: CalItem[];
    readOnly?: boolean;
  }) {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const cells = buildCalendarDays(year, month);
    const monthLabel = capitalizeFirst(calMonth.toLocaleDateString(DATE_LOCALE[locale], { month: "long", year: "numeric" }));
    const todayStr = new Date().toISOString().split("T")[0];

    // What "scheduled" means here: a decision has been taken and the day is
    // real. A rejected idea keeps whatever date it was proposed for, so left
    // in, it would sit on the calendar looking like something the team is
    // about to publish. Everything still in the pipeline lives in the list
    // view; this view answers one question - what is going out, and when.
    const scheduled = items.filter((p) => CALENDAR_STATUSES.includes(p.status));

    function postsOnDay(day: number) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return scheduled.filter((p) => p.publication_date === dateStr);
    }

    const selectedPosts = selectedDay ? postsOnDay(selectedDay) : [];
    const unscheduled = readOnly
      ? []
      : items.filter((p) => !p.publication_date && CALENDAR_STATUSES.includes(p.status));

    /** The full post behind a calendar entry, when this list is the viewer's own. */
    const fullPost = (id: string) => posts.find((p) => p.id === id);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { setCalMonth(new Date(year, month - 1, 1)); setSelectedDay(null); }} className="p-2 rounded-lg btn-hover text-sm font-bold" style={{ color: "#8A5A00" }}>
            ‹ {L.prev}
          </button>
          <h2 className="text-base font-bold" style={{ color: "#1C1C1C" }}>{monthLabel}</h2>
          <button onClick={() => { setCalMonth(new Date(year, month + 1, 1)); setSelectedDay(null); }} className="p-2 rounded-lg btn-hover text-sm font-bold" style={{ color: "#8A5A00" }}>
            {L.next} ›
          </button>
        </div>

        <div key={`${year}-${month}`} className="rounded-2xl overflow-hidden shadow-koco anim-in" style={{ backgroundColor: "#FDFAF3" }}>
          <div className="grid grid-cols-7" style={{ backgroundColor: "#ECA040" }}>
            {L.weekDays.map((d) => <div key={d} className="py-2 text-center text-xs font-bold" style={{ color: "#4A2C00" }}>{d}</div>)}
          </div>
          {/* A day square big enough to read. The old 56px cell could only fit
              coloured dots, which told an admin that something was scheduled
              but never what - so planning still meant clicking every day in
              turn. At this size two or three titles fit outright. */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="min-h-[76px] sm:min-h-[116px]" style={{ backgroundColor: "rgba(0,0,0,0.02)" }} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayPosts = postsOnDay(day);
              const isToday = dateStr === todayStr;
              const isSelected = selectedDay === day;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className="min-h-[76px] sm:min-h-[116px] p-1 sm:p-1.5 flex flex-col items-stretch gap-1 text-left transition-colors align-top"
                  style={{
                    backgroundColor: isSelected ? "rgba(236,160,64,0.15)" : isToday ? "rgba(56,179,158,0.08)" : "transparent",
                    borderRight: "1px solid #EFE6D9",
                    borderBottom: "1px solid #EFE6D9",
                  }}
                >
                  <span
                    className="text-xs font-bold w-5 h-5 shrink-0 flex items-center justify-center rounded-full"
                    style={{ backgroundColor: isToday ? "#38B39E" : "transparent", color: isToday ? "white" : "#1C1C1C" }}
                  >
                    {day}
                  </span>

                  {/* Titles on anything wide enough to read them... */}
                  <span className="hidden sm:flex flex-col gap-0.5 min-w-0">
                    {dayPosts.slice(0, 3).map((p) => {
                      const c = CONTENT_STATUS_COLOR[p.status];
                      return (
                        <span
                          key={p.id}
                          title={`${p.title} — ${STATUS_LABEL[p.status][locale]}`}
                          className="block truncate rounded px-1 py-0.5 text-[10px] font-bold leading-tight"
                          style={{ backgroundColor: c.bg, color: c.fg }}
                        >
                          {p.title}
                        </span>
                      );
                    })}
                    {dayPosts.length > 3 && (
                      <span className="text-[10px] font-bold pl-1" style={{ color: "#6B6258" }}>
                        +{dayPosts.length - 3} {L.more}
                      </span>
                    )}
                  </span>

                  {/* ...and dots on a phone, where a title would just be "Ac…". */}
                  {dayPosts.length > 0 && (
                    <span className="flex sm:hidden gap-0.5 flex-wrap">
                      {dayPosts.slice(0, 4).map((p) => (
                        <span key={p.id} className="block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CONTENT_STATUS_COLOR[p.status].bg }} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs measure" style={{ color: "#6B6258" }}>{L.scheduledOnly}</p>

        {/* Selected day */}
        {selectedDay && (
          <div key={selectedDay} className="space-y-2 anim-in">
            {selectedPosts.length === 0 ? (
              <p className="text-sm text-center py-3" style={{ color: "#6B6258" }}>{L.noPosts}</p>
            ) : readOnly ? (
              <div className="rounded-2xl overflow-hidden shadow-koco divide-y" style={{ backgroundColor: "#FDFAF3", borderColor: "#EFE6D9" }}>
                {selectedPosts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "#1C1C1C" }}>{p.title}</p>
                      {p.subtitle && <p className="text-xs truncate" style={{ color: "#6B6258" }}>{p.subtitle}</p>}
                    </div>
                    <StatusChip status={p.status} />
                  </div>
                ))}
              </div>
            ) : (
              selectedPosts.map((p, i) => {
                const full = fullPost(p.id);
                return full ? renderPostCard(full, i) : null;
              })
            )}
          </div>
        )}

        {/* Unscheduled posts */}
        {unscheduled.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#6B6258" }}>{L.unscheduled} ({unscheduled.length})</p>
            {unscheduled.map((p, i) => {
              const full = fullPost(p.id);
              return full ? renderPostCard(full, i) : null;
            })}
          </div>
        )}
      </div>
    );
  }

  function renderPostCard(post: Post, i: number) {
    const name = responsibleName(post);
    const credit = creditLine(post.id);
    return (
      <div key={post.id} className="rounded-2xl p-4 shadow-koco anim-in" style={{ backgroundColor: "#FFFFFF", "--i": Math.min(i, 8) } as React.CSSProperties}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: "#1C1C1C" }}>{post.title}</p>
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: "#6B6258" }}
              title={credit ? `${L.withCollab} ${credit.full}` : undefined}
            >
              {[
                post.channel,
                post.format,
                name ? `${L.by} ${name}` : null,
                credit ? `${L.withCollab} ${credit.short}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <StatusChip status={post.status} />
        </div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className="flex items-center gap-2 text-xs" style={{ color: "#555" }}>
            {L.changeDate}:
            <GlassDatePicker
              variant="compact"
              ariaLabel={L.changeDate}
              value={post.publication_date ?? ""}
              onChange={(v) => updateDate(post.id, v)}
              disabled={savingDateId === post.id}
            />
          </span>
          <Link href={`/content/${post.id}`} className="text-xs font-bold underline" style={{ color: "#1F7A6E" }}>
            {L.open} →
          </Link>
        </div>
        {dateError === post.id && (
          <p role="alert" className="text-xs font-medium mt-2" style={{ color: "#8C3010" }}>{L.dateFailed}</p>
        )}
      </div>
    );
  }

  /** A quiet card for loading, empty and error states. */
  function stateCard(text: string) {
    return (
      <div className="rounded-2xl text-center py-10 shadow-koco anim-in" style={{ backgroundColor: "#FDFAF3" }}>
        <p className="text-sm" style={{ color: "#6B6258" }}>{text}</p>
      </div>
    );
  }

  /** The whole team's ideas - read-only, filterable, as a list or a calendar. */
  function renderTeam() {
    if (teamStatus === "loading" || teamStatus === "idle") return stateCard(L.loading);
    if (teamStatus === "error") return stateCard(L.teamUnavailable);
    if (teamSorted.length === 0) return stateCard(L.teamEmpty);

    if (view === "calendar") {
      return renderCalendar({
        items: teamShown.map((i) => ({
          id: i.id,
          title: i.title,
          status: i.status,
          publication_date: i.publication_date,
          subtitle: [i.owner_name, i.format].filter(Boolean).join(" · "),
        })),
        readOnly: true,
      });
    }

    if (teamShown.length === 0) return stateCard(L.noMatches);

    return (
      <div className="rounded-2xl overflow-hidden shadow-koco anim-in" style={{ backgroundColor: "#FDFAF3" }}>
        <div
          className={`${ROW} px-4 py-2 text-xs font-bold uppercase tracking-wider sticky top-0 z-10`}
          style={{ backgroundColor: "#ECA040", color: "#4A2C00" }}
        >
          <span className="md:col-span-6">{L.colTitle}</span>
          <span className="md:col-span-2 hidden md:block">{L.format}</span>
          <span className="md:col-span-2 hidden md:block">{L.pubDate}</span>
          <span className="md:col-span-2 text-right md:text-left">{L.status}</span>
        </div>
        <div className="divide-y" style={{ borderColor: "#EFE6D9" }}>
          {teamShown.map((idea, i) => (
            <div
              key={idea.id}
              className={`${ROW} px-4 py-3 items-center`}
              style={{ backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#FDFAF3" }}
            >
              <div className="md:col-span-6 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "#1C1C1C" }}>{idea.title}</p>
                <p className="text-xs truncate" style={{ color: "#6B6258" }}>
                  {[idea.owner_name, idea.channel].filter(Boolean).join(" · ")}
                  <span className="md:hidden">{idea.format ? ` · ${idea.format}` : ""}</span>
                </p>
              </div>
              <span className="md:col-span-2 text-xs truncate hidden md:block" style={{ color: "#6B6258" }}>{idea.format ?? "—"}</span>
              <span className="md:col-span-2 text-xs hidden md:block" style={{ color: "#6B6258" }}>{idea.publication_date ?? "—"}</span>
              <div className="md:col-span-2 justify-self-end md:justify-self-auto"><StatusChip status={idea.status} /></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const teamStatusOptions = uniq(teamSorted.map((i) => i.status)) as ContentStatus[];
  const teamOwnerOptions = uniq(teamSorted.map((i) => i.owner_name));
  const teamFormatOptions = uniq(teamSorted.map((i) => i.format));

  // ── Render ────────────────────────────────────────────────────────
  //
  // Three rows, read top to bottom the way the page is used:
  //   1. what this page is, and the one thing you can create here;
  //   2. WHICH list (left, teal) and HOW to draw it (right, amber) - two
  //      different questions, so two controls in two colours rather than a
  //      cluster of look-alike pills;
  //   3. only where a list is long enough to need it, the filters for it.
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 anim-in" style={{ "--i": 0 } as React.CSSProperties}>
        <h1 className="text-2xl font-bold" style={{ color: "#1C1C1C" }}>
          {isAdmin ? L.adminTitle : L.title}
        </h1>
        {!isAdmin && (
          <Link
            href="/content/new"
            className="text-sm font-bold px-4 py-2 rounded-lg text-white btn-hover whitespace-nowrap"
            style={{ backgroundColor: "#ECA040" }}
          >
            {L.newPost}
          </Link>
        )}
      </div>

      <div
        className={isAdmin
          ? "flex flex-wrap items-center justify-between gap-3 anim-in"
          : "grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between sm:gap-3 anim-in"}
        style={{ "--i": 1 } as React.CSSProperties}
      >
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect value={fStatus} onChange={setFStatus} label={L.status} all={L.allStatus}
              options={statusOptions.map((st) => ({ value: st, label: STATUS_LABEL[st][locale] }))} />
            <FilterSelect value={fVolunteer} onChange={setFVolunteer} label={L.volunteer} all={L.allVolunteers}
              options={volunteerOptions.map((v) => ({ value: v, label: v }))} />
            <FilterSelect value={fGroup} onChange={setFGroup} label={L.zone} all={L.allZones}
              options={groupOptions.map((g) => ({ value: g, label: groupLabel(g) ?? g }))} />
            <FilterSelect value={fFormat} onChange={setFFormat} label={L.format} all={L.allFormats}
              options={formatOptions.map((f) => ({ value: f, label: f }))} />
            {filtersOn && (
              <>
                <span className="text-xs font-bold" style={{ color: "#6B6258" }}>
                  {L.showing} {shownPosts.length} {L.of} {posts.length}
                </span>
                <button type="button" onClick={clearFilters} className="text-xs font-bold underline btn-hover" style={{ color: "#1F7A6E" }}>
                  {L.clear}
                </button>
              </>
            )}
          </div>
        ) : (
          <Segmented
            tone="teal"
            ariaLabel={L.lists}
            value={tab}
            onChange={switchTab}
            options={[{ value: "mine", label: L.mine }, { value: "team", label: L.team }] as const}
          />
        )}

        <Segmented
          tone="amber"
          ariaLabel={L.views}
          value={view}
          onChange={setView}
          options={[{ value: "list", label: L.list }, { value: "calendar", label: L.calendar }] as const}
        />
      </div>

      {!isAdmin && tab === "team" && (
        <div className="space-y-3 anim-in" style={{ "--i": 2 } as React.CSSProperties}>
          <p className="text-sm measure" style={{ color: "#6B6258" }}>{L.teamHint}</p>
          {teamStatus === "ready" && teamSorted.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect value={tStatus} onChange={setTStatus} label={L.status} all={L.allStatus}
                options={teamStatusOptions.map((st) => ({ value: st, label: STATUS_LABEL[st][locale] }))} />
              <FilterSelect value={tOwner} onChange={setTOwner} label={L.volunteer} all={L.allVolunteers}
                options={teamOwnerOptions.map((v) => ({ value: v, label: v }))} />
              <FilterSelect value={tFormat} onChange={setTFormat} label={L.format} all={L.allFormats}
                options={teamFormatOptions.map((f) => ({ value: f, label: f }))} />
              {teamFiltersOn && (
                <>
                  <span className="text-xs font-bold" style={{ color: "#6B6258" }}>
                    {L.showing} {teamShown.length} {L.of} {teamSorted.length}
                  </span>
                  <button type="button" onClick={clearTeamFilters} className="text-xs font-bold underline btn-hover" style={{ color: "#1F7A6E" }}>
                    {L.clear}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {!isAdmin && tab === "team" ? (
        renderTeam()
      ) : view === "calendar" ? (
        renderCalendar({ items: shownPosts })
      ) : posts.length === 0 ? (
        <div className="rounded-2xl text-center py-14 shadow-koco anim-in" style={{ backgroundColor: "#FDFAF3", "--i": 1 } as React.CSSProperties}>
          {/* Official brand sticker: Peko already on his way to create */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/art-running.webp" alt="" aria-hidden className="mx-auto mb-3 select-none" style={{ width: 130 }} />
          <p className="text-sm" style={{ color: "#6B6258" }}>{L.noContent}</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden shadow-koco anim-in" style={{ backgroundColor: "#FDFAF3", "--i": 1 } as React.CSSProperties}>
          {/* Header */}
          {/* Sticky: on ~90 rows the column names scroll out of sight within
              one screen, and the eye's run down the left edge loses what it
              is reading. Staying put costs nothing and keeps the scan
              anchored the whole way down. */}
          <div
            className={`${ROW} px-4 py-2 text-xs font-bold uppercase tracking-wider sticky top-0 z-10`}
            style={{ backgroundColor: "#ECA040", color: "#4A2C00" }}
          >
            <span className={COL.title}>{L.colTitle}</span>
            {isAdmin && <span className={`${COL.who} hidden md:block`}>{L.volunteer}</span>}
            {isAdmin && <span className={`${COL.zone} hidden md:block`}>{L.zone}</span>}
            <span className={`${COL.format} hidden md:block`}>{L.format}</span>
            <span className={`${COL.date} hidden md:block`}>{L.pubDate}</span>
            <span className={`${COL.status} text-right md:text-left`}>{L.status}</span>
          </div>

          <div className="divide-y" style={{ borderColor: "#EFE6D9" }}>
            {shownPosts.map((post, i) => {
              const dupOf = duplicates[post.id];
              const cycle = cycleLabel(post.publication_cycle_id);
              const credit = creditLine(post.id);
              const collab = isCollaboration(post);
              return (
                <div
                  key={post.id}
                  className={`${ROW} px-4 py-3 items-center transition-colors row-hover`}
                  style={{ backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#FDFAF3" }}
                >
                  <Link href={`/content/${post.id}`} className={`${COL.title} min-w-0`}>
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
                      {collab && (
                        <span
                          title={L.collabHint}
                          className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ backgroundColor: "rgba(56,179,158,0.15)", color: "#1F7A6E" }}
                        >
                          {L.collabBadge}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs truncate"
                      style={{ color: "#6B6258" }}
                      title={credit ? `${L.withCollab} ${credit.full}` : undefined}
                    >
                      {/* The lead gets its own column on the admin list, so
                          naming it here too would only crowd the subtitle -
                          but that column is hidden on a phone, which is
                          exactly where the name has to be carried inline. */}
                      {isAdmin && post.responsible && (
                        <span className="md:hidden">{L.by} {responsibleName(post)} · </span>
                      )}
                      {[
                        !isAdmin && post.responsible ? `${L.by} ${responsibleName(post)}` : null,
                        credit ? `${L.withCollab} ${credit.short}` : null,
                        // A collaboration the workbook never attributed: say so
                        // rather than leaving the row looking authorless.
                        !post.responsible && !credit && post.is_collaboration ? L.collabTeam : null,
                        post.channel,
                        cycle,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </Link>
                  {isAdmin && (
                    <span className={`${COL.who} text-xs truncate hidden md:block`} style={{ color: "#6B6258" }}>
                      {responsibleName(post) ?? (post.is_collaboration ? L.collabTeam : "—")}
                    </span>
                  )}
                  {isAdmin && (
                    <span className={`${COL.zone} text-xs truncate hidden md:block`} style={{ color: "#6B6258" }}>
                      {groupLabel(post.group_code) ?? "—"}
                    </span>
                  )}
                  <span className={`${COL.format} text-xs truncate hidden md:block`} style={{ color: "#6B6258" }}>
                    {post.format ?? "—"}
                  </span>
                  <span className={`${COL.date} text-xs hidden md:block`} style={{ color: "#6B6258" }}>
                    {post.publication_date ?? "—"}
                  </span>
                  <div className={`${COL.status} justify-self-end md:justify-self-auto`}>
                    <StatusChip status={post.status} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
