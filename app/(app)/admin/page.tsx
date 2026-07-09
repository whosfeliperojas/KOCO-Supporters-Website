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

  const [postsRes, usersRes, pointsRes, eventsRes] = await Promise.all([
    supabase.from("content_posts").select("status").in("status", ["submitted", "in_review"]),
    supabase.from("profiles").select("id").eq("active", true),
    supabase
      .from("point_log_entries")
      .select("id")
      .gte("date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]),
    supabase
      .from("events")
      .select("id")
      .gte("event_date_start", new Date().toISOString().split("T")[0]),
  ]);

  const locale = profile.locale;
  const L = (es: string, en: string, ko: string) => locale === "es" ? es : locale === "ko" ? ko : en;

  const cards = [
    { href: "/admin/content", title: L("Cola de revisión", "Review queue", "검토 대기"),        value: postsRes.data?.length ?? 0,  desc: L("contenidos pendientes", "pending posts", "대기 중인 콘텐츠"), accent: "#ECA040" },
    { href: "/admin/users",   title: L("Voluntarios", "Volunteers", "서포터즈"),                value: usersRes.data?.length ?? 0,  desc: L("perfiles activos", "active profiles", "활동 중인 멤버"),      accent: "#38B39E" },
    { href: "/admin/points",  title: L("Puntos este mes", "Points this month", "이번 달 포인트"), value: pointsRes.data?.length ?? 0, desc: L("entradas registradas", "entries logged", "등록된 내역"),      accent: "#CDD909" },
    { href: "/admin/events",  title: L("Eventos próximos", "Upcoming events", "예정된 행사"),    value: eventsRes.data?.length ?? 0, desc: L("eventos por venir", "events coming up", "다가오는 행사"),     accent: "#E2693E" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold anim-in" style={{ color: "#1C1C1C" }}>
        {L("Administración", "Administration", "관리")}
      </h1>
      <div className="grid md:grid-cols-2 gap-4">
        {cards.map((card, i) => (
          <Link key={card.href} href={card.href} className="rounded-2xl p-5 shadow-koco flex flex-col card-hover anim-in" style={{ backgroundColor: "#F8F0DE", "--i": i + 1 } as React.CSSProperties}>
            <p className="text-sm font-bold mb-1" style={{ color: "#1C1C1C" }}>{card.title}</p>
            <p className="text-4xl font-bold" style={{ color: card.accent }}>{card.value}</p>
            <p className="text-xs mt-1" style={{ color: "#888" }}>{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
