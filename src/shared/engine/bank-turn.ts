/**
 * Per-player BANK mini-rounds within a topic's DICE phase.
 *
 * After wagers, each active player gets a full personal sequence
 * (safe rolls → risk rolls → Pull Out / bust) before the seat advances.
 * Waiting players may still bank without advancing the current banker.
 */

/** Find the next seat index (wrapping) whose player is still dice-active. */
export function nextActiveBankSeat(opts: {
  seatOrder: string[];
  diceActiveIds: string[];
  fromSeat: number;
}): number | null {
  const n = opts.seatOrder.length;
  if (n === 0 || opts.diceActiveIds.length === 0) return null;
  for (let step = 1; step <= n; step++) {
    const seat = (opts.fromSeat + step) % n;
    const pid = opts.seatOrder[seat];
    if (pid && opts.diceActiveIds.includes(pid)) return seat;
  }
  return null;
}

/** True when the current roller still has a live pot and should keep rolling. */
export function shouldContinuePersonalBank(opts: {
  rollerId: string | null | undefined;
  diceActiveIds: string[];
}): boolean {
  if (!opts.rollerId) return false;
  return opts.diceActiveIds.includes(opts.rollerId);
}

/** Soft budget: time alone; checked at personal-bank boundaries / post-settle. */
export function isDiceSoftBudgetExceeded(opts: {
  roundStartedAt: number | null;
  now?: number;
  softBudgetMs: number;
}): boolean {
  if (opts.roundStartedAt == null) return false;
  const now = opts.now ?? Date.now();
  return now - opts.roundStartedAt >= opts.softBudgetMs;
}

/** Ordered queue of remaining bankers starting with the current seat. */
export function bankQueue(opts: {
  seatOrder: string[];
  diceActiveIds: string[];
  currentSeat: number;
}): string[] {
  const n = opts.seatOrder.length;
  if (n === 0) return [];
  const out: string[] = [];
  for (let step = 0; step < n; step++) {
    const seat = (opts.currentSeat + step) % n;
    const pid = opts.seatOrder[seat];
    if (pid && opts.diceActiveIds.includes(pid)) out.push(pid);
  }
  return out;
}
