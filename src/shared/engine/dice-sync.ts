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
  // Ease-out cubic into a soft settle; spin decays hard near the end
  const ease = 1 - Math.pow(1 - t, 3);
  const settle = Math.pow(1 - t, 2);
  const spins = 5.5 + (seed % 5) * 0.35 + dieIndex * 0.55;
  const spin = settle * spins;
  const base = seed * (dieIndex === 0 ? 0.0013 : 0.0017);
  const wobble = Math.sin(t * Math.PI * (4 + dieIndex)) * settle * 0.35;
  const rx = base * 11 + spin * Math.PI * 2 * (1.55 + dieIndex * 0.28) + wobble;
  const ry = base * 7 + spin * Math.PI * 2 * (1.15 + dieIndex * 0.22) - wobble * 0.6;
  const rz = base * 5 + spin * Math.PI * 2 * (0.85 + dieIndex * 0.18);
  // Arc bounce that dampens to resting height 0.55
  const bounce =
    Math.abs(Math.sin(t * Math.PI * 2.6 + dieIndex * 0.4)) * settle * 1.55;
  const xOff =
    (dieIndex === 0 ? -1.15 : 1.15) +
    Math.sin(t * 10 + dieIndex * 1.7) * 0.18 * settle * (dieIndex === 0 ? 1 : -1);
  // Slight lift at start then settle
  const launch = (1 - ease) * 0.9;
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
