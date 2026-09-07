import { RULES } from "../rules";

/** max_wager = E + min(25, B) */
export function maxWager(earned: number, banked: number): number {
  const E = Math.max(0, Math.floor(earned));
  const B = Math.max(0, Math.floor(banked));
  return E + Math.min(RULES.earlierWagerCap, B);
}

export type WagerPreset = "keep_all" | "half_new" | "all_new" | "custom";

export function wagerFromPreset(
  preset: WagerPreset,
  earned: number,
  banked: number,
  customAmount?: number,
): number {
  const E = Math.max(0, Math.floor(earned));
  const max = maxWager(E, banked);
  switch (preset) {
    case "keep_all":
      return 0;
    case "half_new":
      return Math.min(max, Math.floor(E / 2));
    case "all_new":
      return Math.min(max, E);
    case "custom": {
      const w = Math.max(0, Math.floor(customAmount ?? 0));
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
  const B = Math.max(0, Math.floor(opts.banked));
  const E = Math.max(0, Math.floor(opts.earned));
  const max = maxWager(E, B);
  const W = Math.min(max, Math.max(0, Math.floor(opts.wager)));
  const protectedBal = B + E - W;
  return {
    protected: protectedBal,
    pot: W,
    /** After locking wager: banked becomes protected; pot is separate */
    bankedAfter: protectedBal,
  };
}
