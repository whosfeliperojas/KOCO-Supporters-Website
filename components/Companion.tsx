"use client";

/**
 * Companion — Peko as a living virtual mascot, anchored in the sidebar.
 *
 * Alive behaviors:
 *  - breathes constantly (subtle scale rhythm, slower when asleep)
 *  - blinks on his own at random intervals (overlay eyelids at the eye
 *    positions auto-detected from the idle frame; occasionally double-blinks)
 *  - leans and turns toward the cursor as it moves around the app
 *  - waves on every tab arrival; greets each section once per session
 *  - falls asleep after ~90s of inactivity (eyes closed, floating z z z),
 *    wakes with a startle blink + hop on any activity
 *  - celebrates on demand (saves, approvals, points) via companionReact()
 *  - giggles when clicked
 *
 * All motion is transform/opacity only (compositor-friendly); JS-driven
 * behaviors are disabled under prefers-reduced-motion (CSS animations are
 * collapsed globally in globals.css).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { PEKO_BLINK_EVENT } from "@/components/Peko";
import meta from "@/lib/peko-meta.json";

export const COMPANION_EVENT = "koco-companion";
export type CompanionMood = "wave" | "celebrate" | "perk" | "blink";

/** Ask the companion to react from anywhere in the app. */
export function companionReact(mood: CompanionMood, say?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COMPANION_EVENT, { detail: { mood, say } }));
}

type Pose = "idle" | "wave" | "celebrate";
const ALL_POSES: Pose[] = ["idle", "wave", "celebrate"];

const T = {
  es: {
    hello: "¡Hola! Qué bueno verte",
    content: "¿Hoy toca una idea nueva?",
    contentNew: "¡Tú puedes! Cuéntame tu idea",
    events: "¡Mira los próximos eventos!",
    points: "¡Cuántos puntos llevas!",
    adminReview: "Ideas esperando tu revisión",
    adminEvents: "¿Creamos un evento?",
    adminPoints: "Hora de repartir puntos",
    adminUsers: "El equipo KOCO",
    celebrate: "¡Bien hecho! 🎉",
    tickle: "¡Jiji, eso hace cosquillas!",
  },
  en: {
    hello: "Hi! Good to see you",
    content: "New idea today?",
    contentNew: "You've got this! Tell me your idea",
    events: "Check out the upcoming events!",
    points: "Look how many points you've got!",
    adminReview: "Ideas waiting for your review",
    adminEvents: "Shall we create an event?",
    adminPoints: "Time to hand out points",
    adminUsers: "The KOCO team",
    celebrate: "Well done! 🎉",
    tickle: "Hehe, that tickles!",
  },
  ko: {
    hello: "어서 와요! 기다렸어요",
    content: "오늘은 새 아이디어 어때요?",
    contentNew: "화이팅! 아이디어 기대할게요",
    events: "다가오는 행사 둘러봐요!",
    points: "포인트가 이만큼 쌓였어요!",
    adminReview: "검토할 아이디어가 있어요!",
    adminEvents: "행사 하나 만들어 볼까요?",
    adminPoints: "포인트 줄 시간이에요!",
    adminUsers: "우리 KOCO 팀이에요!",
    celebrate: "잘했어요! 🎉",
    tickle: "히히, 간지러워요!",
  },
} as const;

type LineKey = keyof typeof T.es;

// Longest-prefix first so /admin/* and /content/new win over their parents
const ROUTE_LINES: [string, LineKey][] = [
  ["/admin/content", "adminReview"],
  ["/admin/events", "adminEvents"],
  ["/admin/points", "adminPoints"],
  ["/admin/users", "adminUsers"],
  ["/content/new", "contentNew"],
  ["/dashboard", "hello"],
  ["/content", "content"],
  ["/events", "events"],
  ["/points", "points"],
];

// Each section greets only once per session — repetition kills the illusion
const greeted = new Set<string>();

