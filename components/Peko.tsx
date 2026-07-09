"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Peko & friends — interactive mascot.
 * Renders /public/peko/<character>-<pose>.webp and hides itself gracefully if
 * the image doesn't exist yet, so the app works before the art is generated.
 *
 * Blink: any component rendered with `blinkOnEvent` reacts to the global
 * "peko-blink" window event (dispatched on nav/link clicks). If a
 * <character>-blink.webp exists it swaps to it briefly (true eye blink);
 * otherwise it plays a quick squash — either way the click is acknowledged.
 */
export type PekoPose = "idle" | "side" | "wave" | "celebrate" | "think" | "point" | "sad" | "sleep";

export const PEKO_BLINK_EVENT = "peko-blink";

export function triggerPekoBlink() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PEKO_BLINK_EVENT));
  }
}

export default function Peko({
  pose = "idle",
  character = "peko",
  size = 90,
  animation = "bob",
  flip = false,
  blinkOnEvent = false,
  className = "",
}: {
  pose?: PekoPose;
  /** peko lives on the dashboards; his friends take the other tabs */
  character?: string;
  size?: number;
  /** bob = gentle float · wiggle = playful tilt · pop = entrance pop · none */
  animation?: "bob" | "wiggle" | "pop" | "none";
  flip?: boolean;
  /** react to the global peko-blink event (fired on nav clicks) */
  blinkOnEvent?: boolean;
  className?: string;
}) {
  const [available, setAvailable] = useState(true);
  const [blinking, setBlinking] = useState(false);
  const [useBlinkImg, setUseBlinkImg] = useState(false);
  const blinkImgOk = useRef(true); // assume the blink frame exists until a 404 says otherwise

  useEffect(() => {
    if (!blinkOnEvent) return;
    let timeout: ReturnType<typeof setTimeout>;
    const handler = () => {
      setBlinking(true);
      if (blinkImgOk.current) setUseBlinkImg(true);
      timeout = setTimeout(() => {
        setBlinking(false);
        setUseBlinkImg(false);
      }, 220);
    };
    window.addEventListener(PEKO_BLINK_EVENT, handler);
    return () => {
      window.removeEventListener(PEKO_BLINK_EVENT, handler);
      clearTimeout(timeout);
    };
  }, [blinkOnEvent]);

  if (!available) return null;

  const src = useBlinkImg
    ? `/peko/${character}-blink.webp`
    : `/peko/${character}-${pose}.webp`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      onError={() => {
        if (useBlinkImg) {
          // No blink frame generated yet — fall back to squash only
          blinkImgOk.current = false;
          setUseBlinkImg(false);
        } else {
          setAvailable(false);
        }
      }}
      className={[
        "peko",
        animation !== "none" ? `peko-${animation}` : "",
        blinking && !useBlinkImg ? "peko-squash" : "",
        className,
      ].filter(Boolean).join(" ")}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        ...(flip ? { transform: "scaleX(-1)" } : {}),
      }}
    />
  );
}
