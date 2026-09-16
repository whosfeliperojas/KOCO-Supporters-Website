"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  Chevron,
  GlassPortal,
  RequiredShadow,
  triggerClass,
  triggerStyle,
  useAnchoredPopover,
  type TriggerVariant,
} from "@/components/glass/popover";

export type GlassOption = {
  value: string;
  label: string;
  /** A quieter second line, e.g. a criterion's point value. */
  hint?: string;
  disabled?: boolean;
};

/** Accent-insensitive, so typing "a" finds "Álvaro" on a Spanish keyboard. */
const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * The app's dropdown: a button that opens a frosted listbox.
 *
 * Keyboard behaves like a native select - Enter, Space or the arrows open it;
 * arrows, Home and End move; typing jumps to the first match; Enter picks;
 * Escape and Tab close - and it is announced as a listbox with the active
 * option, so a screen reader hears the same thing it would from <select>.
 */
export default function GlassSelect({
  value,
  onChange,
  options,
  placeholder = "",
  variant = "field",
  ariaLabel,
  id,
  hasError,
  active,
  disabled,
  required,
  className = "",
  panelMinWidth = 200,
}: {
  value: string;
  onChange: (value: string) => void;
  options: GlassOption[];
  /** Shown when `value` matches no option. */
  placeholder?: string;
  variant?: TriggerVariant;
  ariaLabel?: string;
  id?: string;
  hasError?: boolean;
  /** Pill variant only: the teal "this filter is on" look. */
  active?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  panelMinWidth?: number;
}) {
  const { anchorRef, panelRef, open, setOpen, place, closeAndFocus } = useAnchoredPopover<HTMLButtonElement>({
    width: (r) => Math.min(Math.max(r.width, panelMinWidth), 360),
  });
  const listId = useId();
  const [activeIdx, setActiveIdx] = useState(-1);
  const typed = useRef({ text: "", at: 0 });

  const selectedIdx = options.findIndex((o) => o.value === value);
  const selected = selectedIdx >= 0 ? options[selectedIdx] : null;
  const optionId = (i: number) => `${listId}-opt-${i}`;

  function firstEnabled(from: number, step: 1 | -1) {
    for (let i = from; i >= 0 && i < options.length; i += step) {
      if (!options[i].disabled) return i;
    }
    return -1;
  }

  function openList() {
    if (disabled) return;
    setActiveIdx(selectedIdx >= 0 ? selectedIdx : firstEnabled(0, 1));
    setOpen(true);
  }

  function commit(i: number) {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    closeAndFocus();
  }

  // Keyboard focus moves into the list while it is open, so arrow keys drive it.
  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [open, panelRef]);

  useEffect(() => {
    if (!open || activeIdx < 0) return;
    document.getElementById(optionId(activeIdx))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optionId is derived from a stable useId
  }, [open, activeIdx]);

  function typeahead(key: string) {
    const now = Date.now();
    typed.current.text = now - typed.current.at > 600 ? key : typed.current.text + key;
    typed.current.at = now;
    const needle = fold(typed.current.text);
    const start = Math.max(0, activeIdx);
    const order = [...options.keys()].map((k) => (k + start + (typed.current.text.length === 1 ? 1 : 0)) % options.length);
    const hit = order.find((i) => !options[i].disabled && fold(options[i].label).startsWith(needle));
    if (hit !== undefined) setActiveIdx(hit);
  }

  function onTriggerKey(e: React.KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  }

  function onListKey(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const n = firstEnabled(activeIdx + 1, 1);
        if (n >= 0) setActiveIdx(n);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const n = firstEnabled(activeIdx - 1, -1);
        if (n >= 0) setActiveIdx(n);
        break;
      }
      case "Home":
        e.preventDefault();
        setActiveIdx(firstEnabled(0, 1));
        break;
      case "End":
        e.preventDefault();
        setActiveIdx(firstEnabled(options.length - 1, -1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIdx);
        break;
      case "Escape":
      case "Tab":
        e.preventDefault();
        closeAndFocus();
        break;
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) typeahead(e.key);
    }
  }

  return (
    <span className={`relative ${variant === "field" ? "block w-full" : "inline-block"} ${className}`}>
      <button
        ref={anchorRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onTriggerKey}
        className={triggerClass(variant, variant === "field" ? "" : "max-w-[16rem]")}
        style={triggerStyle({ variant, hasError, active, disabled })}
      >
        <span className="truncate" style={{ color: selected || variant === "pill" ? undefined : "#6B6258" }}>
          {selected ? selected.label : placeholder}
        </span>
        <Chevron open={open} />
      </button>

      <RequiredShadow value={value} required={required} onInvalid={openList} />

      <GlassPortal
        open={open}
        panelRef={panelRef}
        place={place}
        id={listId}
        role="listbox"
        tabIndex={-1}
        aria-label={ariaLabel}
        aria-activedescendant={activeIdx >= 0 ? optionId(activeIdx) : undefined}
        onKeyDown={onListKey}
        className="p-1.5 overflow-y-auto outline-none"
      >
        {options.map((o, i) => (
          <div
            key={`${o.value}-${i}`}
            id={optionId(i)}
            role="option"
            aria-selected={i === selectedIdx}
            aria-disabled={o.disabled || undefined}
            data-active={i === activeIdx ? "true" : undefined}
            onMouseEnter={() => !o.disabled && setActiveIdx(i)}
            // mousedown, not click: keeps focus in the list until we move it
            // back to the trigger ourselves, so nothing flickers.
            onMouseDown={(e) => { e.preventDefault(); commit(i); }}
            className="glass-option"
          >
            <span className="min-w-0">
              <span className="block truncate">{o.label}</span>
              {o.hint && <span className="block text-[11px] font-normal truncate" style={{ color: "#6B6258" }}>{o.hint}</span>}
            </span>
            {i === selectedIdx && (
              <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </div>
        ))}
      </GlassPortal>
    </span>
  );
}
