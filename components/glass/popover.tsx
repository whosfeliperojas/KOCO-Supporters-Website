"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The positioning layer shared by every glass picker (select, date, time).
 *
 * Why a portal and fixed positioning rather than an absolutely-positioned
 * child: most of these controls sit inside `rounded-2xl overflow-hidden`
 * cards, and a panel rendered inside one of those is clipped to the card's
 * edge. Rendering into document.body and placing by the trigger's viewport
 * rect is the only placement that is never cut off.
 *
 * Why the browser's own panels are not used at all: the options list of a
 * <select> and the calendar/clock of <input type="date|time"> are drawn by the
 * operating system, and outside recent Chromium no CSS reaches them. A picker
 * that is glass on one browser and a grey system menu on the next is not a
 * design, so the panels are ours everywhere.
 */

const GAP = 6;
const MARGIN = 8;

type Placement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  /** Opened upward because there was more room above the trigger. */
  above: boolean;
};

export function useAnchoredPopover<T extends HTMLElement>({
  width,
}: {
  /** Panel width for a given trigger rect. Defaults to the trigger's width. */
  width?: (anchor: DOMRect) => number;
} = {}) {
  const anchorRef = useRef<T>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<Placement | null>(null);
  // The width callback is usually an inline arrow; holding it in a ref keeps
  // `reposition` stable so the listeners below are not re-bound every render.
  // Updated after render, not during it - React may render and discard.
  const widthRef = useRef(width);
  useLayoutEffect(() => {
    widthRef.current = width;
  });
  /**
   * The panel's unconstrained height, measured once per opening.
   *
   * Measuring means lifting max-height so the content can expand, and doing
   * that on every scroll event - which is what used to happen - collapses the
   * scroll container mid-gesture and loses the scroll position. Scrolling a
   * long list of volunteers fought back on every wheel tick. Measured on open,
   * reused afterwards.
   */
  const naturalRef = useRef(0);

  const reposition = useCallback((remeasure = false) => {
    const a = anchorRef.current;
    const p = panelRef.current;
    if (!a || !p) return;

    const r = a.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(widthRef.current ? widthRef.current(r) : r.width, vw - MARGIN * 2);

    if (remeasure || !naturalRef.current) {
      // Width first: wrapped text makes height depend on it.
      const keepScroll = p.scrollTop;
      p.style.width = `${w}px`;
      p.style.maxHeight = "none";
      naturalRef.current = p.scrollHeight;
      p.style.maxHeight = "";
      p.scrollTop = keepScroll;
    }
    const natural = naturalRef.current;

    const spaceBelow = vh - r.bottom - GAP - MARGIN;
    const spaceAbove = r.top - GAP - MARGIN;
    const above = natural > spaceBelow && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, above ? spaceAbove : spaceBelow);
    const height = Math.min(natural, maxHeight);

    setPlace({
      top: above ? r.top - GAP - height : r.bottom + GAP,
      left: Math.min(Math.max(MARGIN, r.left), vw - MARGIN - w),
      width: w,
      maxHeight,
      above,
    });
  }, []);

  // Measure on open, before paint, so the panel never flashes in the wrong
  // place. A placement left over from the last opening is harmless: this runs
  // and corrects it before the browser draws anything.
  useLayoutEffect(() => {
    if (open) reposition(true);
    else naturalRef.current = 0;
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;

    // Scroll in ANY ancestor moves the trigger, so listen in the capture phase
    // - but a scroll INSIDE the panel moves nothing, and repositioning on it
    // only fights the gesture.
    const onMove = (e?: Event) => {
      const t = e?.target;
      if (t instanceof Node && panelRef.current?.contains(t)) return;
      reposition();
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };

    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open, reposition]);

  /** Close and hand focus back to the trigger, as a native control would. */
  const closeAndFocus = useCallback(() => {
    setOpen(false);
    anchorRef.current?.focus();
  }, []);

  return { anchorRef, panelRef, open, setOpen, place, reposition, closeAndFocus };
}

export function GlassPortal({
  open,
  panelRef,
  place,
  children,
  className = "",
  ...rest
}: {
  open: boolean;
  panelRef: React.RefObject<HTMLDivElement | null>;
  place: Placement | null;
  children: React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panelRef}
      {...rest}
      data-above={place?.above ? "true" : "false"}
      className={`glass-panel ${className}`}
      style={{
        position: "fixed",
        top: place?.top ?? 0,
        left: place?.left ?? 0,
        width: place?.width,
        maxHeight: place?.maxHeight,
        // Deliberately NOT hidden while it is measured. Placement happens in a
        // layout effect, which finishes before the browser paints, so there is
        // no wrong-position frame to hide - and a visibility:hidden element
        // cannot take focus, which silently broke keyboard control: focus
        // stayed on the trigger, so Escape and the arrow keys did nothing.
        zIndex: 1000,
        ...rest.style,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** A chevron that turns over when its panel is open. */
export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.18s var(--ease-out-quart)" }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Trigger looks, one per place pickers appear in the app.
 *
 * The fill is translucent white rather than the cream of the surface behind
 * it: painted in the surface's own colour a picker is indistinguishable from
 * a plain input, which is exactly how the first version read - "the glass has
 * not been applied". Lighter than every surface in the app, plus the blur and
 * sheen in .glass-trigger, it reads as glass closed as well as open, while
 * still lining up with the text inputs beside it in a form.
 */
export type TriggerVariant = "field" | "compact" | "pill";

export function triggerClass(variant: TriggerVariant, extra = "") {
  const base = "glass-trigger inline-flex items-center justify-between gap-2 outline-none text-left";
  const size =
    variant === "field" ? "w-full px-3 py-2.5 text-sm rounded-lg"
    : variant === "compact" ? "px-2.5 py-1.5 text-xs rounded-lg"
    : "px-3 py-1.5 text-xs font-bold rounded-full";
  return `${base} ${size} ${extra}`;
}

export function triggerStyle({
  variant,
  hasError,
  active,
  disabled,
}: {
  variant: TriggerVariant;
  hasError?: boolean;
  active?: boolean;
  disabled?: boolean;
}): React.CSSProperties {
  if (variant === "pill") {
    return {
      backgroundColor: active ? "rgba(56,179,158,0.16)" : "rgba(255,255,255,0.4)",
      border: `1.5px solid ${active ? "#38B39E" : "rgba(255,255,255,0.9)"}`,
      color: active ? "#1F7A6E" : "#6B6258",
      opacity: disabled ? 0.55 : 1,
    };
  }
  return {
    backgroundColor: "rgba(255,255,255,0.4)",
    border: `1.5px solid ${hasError ? "#E2693E" : "rgba(255,255,255,0.9)"}`,
    color: "#1C1C1C",
    opacity: disabled ? 0.55 : 1,
  };
}

/**
 * Lets `required` work on a custom picker. The browser's own "please fill in
 * this field" bubble only fires on a real form control, so a real one sits
 * under the trigger - invisible, unreachable by Tab, but present for
 * validation. It must not be display:none or type=hidden: both are skipped by
 * constraint validation.
 */
export function RequiredShadow({
  value,
  required,
  name,
  onInvalid,
}: {
  value: string;
  required?: boolean;
  name?: string;
  onInvalid?: () => void;
}) {
  if (!required && !name) return null;
  return (
    <input
      tabIndex={-1}
      aria-hidden
      name={name}
      required={required}
      value={value}
      onChange={() => {}}
      onInvalid={(e) => {
        e.preventDefault();
        onInvalid?.();
      }}
      className="absolute left-3 bottom-0 w-px h-px opacity-0 pointer-events-none"
    />
  );
}
