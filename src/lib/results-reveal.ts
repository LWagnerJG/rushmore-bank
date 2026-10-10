/** Total reveal budget — under ~2.5s including last count-up + winner sweep. */
export const RESULTS_REVEAL_BUDGET_MS = 2400;

/** Winner green sweep duration (transform/opacity only). */
export const WINNER_SWEEP_MS = 280;

const REVEAL_DONE_PREFIX = "beans:results-reveal:done:";

/** Fallback when sessionStorage is unavailable (SSR / locked storage). */
const revealDoneMemory = new Set<string>();

export type RevealSchedule = {
  stepMs: number;
  countMs: number;
  totalMs: number;
};

export type RankedStanding = {
  id: string;
  name: string;
  stones: number;
  /** Competition rank (1-based); ties share a rank. */
  rank: number;
  /** True when tied for the highest stone total. */
  isWinner: boolean;
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
  // Leave room for the final winner sweep after the last count-up.
  const usable = Math.max(400, budgetMs - WINNER_SWEEP_MS);
  const stepMs = Math.max(120, Math.min(400, Math.floor(usable / count)));
  const countMs = Math.min(280, Math.max(80, Math.floor(stepMs * 0.65)));
  return { stepMs, countMs, totalMs: stepMs * (count - 1) + countMs };
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

/**
 * Stable high→low standings with competition ranks.
 * Ties share a rank; the next rank skips (1,2,2,4).
 */
export function rankStandings(
  players: ReadonlyArray<{ id: string; name: string; stones: number }>,
): RankedStanding[] {
  const sorted = [...players].sort((a, b) => {
    if (b.stones !== a.stones) return b.stones - a.stones;
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
  const top = sorted[0]?.stones ?? 0;
  let lastStones: number | null = null;
  let rank = 0;
  return sorted.map((p, i) => {
    if (lastStones === null || p.stones !== lastStones) {
      rank = i + 1;
      lastStones = p.stones;
    }
    return {
      id: p.id,
      name: p.name,
      stones: p.stones,
      rank,
      isWinner: sorted.length > 0 && p.stones === top,
    };
  });
}

/**
 * Idempotent reveal identity for a game — not phaseRevision (reconnects bump that).
 * Rematch resets `createdAt`, so a new game gets a fresh key.
 */
export function resultsRevealKey(opts: {
  code: string;
  createdAt: number;
  phase: string;
  topicRound: number;
}): string {
  return `${opts.code}:${opts.createdAt}:${opts.phase}:${opts.topicRound}`;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function hasRevealCompleted(revealKey: string): boolean {
  if (revealDoneMemory.has(revealKey)) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(REVEAL_DONE_PREFIX + revealKey) === "1";
  } catch {
    return false;
  }
}

export function markRevealCompleted(revealKey: string): void {
  revealDoneMemory.add(revealKey);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(REVEAL_DONE_PREFIX + revealKey, "1");
  } catch {
    /* private mode / quota — memory Set still covers this tab session */
  }
}

/** Test helper — clears a single key. */
export function clearRevealCompleted(revealKey: string): void {
  revealDoneMemory.delete(revealKey);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(REVEAL_DONE_PREFIX + revealKey);
  } catch {
    /* ignore */
  }
}
