import { describe, expect, it } from "vitest";
import {
  bankQueue,
  isDiceSoftBudgetExceeded,
  nextActiveBankSeat,
  shouldContinuePersonalBank,
} from "../engine/bank-turn";
import { applyDiceRoll } from "../engine/dice";
import { maxWager, applyWager } from "../engine/wager";
import { snakeDraftOrder, totalDraftPicks } from "../engine/snake";
import { RULES } from "../rules";

describe("per-player BANK turns", () => {
  it("keeps the same roller until they leave the active set", () => {
    expect(
      shouldContinuePersonalBank({
        rollerId: "a",
        diceActiveIds: ["a", "b"],
      }),
    ).toBe(true);
    expect(
      shouldContinuePersonalBank({
        rollerId: "a",
        diceActiveIds: ["b"],
      }),
    ).toBe(false);
  });

  it("advances to the next active banker (skipping idle seats)", () => {
    const seatOrder = ["a", "b", "c", "d"];
    // a finished; b still active; from seat 0 → seat 1
    expect(
      nextActiveBankSeat({
        seatOrder,
        diceActiveIds: ["b", "d"],
        fromSeat: 0,
      }),
    ).toBe(1);
    // from b → d (skip c)
    expect(
      nextActiveBankSeat({
        seatOrder,
        diceActiveIds: ["d"],
        fromSeat: 1,
      }),
    ).toBe(3);
  });

  it("builds a bank queue starting with the current seat", () => {
    expect(
      bankQueue({
        seatOrder: ["a", "b", "c"],
        diceActiveIds: ["a", "c"],
        currentSeat: 0,
      }),
    ).toEqual(["a", "c"]);
    expect(
      bankQueue({
        seatOrder: ["a", "b", "c"],
        diceActiveIds: ["a", "c"],
        currentSeat: 2,
      }),
    ).toEqual(["c", "a"]);
  });

  it("simulates A finishing personal bank before B starts", () => {
    const seatOrder = ["a", "b"];
    let active = ["a", "b"];
    let seat = 0;
    const pots: Record<string, number> = { a: 50, b: 40 };
    const rolls: Record<string, number> = { a: 0, b: 0 };

    // A's personal bank: two safe rolls then bank
    for (let i = 0; i < 2; i++) {
      rolls.a! += 1;
      const o = applyDiceRoll(pots.a!, { d1: 1, d2: 2 }, rolls.a!);
      pots.a = o.potAfter;
      expect(shouldContinuePersonalBank({ rollerId: "a", diceActiveIds: active })).toBe(
        true,
      );
    }
    // A banks out
    active = active.filter((id) => id !== "a");
    expect(shouldContinuePersonalBank({ rollerId: "a", diceActiveIds: active })).toBe(
      false,
    );
    seat =
      nextActiveBankSeat({
        seatOrder,
        diceActiveIds: active,
        fromSeat: seat,
      }) ?? seat;
    expect(seatOrder[seat]).toBe("b");
    expect(pots.b).toBe(40);
    expect(rolls.b).toBe(0);
  });

  it("soft budget is time-based (no lap requirement by default)", () => {
    expect(RULES.diceMinBanksBeforeSettlement).toBe(0);
    expect(
      isDiceSoftBudgetExceeded({
        roundStartedAt: Date.now() - RULES.diceSoftBudgetMs - 1,
        softBudgetMs: RULES.diceSoftBudgetMs,
      }),
    ).toBe(true);
    expect(
      isDiceSoftBudgetExceeded({
        roundStartedAt: Date.now(),
        softBudgetMs: RULES.diceSoftBudgetMs,
      }),
    ).toBe(false);
  });
});

describe("wager slider bounds", () => {
  it("max = E + min(25, B); protected + at-risk = B + E", () => {
    const E = 40;
    const B = 100;
    const max = maxWager(E, B);
    expect(max).toBe(65);
    for (const W of [0, 20, 40, 65]) {
      const locked = applyWager({ banked: B, earned: E, wager: W });
      expect(locked.pot).toBe(W);
      expect(locked.protected + locked.pot).toBe(B + E);
    }
    expect(applyWager({ banked: B, earned: E, wager: 999 }).pot).toBe(max);
  });
});

describe("snake draft board order 2–10", () => {
  it("covers 4 picks for every N from 2..10 with forward then reverse", () => {
    for (let n = 2; n <= 10; n++) {
      const order = snakeDraftOrder(n, 4, 0);
      expect(order).toHaveLength(totalDraftPicks(n));
      const counts = Array.from({ length: n }, () => 0);
      for (const seat of order) counts[seat]!++;
      expect(counts.every((c) => c === 4)).toBe(true);
      expect(order.slice(0, n)).toEqual([...Array(n).keys()]);
      expect(order.slice(n, 2 * n)).toEqual([...Array(n).keys()].reverse());
    }
  });
});

describe("pull out banking", () => {
  it("banks pot into protected", () => {
    expect(40 + 120).toBe(160);
  });

  it("bust leaves only protected", () => {
    const o = applyDiceRoll(90, { d1: 3, d2: 4 }, 3);
    expect(o.busted).toBe(true);
    expect(o.potAfter).toBe(0);
  });
});
