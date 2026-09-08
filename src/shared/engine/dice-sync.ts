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
  // Smoothstep into a soft coast; spin decays hard near the end
  const ease = t * t * (3 - 2 * t);
  const settle = Math.pow(1 - t, 2.15);
  const spins = 5.2 + (seed % 5) * 0.32 + dieIndex * 0.5;
  const spin = settle * spins;
  const base = seed * (dieIndex === 0 ? 0.0013 : 0.0017);
  const wobble = Math.sin(t * Math.PI * (3.6 + dieIndex)) * settle * 0.28;
  const rx = base * 11 + spin * Math.PI * 2 * (1.5 + dieIndex * 0.26) + wobble;
  const ry =
    base * 7 + spin * Math.PI * 2 * (1.12 + dieIndex * 0.2) - wobble * 0.55;
  const rz = base * 5 + spin * Math.PI * 2 * (0.82 + dieIndex * 0.16);
  const bounce =
    Math.abs(Math.sin(t * Math.PI * 2.35 + dieIndex * 0.35)) * settle * 1.35;
  const xOff =
    (dieIndex === 0 ? -1.15 : 1.15) +
    Math.sin(t * 8.5 + dieIndex * 1.6) *
      0.14 *
      settle *
      (dieIndex === 0 ? 1 : -1);
  const launch = (1 - ease) * 0.85;
  return {
    rx,
    ry,
    rz,
    y: 0.55 + bounce + launch,
    x: xOff,
  };
}

export function animProgress(
  now: number,
  startedAt: number,
  settleAt: number,
): number {
  if (settleAt <= startedAt) return 1;
  return Math.min(1, Math.max(0, (now - startedAt) / (settleAt - startedAt)));
}
