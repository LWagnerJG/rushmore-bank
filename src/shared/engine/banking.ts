/**
 * Pure banking helpers for dice Bank — current roller only.
 */
export interface BankResult {
  stonesAfter: number;
  potBanked: number;
}

export function bankPotIntoProtected(opts: {
  protectedStones: number;
  pot: number;
}): BankResult {
  const potBanked = Math.max(0, Math.floor(opts.pot));
  return {
    potBanked,
    stonesAfter: opts.protectedStones + potBanked,
  };
}

export type PullOutKind = "current_roller";

/**
 * Decide whether Bank may proceed.
 * Only the current roller may bank; waiting players watch the table.
 * Own committed roll blocks banking until settle.
 * Zero pots may bank (exit with protected only).
 */
export function classifyPullOut(opts: {
  phase: string;
  diceSubphase: string;
  playerId: string;
  currentRollerId: string | null;
  diceActiveIds: string[];
  pot: number;
}): { ok: true; kind: PullOutKind } | { ok: false; reason: string } {
  if (opts.phase !== "DICE") return { ok: false, reason: "Wrong phase" };
  if (!opts.diceActiveIds.includes(opts.playerId)) {
    return { ok: false, reason: "Not active" };
  }

  if (opts.currentRollerId !== opts.playerId) {
    return { ok: false, reason: "Wait your turn" };
  }

  if (opts.diceSubphase === "COMMITTED") {
    return { ok: false, reason: "Roll already committed — wait for settle" };
  }
  if (
    opts.diceSubphase !== "READY" &&
    opts.diceSubphase !== "COOLDOWN"
  ) {
    return { ok: false, reason: "Cannot bank now" };
  }
  return { ok: true, kind: "current_roller" };
}
