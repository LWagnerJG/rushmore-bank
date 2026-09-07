/**
 * Pure banking helpers for dice Pull Out — waiting vs current roller.
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

export type PullOutKind = "current_roller" | "waiting_player";

/**
 * Decide whether a Pull Out may proceed and which path to take.
 * Own committed roll blocks banking until settle.
 * Zero pots may bank (sit out) — everyone re-enters each topic.
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

  const isCurrent = opts.currentRollerId === opts.playerId;

  if (isCurrent) {
    if (opts.diceSubphase === "COMMITTED") {
      return { ok: false, reason: "Roll already committed — wait for settle" };
    }
    if (
      opts.diceSubphase !== "READY" &&
      opts.diceSubphase !== "COOLDOWN"
    ) {
      return { ok: false, reason: "Cannot pull out now" };
    }
    return { ok: true, kind: "current_roller" };
  }

  // Waiting players may bank during another player's cooldown, ready, or animation.
  return { ok: true, kind: "waiting_player" };
}
