function wholeBeans(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** Every bean currently owned is available; no hidden cap on earlier winnings. */
export function maxWager(earned: number, banked: number): number {
  const E = wholeBeans(earned);
  const B = wholeBeans(banked);
  return E + B;
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
  switch (preset) {
    case "keep_all":
      return 0;
    case "half_new":
      return Math.min(max, Math.floor(E / 2));
    case "all_new":
      return Math.min(max, E);
    case "custom": {
      const w = wholeBeans(customAmount ?? 0);
      return Math.min(max, w);
    }
  }
}

/** protected = B + E − W; pot = W. Integers only. */
export function applyWager(opts: {
  banked: number;
  earned: number;
  wager: number;
}): { protected: number; pot: number; bankedAfter: number } {
  const B = wholeBeans(opts.banked);
  const E = wholeBeans(opts.earned);
  const max = maxWager(E, B);
  const W = Math.min(max, wholeBeans(opts.wager));
  const protectedBal = B + E - W;
  return {
    protected: protectedBal,
    pot: W,
    /** After locking wager: banked becomes protected; pot is separate */
    bankedAfter: protectedBal,
  };
}
