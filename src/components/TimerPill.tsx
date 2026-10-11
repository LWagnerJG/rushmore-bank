"use client";

import { useLayoutEffect, useRef } from "react";
import { watchSecondsLeft } from "@/lib/countdown";
import { playSfx } from "@/lib/sfx";

/**
 * The one in-game clock: a quiet pill that turns coral by color only (no
 * pulse) in its last seconds. Seconds are painted straight into the DOM once
 * per second, so ticking never re-renders React. role="timer" is silent while
 * it ticks; the hidden live region speaks once, when it turns urgent.
 * Soft WebAudio ticks fire for the last 5 seconds when Sound is on.
 */
export function TimerPill({
  until,
  label,
  paused = false,
  urgentAt = 10,
  announce = true,
  tickLastSeconds = 5,
}: {
  until: number | null;
  /** What the clock is for, spoken with the time ("Vote: 12 seconds"). */
  label: string;
  paused?: boolean;
  urgentAt?: number;
  announce?: boolean;
  /** Play a quiet tick each second while left ≤ this (0 disables). */
  tickLastSeconds?: number;
}) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const digitsRef = useRef<HTMLSpanElement>(null);
  const cueRef = useRef<HTMLSpanElement>(null);

  // Layout effect: a new deadline paints before the frame, never the old count.
  useLayoutEffect(() => {
    const pill = pillRef.current;
    const digits = digitsRef.current;
    const cue = announce ? cueRef.current : null;
    if (!pill || !digits) return;
    let wasUrgent: boolean | null = null;
    let lastLeft: number | null = null;
    const paint = (left: number) => {
      const urgent = !paused && left > 0 && left <= urgentAt;
      digits.textContent = paused ? "‖" : `${left}s`;
      pill.setAttribute(
        "aria-label",
        paused ? `${label}: paused` : `${label}: ${left} seconds`,
      );
      if (
        !paused &&
        tickLastSeconds > 0 &&
        left > 0 &&
        left <= tickLastSeconds &&
        left !== lastLeft
      ) {
        playSfx("timer_tick");
      }
      lastLeft = left;
      // Rewriting live-region text re-announces it, so only touch it on a flip.
      if (urgent === wasUrgent) return;
      wasUrgent = urgent;
      pill.classList.toggle("timer-pill-urgent", urgent);
      if (cue) cue.textContent = urgent ? `${label}: almost out of time` : "";
    };
    if (paused) {
      paint(0);
      return;
    }
    return watchSecondsLeft(until, paint);
  }, [until, paused, label, urgentAt, announce, tickLastSeconds]);

  return (
    <span ref={pillRef} role="timer" className="timer-pill tabular-nums">
      <span ref={digitsRef} aria-hidden="true" />
      {announce ? (
        <span ref={cueRef} className="sr-only" aria-live="polite" />
      ) : null}
    </span>
  );
}
