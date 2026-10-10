"use client";

import { useLayoutEffect, useState } from "react";
import { watchSecondsLeft } from "@/lib/countdown";

/** Whole seconds until `until` (epoch ms); 0 when unset or past. A layout
 * effect so a new deadline never paints a frame of the previous count. */
export function useSecondsLeft(until: number | null): number {
  const [left, setLeft] = useState(0);
  useLayoutEffect(() => watchSecondsLeft(until, setLeft), [until]);
  return left;
}

/** The one in-game clock: a quiet pill that turns coral by color only (no
 * pulse) in its last seconds. role="timer" is not announced while it ticks;
 * the hidden live region speaks once, when it turns urgent. */
export function TimerPill({
  until,
  label,
  paused = false,
  urgentAt = 10,
  announce = true,
}: {
  until: number | null;
  /** What the clock is for, spoken with the time ("Vote: 12 seconds"). */
  label: string;
  paused?: boolean;
  urgentAt?: number;
  announce?: boolean;
}) {
  const left = useSecondsLeft(until);
  const urgent = !paused && left > 0 && left <= urgentAt;
  return (
    <span
      role="timer"
      aria-label={paused ? `${label}: paused` : `${label}: ${left} seconds`}
      className={`timer-pill tabular-nums${urgent ? " timer-pill-urgent" : ""}`}
    >
      <span aria-hidden="true">{paused ? "‖" : `${left}s`}</span>
      {announce ? (
        <span className="sr-only" aria-live="polite">
          {urgent ? `${label}: almost out of time` : ""}
        </span>
      ) : null}
    </span>
  );
}
