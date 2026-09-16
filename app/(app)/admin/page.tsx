import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Profile } from "@/lib/types";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, is_admin, locale")
    .eq("auth_user_id", user.id)
    .single();

  const profile = profileData as Pick<Profile, "id" | "is_admin" | "locale"> | null;
  if (!profile?.is_admin) redirect("/dashboard");

  // Local date, not UTC: toISOString() is UTC, so after 19:00 in Bogotá
  // (UTC-5) "today" became tomorrow and today's events dropped off the count.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const monthStart = today.slice(0, 8) + "01";

  // head + exact count, instead of fetching whole rows only to read .length.
  const [postsRes, usersRes, pointsRes, eventsRes] = await Promise.all([
    supabase.from("content_posts").select("id", { count: "exact", head: true }).in("status", ["submitted", "in_review"]),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("point_log_entries").select("id", { count: "exact", head: true }).gte("date", monthStart),
    supabase.from("events").select("id", { count: "exact", head: true }).gte("event_date_start", today),
  ]);

  const locale = profile.locale;
  const L = (es: string, en: string, ko: string) => locale === "es" ? es : locale === "ko" ? ko : en;

  // A failed query used to render 0, which reads as "nothing to review" - the
  // one message an admin must never be given by mistake. An em-dash says the
  // number is unknown rather than claiming it is zero.
  const n = (res: { count: number | null; error: unknown }) => (res.error ? "—" : res.count ?? 0);

  // Only the queue is accented: it is the one card that asks for an action.
  // Four cards in four brand colours was the interchangeable-stat-grid the
  // product's own anti-references rule out, and lime as text measured 1.5:1.
  const cards = [
    { href: "/admin/content", title: L("Cola de revisión", "Review queue", "검토 대기"),        value: n(postsRes),  desc: L("contenidos pendientes", "pending posts", "대기 중인 콘텐츠"), accent: "#8A5A00" },
    { href: "/admin/users",   title: L("Voluntarios", "Volunteers", "서포터즈"),                value: n(usersRes),  desc: L("perfiles activos", "active profiles", "활동 중인 멤버"),      accent: "#1C1C1C" },
    { href: "/admin/points",  title: L("Puntos este mes", "Points this month", "이번 달 포인트"), value: n(pointsRes), desc: L("entradas registradas", "entries logged", "등록된 내역"),      accent: "#6E7A00" },
    { href: "/admin/events",  title: L("Eventos próximos", "Upcoming events", "예정된 행사"),    value: n(eventsRes), desc: L("eventos por venir", "events coming up", "다가오는 행사"),     accent: "#1C1C1C" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold anim-in" style={{ color: "#1C1C1C" }}>
        {L("Administración", "Administration", "관리")}
      </h1>
      <div className="grid md:grid-cols-2 gap-4">
        {cards.map((card, i) => (
          <Link key={card.href} href={card.href} className="rounded-2xl p-5 shadow-koco flex flex-col card-hover anim-in" style={{ backgroundColor: "#FDFAF3", "--i": i + 1 } as React.CSSProperties}>
            <p className="text-sm font-bold mb-1" style={{ color: "#1C1C1C" }}>{card.title}</p>
            <p className="text-4xl font-bold" style={{ color: card.accent }}>{card.value}</p>
            <p className="text-xs mt-1" style={{ color: "#6B6258" }}>{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
