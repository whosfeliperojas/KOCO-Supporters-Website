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
    heading: "Crea tu nueva contraseña",
    desc: "Por seguridad, cambia la contraseña temporal antes de continuar.",
    newLabel: "Nueva contraseña (mínimo 8 caracteres)",
    confirmLabel: "Confirma la contraseña",
    btn: "Guardar y continuar",
    saving: "Guardando...",
    tooShort: "Debe tener al menos 8 caracteres.",
    noMatch: "Las contraseñas no coinciden.",
    error: "No se pudo cambiar la contraseña. Intenta de nuevo.",
  },
  en: {
    heading: "Create your new password",
    desc: "For security, change the temporary password before continuing.",
    newLabel: "New password (minimum 8 characters)",
    confirmLabel: "Confirm password",
    btn: "Save and continue",
    saving: "Saving...",
    tooShort: "Must be at least 8 characters.",
    noMatch: "Passwords don't match.",
    error: "Couldn't change the password. Try again.",
  },
  ko: {
    heading: "새 비밀번호를 만들어 주세요",
    desc: "보안을 위해 임시 비밀번호를 먼저 변경해 주세요.",
    newLabel: "새 비밀번호 (8자 이상)",
    confirmLabel: "비밀번호 확인",
    btn: "저장하고 계속하기",
    saving: "저장 중...",
    tooShort: "8자 이상이어야 해요.",
    noMatch: "비밀번호가 일치하지 않아요.",
    error: "비밀번호를 변경하지 못했어요. 다시 시도해 주세요.",
  },
} as const;

export default function ChangePasswordPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Locale>("es");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const tx = t[lang];
  const idx = Math.max(0, LOCALE_META.findIndex((l) => l.code === lang));

  useEffect(() => {
    const saved = readLocaleCookie();
    if (saved) setLang(saved);
  }, []);

  function pickLang(l: Locale) {
    setLang(l);
    document.cookie = `koco-locale=${l};path=/;max-age=31536000;samesite=lax`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) { setError(tx.tooShort); return; }
    if (pw !== confirm) { setError(tx.noMatch); return; }

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: pw,
      data: { must_change_password: false },
    });
    setSaving(false);

    if (updateError) {
      setError(tx.error);
      return;
    }
    router.push("/dashboard");
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
        <div className="text-center mb-8 anim-in">
          <div className="inline-flex gap-0.5 text-4xl font-bold mb-2 leading-none" aria-label="KOCO">
            <span style={{ color: "#ECA040" }}>K</span>
            <span style={{ color: "#38B39E" }}>O</span>
            <span style={{ color: "#E2693E" }}>C</span>
            <span style={{ color: "#CDD909" }}>O</span>
          </div>
        </div>

        <div className="rounded-2xl p-8 shadow-koco anim-in" style={{ backgroundColor: "#F8F0DE", "--i": 1 } as React.CSSProperties}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold mb-1" style={{ color: "#1C1C1C" }}>{tx.heading}</h1>
              <p className="text-sm" style={{ color: "#555" }}>{tx.desc}</p>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{tx.newLabel}</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-lg outline-none"
                style={{ backgroundColor: "#F8F0DE", border: "1.5px solid #DDD0C4", color: "#1C1C1C" }}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: "#1C1C1C" }}>{tx.confirmLabel}</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-2.5 text-sm rounded-lg outline-none"
                style={{ backgroundColor: "#F8F0DE", border: "1.5px solid #DDD0C4", color: "#1C1C1C" }}
              />
            </div>

            {error && <p className="text-xs anim-pop" style={{ color: "#E2693E" }}>{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-lg font-bold text-white text-sm btn-hover"
              style={{ backgroundColor: "#38B39E", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? tx.saving : tx.btn}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
