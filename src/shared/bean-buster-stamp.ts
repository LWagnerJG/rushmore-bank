/**
 * Full-viewport BEAN BUSTER rubber-stamp cue timings.
 * Visual only — does not pause dice timers or advance seats.
 */

/** Hold at rest after the slam, before snap-away (ms). */
export const BEAN_BUSTER_STAMP_HOLD_MS = 1400;

/** Scale slam duration (ms) — 1.6 → overshoot → 1. */
export const BEAN_BUSTER_STAMP_SLAM_MS = 120;

/** Screen-shake window on the stamp layer (ms). */
export const BEAN_BUSTER_STAMP_SHAKE_MS = 250;

/** Quick snap-away after hold (ms). */
export const BEAN_BUSTER_STAMP_OUT_MS = 80;

/** Total visible lifetime including slam + hold + out. */
export const BEAN_BUSTER_STAMP_TOTAL_MS =
  BEAN_BUSTER_STAMP_HOLD_MS + BEAN_BUSTER_STAMP_OUT_MS;

/** Stable rotation in [-12, -6] deg from a roll id. */
export function beanBusterStampRotationDeg(rollId: string): number {
  let h = 2166136261;
  for (let i = 0; i < rollId.length; i++) {
    h ^= rollId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const t = (h >>> 0) % 1000;
  return -12 + (t / 999) * 6;
}

/** Small caption under the stamp — e.g. "Sam got busted". */
export function beanBusterStampCaption(
  rollerName: string,
  isYou: boolean,
): string {
  const name = isYou ? "You" : rollerName.trim() || "Player";
  return `${name} got busted`;
}
