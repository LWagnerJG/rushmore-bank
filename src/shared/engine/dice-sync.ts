/**
 * Deterministic time-based dice animation helpers (shared seed + timestamps).
 */
import { RULES } from "../rules";

export function newRollId(): string {
  return `roll-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function animSeedFrom(rollId: string, d1: number, d2: number): number {
  let h = 2166136261;
  const s = `${rollId}:${d1}x${d2}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function diceAnimWindow(now = Date.now()): {
  animStartedAt: number;
  animSettleAt: number;
} {
  return {
    animStartedAt: now,
    animSettleAt: now + RULES.diceAnimMs,
  };
}

/** Absolute euler offsets during tumble — frame-rate independent. */
export function tumblePose(
  progress01: number,
  seed: number,
  dieIndex: 0 | 1,
): { rx: number; ry: number; rz: number; y: number; x: number } {
  const t = Math.min(1, Math.max(0, progress01));
  const ease = 1 - Math.pow(1 - t, 3);
  const spin = (1 - ease) * (8 + (seed % 7) + dieIndex);
  const base = seed * (dieIndex === 0 ? 0.0013 : 0.0017);
  const rx = base * 11 + spin * Math.PI * 2 * (1.7 + dieIndex * 0.3);
  const ry = base * 7 + spin * Math.PI * 2 * (1.3 + dieIndex * 0.2);
  const rz = base * 5 + spin * Math.PI * 2 * (0.9 + dieIndex * 0.15);
  const bounce = Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t) * 1.4;
  const xOff =
    (dieIndex === 0 ? -1.1 : 1.1) +
    Math.sin(t * 12 + dieIndex) * 0.15 * (1 - t) * (dieIndex === 0 ? 1 : -1);
  return { rx, ry, rz, y: 0.55 + bounce * (dieIndex === 0 ? 1 : 0.9), x: xOff };
}

export function animProgress(
  now: number,
  startedAt: number,
  settleAt: number,
): number {
  if (settleAt <= startedAt) return 1;
  return Math.min(1, Math.max(0, (now - startedAt) / (settleAt - startedAt)));
}