export default function Companion({ size = 148 }: { size?: number }) {
  const { locale } = useLocale();
  const pathname = usePathname();
  const L = T[locale];

  const [pose, setPose] = useState<Pose>("idle");
  const [eyesClosed, setEyesClosed] = useState(false);
  const [asleep, setAsleep] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const leanRef = useRef<HTMLDivElement>(null);
  const hopRef = useRef<HTMLDivElement>(null);
  const poseRef = useRef<Pose>("idle");
  const asleepRef = useRef(false);
  const poseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useRef(false);

  const setPoseFor = useCallback((p: Pose, ms: number) => {
    if (poseTimer.current) clearTimeout(poseTimer.current);
    poseRef.current = p;
    setPose(p);
    poseTimer.current = setTimeout(() => {
      poseRef.current = "idle";
      setPose("idle");
    }, ms);
  }, []);

  const say = useCallback((text: string, ms = 3400) => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    setBubble(text);
    bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  }, []);

  // Little acknowledgment hop — Web Animations API, so nothing remounts and
  // the breathing rhythm never skips
  const doHop = useCallback(() => {
    if (reduced.current) return;
    hopRef.current?.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(-5px)", offset: 0.35 },
        { transform: "translateY(0)" },
      ],
      { duration: 280, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }
    );
  }, []);

  const blink = useCallback((double = false) => {
    if (asleepRef.current) return;
    setEyesClosed(true);
    setTimeout(() => {
      setEyesClosed(false);
      if (double)
        setTimeout(() => {
          setEyesClosed(true);
          setTimeout(() => setEyesClosed(false), 110);
        }, 150);
    }, 120);
  }, []);

  // All pose layers stay mounted (stacked + crossfaded), so no preload needed
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Autonomous blinking — randomized, sometimes double
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        if (!asleepRef.current && poseRef.current === "idle") blink(Math.random() < 0.18);
        loop();
      }, 2600 + Math.random() * 3800);
    };
    loop();
    return () => clearTimeout(t);
  }, [blink]);

  // Sleep after inactivity + cursor lean
  useEffect(() => {
    let sleepT: ReturnType<typeof setTimeout>;
    let raf = 0;
    const armSleep = () => {
      clearTimeout(sleepT);
      sleepT = setTimeout(() => {
        asleepRef.current = true;
        setAsleep(true);
        setEyesClosed(true);
        setBubble(null);
      }, 90000);
    };
    const wake = () => {
      if (asleepRef.current) {
        asleepRef.current = false;
        setAsleep(false);
        setEyesClosed(false);
        blink(true);
        doHop();
      }
      armSleep();
    };
    const onMove = (e: MouseEvent) => {
      wake();
      if (reduced.current || raf || !leanRef.current || !wrapRef.current) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!leanRef.current || !wrapRef.current) return;
        const r = wrapRef.current.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 340));
        const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / 460));
        leanRef.current.style.transform = `rotate(${(dx * 5).toFixed(2)}deg) translate(${(dx * 4).toFixed(1)}px, ${(dy * 2).toFixed(1)}px)`;
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("keydown", wake);
    window.addEventListener("pointerdown", wake);
    armSleep();
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("pointerdown", wake);
      clearTimeout(sleepT);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [blink, doHop]);

  // App-wide reactions (companionReact + legacy triggerPekoBlink)
  useEffect(() => {
    const onCompanion = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {};
      if (d.mood === "celebrate") {
        setPoseFor("celebrate", 2400);
        say(d.say ?? L.celebrate, 2400);
      } else if (d.mood === "wave") setPoseFor("wave", 2000);
      else if (d.mood === "perk") doHop();
      else if (d.mood === "blink") blink();
    };
    const onBlink = () => blink();
    window.addEventListener(COMPANION_EVENT, onCompanion);
    window.addEventListener(PEKO_BLINK_EVENT, onBlink);
    return () => {
      window.removeEventListener(COMPANION_EVENT, onCompanion);
      window.removeEventListener(PEKO_BLINK_EVENT, onBlink);
    };
  }, [blink, doHop, setPoseFor, say, L]);

  // Arriving at a tab: wave, and greet the section (once per session)
  useEffect(() => {
    setPoseFor("wave", 1900);
    const hit = ROUTE_LINES.find(([p]) => pathname.startsWith(p));
    if (hit && !greeted.has(hit[0])) {
      greeted.add(hit[0]);
      say(L[hit[1]], 3800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function onTickle() {
    setPoseFor("celebrate", 1500);
    say(L.tickle, 2000);
  }

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="companion-slot relative flex-col items-center justify-end select-none"
      style={{ paddingBottom: 6 }}
    >
      {/* Speech bubble — same dark pill as the mascot sheet. The positioning
          wrapper owns the centering transform; the pop animation runs on the
          inner element so they never fight. */}
      {bubble && (
        <div
          className="absolute left-1/2 z-10"
          style={{ bottom: size + 18, transform: "translateX(-50%)", width: "max-content", maxWidth: 192 }}
        >
          <div className="anim-pop">
            <div
              className="px-3 py-1.5 rounded-xl text-center leading-snug"
              style={{ backgroundColor: "#1C1C1C", color: "#F8F0DE", fontSize: 11.5, fontWeight: 500 }}
            >
              {bubble}
            </div>
            <div className="mx-auto -mt-1 w-2 h-2 rotate-45" style={{ backgroundColor: "#1C1C1C" }} />
          </div>
        </div>
      )}

      {/* Ground shadow stays put while the body moves above it */}
      <div
        aria-hidden
        className="absolute left-1/2"
        style={{
          bottom: 6,
          transform: "translateX(-50%)",
          width: size * 0.52,
          height: 12,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(28,28,28,0.13), transparent 70%)",
        }}
      />

      {/* lean (cursor) → hop (WAAPI) → breathe (constant) → body */}
      <div ref={leanRef} style={{ transition: "transform 320ms var(--ease-out-quart)", willChange: "transform" }}>
        <div ref={hopRef}>
          <div
            className={asleep ? "companion-breathe-slow" : "companion-breathe"}
            style={{ transformOrigin: "50% 100%" }}
          >
            <div className="relative cursor-pointer" style={{ width: size, height: size }} onClick={onTickle}>
              {/* All poses stay mounted and crossfade — no decode flash,
                  no size jump, the breathing never skips a beat */}
              {ALL_POSES.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p}
                  src={`/peko/peko-${p}.webp`}
                  alt=""
                  width={size}
                  height={size}
                  draggable={false}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: size,
                    height: size,
                    objectFit: "contain",
                    opacity: pose === p ? 1 : 0,
                    transition: "opacity 180ms var(--ease-out-quart)",
                  }}
                />
              ))}

              {/* Closed eyes — eyelid cover + a soft lash curve, so blinking
                  and sleeping read as real closed eyes, not erased ones */}
              {pose === "idle" &&
                meta.eyes.map((eye, i) => (
                  <span key={i}>
                    <span
                      style={{
                        position: "absolute",
                        left: `${eye.x - eye.rx}%`,
                        top: `${eye.y - eye.ry}%`,
                        width: `${eye.rx * 2}%`,
                        height: `${eye.ry * 2}%`,
                        borderRadius: "50%",
                        backgroundColor: meta.face,
                        filter: "blur(0.8px)",
                        transform: `scaleY(${eyesClosed ? 1 : 0})`,
                        transformOrigin: "50% 22%",
                        transition: "transform 100ms var(--ease-out-quart)",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        left: `${eye.x - eye.rx * 1.05}%`,
                        top: `${eye.y - eye.ry * 0.2}%`,
                        width: `${eye.rx * 2.1}%`,
                        height: `${eye.ry * 1.05}%`,
                        borderBottom: `${Math.max(2, size * 0.016)}px solid #4B4442`,
                        borderRadius: "0 0 100% 100%",
                        opacity: eyesClosed ? 1 : 0,
                        transition: "opacity 90ms ease",
                      }}
                    />
                  </span>
                ))}

              {/* z z z while napping */}
              {asleep && (
                <span className="absolute" style={{ left: "66%", top: "6%" }}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="companion-zzz absolute font-bold"
                      style={{ animationDelay: `${i * 0.9}s`, fontSize: 10 + i * 3, color: "#38B39E", left: i * 8 }}
                    >
                      z
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
