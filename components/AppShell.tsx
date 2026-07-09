"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LocaleProvider, useLocale } from "@/lib/locale-context";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { triggerPekoBlink } from "@/components/Peko";
import Companion, { companionReact } from "@/components/Companion";
import type { Profile } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { LOCALE_META } from "@/lib/i18n";

// Volunteers: create content, attend events, earn points
const NAV = [
  { href: "/dashboard", icon: "⊞", es: "Inicio",     en: "Dashboard", ko: "홈" },
  { href: "/content",   icon: "✦", es: "Contenidos", en: "Content",   ko: "콘텐츠" },
  { href: "/events",    icon: "◎", es: "Eventos",    en: "Events",    ko: "행사" },
  { href: "/points",    icon: "★", es: "Mis puntos", en: "My points", ko: "내 포인트" },
];

// Admins manage the program — no volunteer functions (they don't submit content or earn points)
const ADMIN_NAV = [
  { href: "/dashboard",     icon: "⊞", es: "Inicio",   en: "Dashboard", ko: "홈" },
  { href: "/admin/content", icon: "▦", es: "Revisión", en: "Review",    ko: "검토" },
  { href: "/admin/events",  icon: "◈", es: "Eventos",  en: "Events",    ko: "행사" },
  { href: "/admin/points",  icon: "✚", es: "Puntos",   en: "Points",    ko: "포인트" },
  { href: "/admin/users",   icon: "◐", es: "Usuarios", en: "Users",     ko: "멤버" },
];

const SHELL_T = {
  es: { adminSection: "Administración", adminBadge: "Administrador/a", signOut: "Cerrar sesión" },
  en: { adminSection: "Administration", adminBadge: "Admin",           signOut: "Sign out" },
  ko: { adminSection: "관리",            adminBadge: "관리자",           signOut: "로그아웃" },
} as const;

// Official KOCO wordmark from the brandbook (docs/brand/final_assets)
function KocoLogo({ height = 48 }: { height?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/koco-logo.webp"
      alt="KOCO"
      draggable={false}
      style={{ height, width: "auto" }}
    />
  );
}

function NavItem({
  href,
  icon,
  label,
  onHover,
}: {
  href: string;
  icon: string;
  label: string;
  onHover?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      onMouseEnter={() => onHover?.()}
      onClick={() => triggerPekoBlink()}
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
      style={{
        color: active ? "#38B39E" : "#1C1C1C",
        backgroundColor: active ? "rgba(56,179,158,0.08)" : "transparent",
      }}
    >
      <span className="text-base w-5 text-center">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

/**
 * Slide language switcher — segmented control with a sliding teal thumb.
 * ES / EN / KO. Thumb animates with transform only (GPU-friendly),
 * 200ms ease-out-quart; collapses to instant under prefers-reduced-motion.
 */
export function LangSwitcher() {
  const { locale, setLocale } = useLocale();
  const idx = Math.max(0, LOCALE_META.findIndex((l) => l.code === locale));

  return (
    <div
      role="radiogroup"
      aria-label="Idioma / Language / 언어"
      className="relative grid grid-cols-3 rounded-full p-1"
      style={{ backgroundColor: "rgba(56,179,158,0.10)" }}
    >
      {/* Sliding thumb */}
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-full"
        style={{
          width: "calc((100% - 8px) / 3)",
          left: 4,
          transform: `translateX(${idx * 100}%)`,
          backgroundColor: "#38B39E",
          transition: "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
        }}
      />
      {LOCALE_META.map((l) => (
        <button
          key={l.code}
          role="radio"
          aria-checked={locale === l.code}
          title={l.name}
          onClick={() => setLocale(l.code)}
          className="relative z-10 py-1.5 text-xs font-bold rounded-full text-center transition-colors outline-none focus-visible:ring-2"
          style={{
            color: locale === l.code ? "#FFFFFF" : "#38B39E",
            transitionDuration: "200ms",
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

function Sidebar({ profile, locale, onClose }: { profile: Profile; locale: Locale; onClose?: () => void }) {
  const router = useRouter();
  const T = SHELL_T[locale];

  // Companion acknowledges nav hovers with a little hop (throttled so
  // sweeping the menu reads as attention, not twitching)
  const lastPerk = useRef(0);
  function perk() {
    const now = Date.now();
    if (now - lastPerk.current > 600) {
      lastPerk.current = now;
      companionReact("perk");
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  const nav = (profile.is_admin ? ADMIN_NAV : NAV).map((n) => ({ ...n, label: n[locale] }));

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "#F2E8D5" }}>
      {/* Header */}
      <div className="px-5 py-5 flex items-center justify-between">
        <KocoLogo height={52} />
        {onClose && (
          <button onClick={onClose} className="text-lg" style={{ color: "#888" }}>✕</button>
        )}
      </div>

      {/* Profile chip */}
      <div className="mx-3 mb-4 px-4 py-3 rounded-xl" style={{ backgroundColor: "#FCD4C1" }}>
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "#8C6B55", marginBottom: 2 }}>
          {profile.group?.code ?? "KOCO"}
        </p>
        <p className="text-sm font-bold" style={{ color: "#1C1C1C" }}>
          {profile.display_name ?? profile.full_name.split(" ")[0]}
        </p>
        {profile.is_admin && (
          <span className="text-xs font-medium" style={{ color: "#E2693E" }}>
            {T.adminBadge}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="px-2 space-y-1">
        {nav.map((n) => <NavItem key={n.href} {...n} onHover={perk} />)}
      </nav>

      {/* Peko lives here — below the tabs, watching, breathing, reacting */}
      <div className="flex-1 min-h-0 flex items-end justify-center px-2 pt-2">
        <Companion />
      </div>

      {/* Footer */}
      <div className="px-4 py-4 space-y-3">
        <LangSwitcher />

        <button
          onClick={signOut}
          className="w-full text-sm font-medium text-left px-4 py-2 rounded-lg transition-all"
          style={{ color: "#6B6258" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FCD4C1")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          {T.signOut}
        </button>
      </div>
    </div>
  );
}

export default function AppShell({
  profile,
  initialLocale,
  children,
}: {
  profile: Profile;
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <LocaleProvider initial={initialLocale}>
      <AppShellInner profile={profile} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}>
        {children}
      </AppShellInner>
    </LocaleProvider>
  );
}

function AppShellInner({
  profile,
  mobileOpen,
  setMobileOpen,
  children,
}: {
  profile: Profile;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const { locale } = useLocale();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r" style={{ borderColor: "#E8DCCF" }}>
        <Sidebar profile={profile} locale={locale} />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/30 backdrop-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-56 h-full shadow-xl drawer-in">
            <Sidebar profile={profile} locale={locale} onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex md:hidden items-center justify-between px-4 py-3 border-b" style={{ backgroundColor: "#F2E8D5", borderColor: "#E8DCCF" }}>
          <button onClick={() => setMobileOpen(true)} className="text-xl" style={{ color: "#1C1C1C" }}>
            ☰
          </button>
          <KocoLogo height={34} />
          <div className="w-6" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
