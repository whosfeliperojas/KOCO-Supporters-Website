import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import type { Profile } from "@/lib/types";

const UNLINKED_T = {
  es: {
    title: "Tu cuenta aún no está vinculada a un perfil",
    body: (email: string) =>
      `Iniciaste sesión correctamente (${email}), pero tu cuenta todavía no tiene un perfil de KOCO asignado. Pide a un administrador o administradora que te agregue desde la pestaña Usuarios.`,
    back: "Volver al inicio de sesión",
  },
  en: {
    title: "Your account isn't linked to a profile yet",
    body: (email: string) =>
      `You signed in successfully (${email}), but your account doesn't have a KOCO profile assigned yet. Ask an administrator to add you from the Users tab.`,
    back: "Back to sign in",
  },
  ko: {
    title: "아직 프로필에 연동되지 않은 계정이에요",
    body: (email: string) =>
      `로그인은 정상적으로 됐어요 (${email}). 다만 아직 KOCO 프로필이 연결되지 않았어요. 관리자에게 멤버 탭에서 추가해 달라고 요청해 주세요.`,
    back: "로그인 화면으로 돌아가기",
  },
} as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // First login with the placeholder password: force a real password first
  if (user.user_metadata?.must_change_password) redirect("/auth/change-password");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*, group:groups(*)")
    .eq("auth_user_id", user.id)
    .single();

  const profile = profileData as Profile | null;
  if (!profile) {
    // Session is valid but no profile row is linked to this auth account.
    const cookieStore = await cookies();
    const raw = cookieStore.get("koco-locale")?.value;
    const lang = raw === "en" || raw === "ko" ? raw : "es";
    const T = UNLINKED_T[lang];

    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#F2E8D5" }}>
        <div className="max-w-md rounded-2xl p-8 shadow-koco text-center space-y-3 anim-in" style={{ backgroundColor: "#F8F0DE" }}>
          <p className="text-3xl">✦</p>
          <h1 className="text-lg font-bold" style={{ color: "#1C1C1C" }}>{T.title}</h1>
          <p className="text-sm" style={{ color: "#555" }}>{T.body(user.email ?? "")}</p>
          <a href="/auth/login" className="inline-block text-sm underline" style={{ color: "#38B39E" }}>
            {T.back}
          </a>
        </div>
      </div>
    );
  }

  // Badge counts for the sidebar. Volunteers see decisions they have not opened
  // yet; admins see proposals waiting on them. Both are cheap count-only
  // queries, and RLS already scopes each one to the right rows.
  let contentBadge = 0;
  if (profile.is_admin) {
    const { count } = await supabase
      .from("content_posts")
      .select("id", { count: "exact", head: true })
      .in("status", ["submitted", "in_review"]);
    contentBadge = count ?? 0;
  } else {
    const { data: mine } = await supabase
      .from("content_posts")
      .select("status_changed_at, volunteer_seen_at")
      .eq("responsible_id", profile.id);
    contentBadge = (mine ?? []).filter(
      (p) =>
        p.status_changed_at &&
        (!p.volunteer_seen_at || new Date(p.status_changed_at) > new Date(p.volunteer_seen_at)),
    ).length;
  }

  return (
    <AppShell profile={profile} initialLocale={profile.locale} contentBadge={contentBadge}>
      {children}
    </AppShell>
  );
}
