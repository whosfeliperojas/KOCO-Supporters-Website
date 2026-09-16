"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import {
  GlassPortal,
  RequiredShadow,
  triggerClass,
  triggerStyle,
  useAnchoredPopover,
  type TriggerVariant,
} from "@/components/glass/popover";

const T = {
  es: { pick: "Elegir hora", hour: "Hora", minute: "Minutos", clear: "Borrar", done: "Listo" },
  en: { pick: "Pick a time", hour: "Hour", minute: "Minutes", clear: "Clear", done: "Done" },
  ko: { pick: "시간 선택", hour: "시", minute: "분", clear: "지우기", done: "완료" },
} as const;

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const STEP_MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

/** "09:30:00" from Postgres and "09:30" from a form both become ["09","30"]. */
function split(v: string): [string, string] | null {
  const m = /^(\d{2}):(\d{2})/.exec(v ?? "");
  return m ? [m[1], m[2]] : null;
}

/**
 * The app's time field: two frosted columns, hours and minutes.
 *
 * Minutes come in fives - events here start on the hour or the half hour, and
 * sixty rows to scroll is a worse control than the native one it replaces. A
 * stored time that is not on a five (imported data can be) is kept and shown
 * in the column rather than silently rounded.
 *
 * Emits "HH:MM", the same shape <input type="time"> produced.
 */
export default function GlassTimePicker({
  value,
  onChange,
  placeholder,
  variant = "field",
  ariaLabel,
  id,
  hasError,
  disabled,
  required,
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
  className?: string;
}) {
  const { locale } = useLocale();
  const L = T[locale];
  const { anchorRef, panelRef, open, setOpen, place, closeAndFocus } = useAnchoredPopover<HTMLButtonElement>({
    width: () => 196,
  });

  const parts = split(value);
  const [col, setCol] = useState<"h" | "m">("h");

  const minutes = parts && !STEP_MINUTES.includes(parts[1])
    ? [...STEP_MINUTES, parts[1]].sort()
    : STEP_MINUTES;

  function set(h: string, m: string) {
    onChange(`${h}:${m}`);
  }

  function openPanel() {
    if (disabled) return;
    setCol("h");
    setOpen(true);
  }

  // Centre the chosen hour and minute in their columns when the panel opens.
  useEffect(() => {
    if (!open) return;
    const p = panelRef.current;
    p?.querySelectorAll<HTMLElement>('[aria-selected="true"]').forEach((el) => el.scrollIntoView({ block: "center" }));
    p?.querySelector<HTMLElement>('[data-col="h"]')?.focus({ preventScroll: true });
  }, [open, panelRef]);

  function onKey(e: React.KeyboardEvent) {
    const [h, m] = parts ?? ["09", "00"];
    const list = col === "h" ? HOURS : minutes;
    const cur = list.indexOf(col === "h" ? h : m);
    const move = (d: number) => {
      const next = list[(cur + d + list.length) % list.length];
      if (col === "h") set(next, m); else set(h, next);
    };
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); move(1); break;
      case "ArrowUp": e.preventDefault(); move(-1); break;
      case "ArrowRight": e.preventDefault(); setCol("m"); panelRef.current?.querySelector<HTMLElement>('[data-col="m"]')?.focus(); break;
      case "ArrowLeft": e.preventDefault(); setCol("h"); panelRef.current?.querySelector<HTMLElement>('[data-col="h"]')?.focus(); break;
      case "Enter":
      case "Escape": e.preventDefault(); closeAndFocus(); break;
    }
  }

  // Keep the keyboard-driven choice visible as it moves.
  useEffect(() => {
    if (!open) return;
    panelRef.current
      ?.querySelectorAll<HTMLElement>('[aria-selected="true"]')
      .forEach((el) => el.scrollIntoView({ block: "nearest" }));
  }, [open, value, panelRef]);

  function Column({ which, items, current, label }: { which: "h" | "m"; items: string[]; current: string | null; label: string }) {
    return (
      <div
        role="listbox"
        aria-label={label}
        tabIndex={-1}
        data-col={which}
        onFocus={() => setCol(which)}
        className="glass-time-col outline-none"
      >
        {items.map((x) => (
          <div
            key={x}
            role="option"
            aria-selected={x === current}
            onMouseDown={(e) => {
              e.preventDefault();
              const [h, m] = parts ?? ["09", "00"];
              if (which === "h") set(x, m);
              else { set(h, x); closeAndFocus(); }
            }}
            className="glass-option justify-center tabular-nums"
          >
            {x}
          </div>
        ))}
      </div>
    );
  }

  return (
    <span className={`relative ${variant === "field" ? "block w-full" : "inline-block"} ${className}`}>
      <button
        ref={anchorRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
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
        <span className="truncate tabular-nums" style={{ color: parts ? undefined : "#6B6258" }}>
          {parts ? `${parts[0]}:${parts[1]}` : placeholder ?? L.pick}
        </span>
        <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: "#6B6258" }}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </button>

      <RequiredShadow value={value} required={required} onInvalid={openPanel} />

      <GlassPortal
        open={open}
        panelRef={panelRef}
        place={place}
        role="dialog"
        aria-label={ariaLabel ?? L.pick}
        onKeyDown={onKey}
        className="p-2"
      >
        <div className="grid grid-cols-2 gap-1.5">
          <p className="text-center text-[10px] font-bold uppercase" style={{ color: "#6B6258" }}>{L.hour}</p>
          <p className="text-center text-[10px] font-bold uppercase" style={{ color: "#6B6258" }}>{L.minute}</p>
          {Column({ which: "h", items: HOURS, current: parts?.[0] ?? null, label: L.hour })}
          {Column({ which: "m", items: minutes, current: parts?.[1] ?? null, label: L.minute })}
        </div>
        <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid rgba(107,98,88,0.12)" }}>
          {!required && parts ? (
            <button type="button" onClick={() => { onChange(""); closeAndFocus(); }} className="glass-text-btn" style={{ color: "#6B6258" }}>
              {L.clear}
            </button>
          ) : <span />}
          <button type="button" onClick={closeAndFocus} className="glass-text-btn" style={{ color: "#1F7A6E" }}>
            {L.done}
          </button>
        </div>
      </GlassPortal>
    </span>
  );
}
