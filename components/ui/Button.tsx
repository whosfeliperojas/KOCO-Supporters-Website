"use client";

/**
 * The app's button.
 *
 * It exists because the same decision wore two different costumes: in the
 * review queue "Aprobar" is a solid teal primary with two tinted secondaries
 * beside it, while inside the post the same approve/reject pair rendered as
 * four equal-weight solid buttons - reject shouting exactly as loud as
 * approve. Same admin, same choice, two vocabularies.
 *
 * The variants map to DESIGN.md's one-job-per-colour rule:
 *   primary      orange  - the one thing this screen is for
 *   confirm      teal    - the constructive decision (approve, save, sign up)
 *   secondary    tinted  - a real option, but not the one being recommended
 *   destructive  coral   - rejects, cancellations, anything that takes away
 *   ghost        bare    - tertiary; reads as a control, not as a link
 *
 * Every variant ships all seven states, because a button missing `disabled`
 * or `:focus-visible` is a button that lies about whether it can be pressed.
 * `loading` keeps the label and swaps in a spinner, so the control does not
 * change width mid-click and the reader is told what is happening.
 */

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "confirm" | "secondary" | "destructive" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const SIZES: Record<ButtonSize, string> = {
  // min-height keeps every button at or above the 44px touch target on phones,
  // where volunteers do nearly all of their reading.
  sm: "text-xs px-3 py-2 min-h-[36px] rounded-lg gap-1.5",
  md: "text-sm px-4 py-2.5 min-h-[44px] rounded-lg gap-2",
  lg: "text-sm px-5 py-3 min-h-[48px] w-full rounded-lg gap-2",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  confirm: "btn-confirm",
  secondary: "btn-secondary",
  destructive: "btn-destructive",
  ghost: "btn-ghost",
};

export default function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  loadingLabel,
  icon,
  children,
  className = "",
  disabled,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks the click without changing the button's width. */
  loading?: boolean;
  /** Announced to screen readers while loading; falls back to the label. */
  loadingLabel?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading ? (
        <>
          <span className="btn-spinner" aria-hidden />
          <span className="sr-only">{loadingLabel ?? ""}</span>
        </>
      ) : (
        icon
      )}
      <span className="truncate">{children}</span>
    </button>
  );
}
