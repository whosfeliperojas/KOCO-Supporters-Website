"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LOCALE_META, type Locale } from "@/lib/i18n";

function readLocaleCookie(): Locale | null {
  const m = document.cookie.match(/(?:^|; )koco-locale=(es|en|ko)/);
  return (m?.[1] as Locale) ?? null;
}

const t = {
  es: {
    heading: "Iniciar sesión",
    desc: "Ingresa tu correo y contraseña para acceder.",
    emailLabel: "Correo electrónico",
    passwordLabel: "Contraseña",
    btn: "Ingresar",
    signingIn: "Ingresando...",
    error: "Correo o contraseña incorrectos. Intenta de nuevo.",
    hint: "Si es tu primer ingreso, usa la contraseña temporal que te dio tu administrador/a.",
  },
  en: {
    heading: "Sign in",
    desc: "Enter your email and password to access the platform.",
    emailLabel: "Email address",
    passwordLabel: "Password",
    btn: "Sign in",
    signingIn: "Signing in...",
    error: "Wrong email or password. Try again.",
    hint: "First time here? Use the temporary password your admin gave you.",
  },
  ko: {
    heading: "로그인",
    desc: "이메일과 비밀번호를 입력해 주세요.",
    emailLabel: "이메일 주소",
    passwordLabel: "비밀번호",
    btn: "로그인",
    signingIn: "로그인 중...",
    error: "이메일 또는 비밀번호가 올바르지 않아요. 다시 시도해 주세요.",
    hint: "처음이신가요? 관리자가 알려준 임시 비밀번호로 로그인하세요.",
  },
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Locale>("es");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "signing" | "error">("idle");
  const tx = t[lang];

  useEffect(() => {
    const saved = readLocaleCookie();
    if (saved) setLang(saved);
  }, []);

  function pickLang(l: Locale) {
    setLang(l);
    document.cookie = `koco-locale=${l};path=/;max-age=31536000;samesite=lax`;
  }
  const idx = Math.max(0, LOCALE_META.findIndex((l) => l.code === lang));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setStatus("signing");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setStatus("error");
      return;
    }

    if (data.user.user_metadata?.must_change_password) {
      router.push("/auth/change-password");
    } else {
      router.push("/dashboard");
    }
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#F2E8D5" }}>
      {/* Slide language switcher */}
      <div
        role="radiogroup"
        aria-label="Idioma / Language / 언어"
        className="fixed top-4 right-4 grid grid-cols-3 rounded-full p-1 w-40"
        style={{ backgroundColor: "rgba(56,179,158,0.10)" }}
      >
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
            aria-checked={lang === l.code}
            title={l.name}
            onClick={() => pickLang(l.code)}
            className="relative z-10 py-1.5 text-xs font-bold rounded-full text-center transition-colors"
            style={{ color: lang === l.code ? "#FFFFFF" : "#38B39E" }}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="w-full max-w-md">
        {/* Hero — the official KOCO wordmark */}
        <div className="text-center mb-8 anim-in" style={{ "--i": 0 } as React.CSSProperties}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/koco-logo.webp"
            alt="KOCO"
            className="anim-pop inline-block mb-3"
            style={{ height: 108, width: "auto", animationDelay: "80ms" }}
          />
        </div>

        {/* Card — Peko hangs over the top edge, paws resting on the card.
            The wrapper owns the exact placement (its own height − 12px overlap);
            the entrance animation runs on the inner img so they don't fight. */}
        <div className="relative">
          <div
            aria-hidden
            className="absolute z-10 select-none pointer-events-none"
            style={{ top: 0, right: 26, transform: "translateY(calc(-100% + 12px))" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/peko/peko-peek.webp"
              alt=""
              className="anim-in block"
              style={{ width: 108, "--i": 2 } as React.CSSProperties}
            />
          </div>
        <div className="relative rounded-2xl p-8 shadow-koco anim-in" style={{ backgroundColor: "#F8F0DE", "--i": 3 } as React.CSSProperties}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold mb-1" style={{ color: "#1C1C1C" }}>{tx.heading}</h1>
              <p className="text-sm" style={{ color: "#555" }}>{tx.desc}</p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>
                {tx.emailLabel}
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@correo.com"
                className="w-full px-4 py-2.5 text-sm rounded-lg outline-none"
                style={{ backgroundColor: "#F8F0DE", border: "1.5px solid #DDD0C4", color: "#1C1C1C" }}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>
                {tx.passwordLabel}
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-lg outline-none"
                style={{ backgroundColor: "#F8F0DE", border: "1.5px solid #DDD0C4", color: "#1C1C1C" }}
              />
              <p className="text-xs pt-1" style={{ color: "#888" }}>{tx.hint}</p>
            </div>

            {status === "error" && (
              <p className="text-xs anim-pop" style={{ color: "#E2693E" }}>{tx.error}</p>
            )}

            <button
              type="submit"
              disabled={status === "signing"}
              className="w-full py-3 rounded-lg font-bold text-white text-sm btn-hover"
              style={{
                backgroundColor: "#ECA040",
                opacity: status === "signing" ? 0.6 : 1,
                cursor: status === "signing" ? "not-allowed" : "pointer",
              }}
            >
              {status === "signing" ? tx.signingIn : tx.btn}
            </button>
          </form>
        </div>
        </div>

        {/* Peko's friends — the welcome committee, each bobbing on its own beat */}
        <div className="mt-7 flex items-end justify-center gap-4 select-none" aria-hidden>
          {([
            ["owl", 66, "3.4s", "0s"],
            ["sloth", 74, "3.0s", "-1.3s"],
            ["chick", 56, "2.7s", "-0.6s"],
            ["cat", 64, "3.7s", "-2.1s"],
          ] as const).map(([n, h, dur, del], i) => (
            <span key={n} className="anim-pop inline-block" style={{ animationDelay: `${320 + i * 100}ms` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/peko/friend-${n}.webp`}
                alt=""
                draggable={false}
                className="peko-bob"
                style={{ height: h, width: h, animationDuration: dur, animationDelay: del }}
              />
            </span>
          ))}
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "#888" }}>
          KOICA Colombia · 2026
        </p>
      </div>
    </div>
  );
}
