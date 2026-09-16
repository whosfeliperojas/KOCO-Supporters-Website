"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { DATE_LOCALE } from "@/lib/i18n";
import {
  GlassPortal,
  RequiredShadow,
  triggerClass,
  triggerStyle,
  useAnchoredPopover,
  type TriggerVariant,
} from "@/components/glass/popover";

const T = {
  es: { pick: "Elegir fecha", today: "Hoy", clear: "Borrar", prev: "Mes anterior", next: "Mes siguiente" },
  en: { pick: "Pick a date", today: "Today", clear: "Clear", prev: "Previous month", next: "Next month" },
  ko: { pick: "날짜 선택", today: "오늘", clear: "지우기", prev: "이전 달", next: "다음 달" },
} as const;

const pad = (n: number) => String(n).padStart(2, "0");
/**
 * "septiembre de 2026" -> "Septiembre de 2026". CSS `capitalize` would give
 * "Septiembre De 2026": it title-cases every word, and Spanish does not
 * capitalise "de".
 */
export const capitalizeFirst = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isISO = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
/** Local noon-free construction: `new Date("2026-09-15")` is UTC and lands on the 14th west of Greenwich. */
const fromISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (iso: string, n: number) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
const addMonths = (iso: string, n: number) => {
  const d = fromISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  // Jan 31 + 1 month is Feb 28, not Mar 3.
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
};

/**
 * The app's date field: a button showing the date in the viewer's language,
 * opening a frosted month grid.
 *
 * Value in and out is the same "YYYY-MM-DD" string <input type="date"> uses,
 * so it drops into existing state and Supabase writes unchanged. Weeks start
 * on Sunday to match the content and events calendars elsewhere in the app.
 *
 * Keyboard: arrows move a day or a week, PageUp/PageDown a month, Home/End to
 * the week's edges, Enter picks, Escape closes.
 */
export default function GlassDatePicker({
  value,
  onChange,
  placeholder,
  variant = "field",
  ariaLabel,
  id,
  hasError,
  disabled,
  required,
  min,
  max,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: TriggerVariant;
  ariaLabel?: string;
  id?: string;
  hasError?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Inclusive bounds, "YYYY-MM-DD". Days outside are shown but not pickable. */
  min?: string;
  max?: string;
  className?: string;
}) {
  const { locale } = useLocale();
  const L = T[locale];
  const tag = DATE_LOCALE[locale];

  const { anchorRef, panelRef, open, setOpen, place, closeAndFocus } = useAnchoredPopover<HTMLButtonElement>({
    width: () => 296,
  });

  const today = toISO(new Date());
  const [focusDay, setFocusDay] = useState(today);
  const month = fromISO(focusDay);

  const outOfRange = (iso: string) => (isISO(min) && iso < min) || (isISO(max) && iso > max);

  function openPanel() {
    if (disabled) return;
    const start = isISO(value) ? value : isISO(min) && today < min ? min : today;
    setFocusDay(start);
    setOpen(true);
  }

  function pick(iso: string) {
    if (outOfRange(iso)) return;
    onChange(iso);
    closeAndFocus();
  }

  // Roving focus: the focused day is the one real tab stop in the grid.
  useEffect(() => {
    if (!open) return;
    panelRef.current
      ?.querySelector<HTMLButtonElement>(`[data-iso="${focusDay}"]`)
      ?.focus({ preventScroll: true });
  }, [open, focusDay, panelRef]);

  function onGridKey(e: React.KeyboardEvent) {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focusDay, -1),
      ArrowRight: () => addDays(focusDay, 1),
      ArrowUp: () => addDays(focusDay, -7),
      ArrowDown: () => addDays(focusDay, 7),
      PageUp: () => addMonths(focusDay, -1),
      PageDown: () => addMonths(focusDay, 1),
      Home: () => addDays(focusDay, -fromISO(focusDay).getDay()),
      End: () => addDays(focusDay, 6 - fromISO(focusDay).getDay()),
    };
    if (moves[e.key]) {
      e.preventDefault();
      setFocusDay(moves[e.key]());
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeAndFocus();
    }
  }

  // 42 cells: six Sunday-first weeks, always, so the panel never changes
  // height between months and jumps under the pointer.
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = toISO(new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay()));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  // A known Sunday, for weekday headers in the viewer's language. Not
  // "narrow": in Spanish that gives Tuesday and Wednesday the same "M". Two
  // letters (do lu ma mi ju vi sá) is how Spanish calendars write them;
  // Korean short names are already one character.
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 7 + i).toLocaleDateString(tag, { weekday: "short" }).replace(".", "");
    return locale === "ko" ? d : d.slice(0, 2);
  });
  const monthLabel = capitalizeFirst(month.toLocaleDateString(tag, { month: "long", year: "numeric" }));

  const shown = isISO(value)
    ? fromISO(value).toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <span className={`relative ${variant === "field" ? "block w-full" : "inline-block"} ${className}`}>
      <button
        ref={anchorRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel}${shown ? `: ${shown}` : ""}` : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPanel();
          }
        }}
        className={triggerClass(variant)}
        style={triggerStyle({ variant, hasError, disabled })}
      >
        <span className="truncate" style={{ color: shown ? undefined : "#6B6258" }}>
          {shown ?? placeholder ?? L.pick}
        </span>
        <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: "#6B6258" }}>
          <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
          <path d="M8 2.5v4M16 2.5v4M3 9.5h18" />
        </svg>
      </button>

      <RequiredShadow value={value} required={required} onInvalid={openPanel} />

      <GlassPortal
        open={open}
        panelRef={panelRef}
        place={place}
        role="dialog"
        aria-label={ariaLabel ?? L.pick}
        className="p-3"
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); closeAndFocus(); } }}
      >
        <div className="flex items-center justify-between mb-2">
          <button type="button" aria-label={L.prev} onClick={() => setFocusDay(addMonths(focusDay, -1))} className="glass-icon-btn">
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <p className="text-sm font-bold" style={{ color: "#1C1C1C" }} aria-live="polite">{monthLabel}</p>
          <button type="button" aria-label={L.next} onClick={() => setFocusDay(addMonths(focusDay, 1))} className="glass-icon-btn">
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>

        <div role="grid" aria-label={monthLabel} onKeyDown={onGridKey}>
          <div role="row" className="grid grid-cols-7 mb-1">
            {weekdays.map((d, i) => (
              <span key={i} role="columnheader" className="text-center text-[10px] font-bold uppercase" style={{ color: "#6B6258" }}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((iso) => {
              const d = fromISO(iso);
              const inMonth = d.getMonth() === month.getMonth();
              return (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  data-iso={iso}
                  tabIndex={iso === focusDay ? 0 : -1}
                  aria-selected={iso === value}
                  aria-current={iso === today ? "date" : undefined}
                  aria-label={d.toLocaleDateString(tag, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  disabled={outOfRange(iso)}
                  data-outside={inMonth ? undefined : "true"}
                  data-selected={iso === value ? "true" : undefined}
                  data-today={iso === today ? "true" : undefined}
                  onClick={() => pick(iso)}
                  className="glass-day"
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid rgba(107,98,88,0.12)" }}>
          <button type="button" onClick={() => pick(today)} disabled={outOfRange(today)} className="glass-text-btn" style={{ color: "#1F7A6E" }}>
            {L.today}
          </button>
          {!required && isISO(value) && (
            <button type="button" onClick={() => { onChange(""); closeAndFocus(); }} className="glass-text-btn" style={{ color: "#6B6258" }}>
              {L.clear}
            </button>
          )}
        </div>
      </GlassPortal>
    </span>
  );
}
