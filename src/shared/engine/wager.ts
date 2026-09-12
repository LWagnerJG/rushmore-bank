function wholeBeans(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** Every bean currently owned is available; no hidden cap on earlier winnings. */
export function maxWager(earned: number, banked: number): number {
  const E = wholeBeans(earned);
  const B = wholeBeans(banked);
  return E + B;
}

/**
 * Clamp a wager for lock-in.
 * When the player has at least 1 bean available, wager must be ≥ 1 (no zero lock-in).
 * When max is 0 (nothing to risk), the only legal wager is 0.
 */
export function clampWager(
  wager: number,
  earned: number,
  banked: number,
): number {
  const max = maxWager(earned, banked);
  if (max <= 0) return 0;
  return Math.min(max, Math.max(1, wholeBeans(wager)));
}

export type WagerPreset = "keep_all" | "half_new" | "all_new" | "custom";

export function wagerFromPreset(
  preset: WagerPreset,
  earned: number,
  banked: number,
  customAmount?: number,
): number {
  const E = wholeBeans(earned);
  const max = maxWager(E, banked);
  let raw: number;
  switch (preset) {
    case "keep_all":
      // Minimum risk when anything is available — never advertise a 0 lock-in.
      raw = max >= 1 ? 1 : 0;
      break;
    case "half_new":
      raw = Math.min(max, Math.floor(E / 2));
      break;
    case "all_new":
      raw = Math.min(max, E);
      break;
    case "custom": {
      raw = wholeBeans(customAmount ?? 0);
      break;
    }
  }
  return clampWager(raw, E, banked);
}

/** protected = B + E − W; pot = W. Integers only. Enforces min wager of 1 when max ≥ 1. */
export function applyWager(opts: {
  banked: number;
  earned: number;
  wager: number;
}): { protected: number; pot: number; bankedAfter: number } {
  const B = wholeBeans(opts.banked);
  const E = wholeBeans(opts.earned);
  const W = clampWager(opts.wager, E, B);
  const protectedBal = B + E - W;
  return {
    protected: protectedBal,
    pot: W,
    /** After locking wager: banked becomes protected; pot is separate */
    bankedAfter: protectedBal,
  };
}
