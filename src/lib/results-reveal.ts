/** Total reveal budget — must stay under 2s including last count-up. */
export const RESULTS_REVEAL_BUDGET_MS = 1800;

export type RevealSchedule = {
  stepMs: number;
  countMs: number;
  totalMs: number;
};

/**
 * Timing for N players revealed last→first with a short count-up each.
 * Caps step length so the whole sequence stays under the budget.
 */
export function revealSchedule(
  count: number,
  budgetMs = RESULTS_REVEAL_BUDGET_MS,
): RevealSchedule {
  if (count <= 0) return { stepMs: 0, countMs: 0, totalMs: 0 };
  const stepMs = Math.max(120, Math.min(400, Math.floor(budgetMs / count)));
  const countMs = Math.min(280, Math.max(80, Math.floor(stepMs * 0.65)));
  return { stepMs, countMs, totalMs: stepMs * count };
}

/** Ease-out count-up value at progress t ∈ [0,1]. */
export function countUpValue(target: number, t: number): number {
  if (target <= 0) return 0;
  const clamped = Math.min(1, Math.max(0, t));
  const eased = 1 - (1 - clamped) * (1 - clamped);
  return Math.round(target * eased);
}

/** Reveal order indices into a high→low ranked list (last place first). */
export function revealOrderIndices(count: number): number[] {
  return Array.from({ length: count }, (_, i) => count - 1 - i);
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
