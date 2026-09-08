/**
 * Scramble faces during tumble only.
 *
 * Contract:
 * - Scramble values are cosmetic anticipation — never authoritative.
 * - Settled paint uses server d1/d2 exclusively (see dice-present).
 * - Clients must hard-cut from scramble → auth faces (no coast/lerp).
 */

import { mulberry32 } from "./rng";

/** Deterministic face 1–6 for a die at scramble tick (synced across clients). */
export function scrambleFaceAt(
  seed: number,
  dieIndex: 0 | 1,
  tick: number,
): number {
  const rng = mulberry32(
    (seed >>> 0) ^
      Math.imul(dieIndex + 1, 0x9e3779b9) ^
      Math.imul(tick + 1, 0x85ebca6b),
  );
  return 1 + Math.floor(rng() * 6);
}

/** Tick cadence for visible face flips (~12–14 Hz). */
export const SCRAMBLE_TICK_MS = 75;

/**
 * How many scramble ticks fit in a tumble window.
 * Used by tests — presentation stops scramble the instant phase is settled.
 */
export function scrambleTickCount(
  startedAt: number,
  settleAt: number,
  now: number,
): number {
  if (now <= startedAt) return 0;
  const end = Math.min(now, settleAt);
  return Math.max(0, Math.floor((end - startedAt) / SCRAMBLE_TICK_MS));
}
