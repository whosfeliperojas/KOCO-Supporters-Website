"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
}>({ locale: "es", setLocale: () => {} });

export function LocaleProvider({ children, initial = "es" }: { children: ReactNode; initial?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initial);

  async function setLocale(l: Locale) {
    setLocaleState(l);
    // Cookie so pre-profile screens (login, unlinked-account) keep the language
    document.cookie = `koco-locale=${l};path=/;max-age=31536000;samesite=lax`;
    // Persist in profile
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ locale: l }).eq("auth_user_id", user.id);
    }
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);
