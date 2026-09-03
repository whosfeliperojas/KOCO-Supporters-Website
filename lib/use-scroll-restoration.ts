"use client";

import { useEffect } from "react";

/**
 * Puts a long list back where the reader left it.
 *
 * The content list runs to ~90 rows. Opening an idea from the middle and
 * coming back used to drop you at the top, so you had to find your place
 * again every time. The browser's own restoration only covers the back
 * button; returning through an in-app link is a forward navigation, which
 * starts at the top.
 *
 * Scroll offset is kept per key in sessionStorage, so it survives the round
 * trip to a detail page but not a new session, and never leaves the tab.
 *
 * The key should describe what is on screen — including which list and which
 * filter — so switching tabs does not restore a position from a different set
 * of rows.
 */
export function useScrollRestoration(key: string) {
  useEffect(() => {
    const storageKey = `koco:scroll:${key}`;

    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(storageKey);
    } catch {
      // Private mode or blocked storage: restoration is a convenience, not a
      // feature worth breaking the page over.
      return;
    }

    if (saved) {
      const y = Number(saved);
      // Wait for paint: on first mount the list may not be laid out yet, and
      // scrolling to an offset the document cannot reach silently does nothing.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => window.scrollTo(0, y));
      });
    }

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        try {
          sessionStorage.setItem(storageKey, String(window.scrollY));
        } catch {
          /* nothing to do */
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      try {
        sessionStorage.setItem(storageKey, String(window.scrollY));
      } catch {
        /* nothing to do */
      }
    };
  }, [key]);
}
