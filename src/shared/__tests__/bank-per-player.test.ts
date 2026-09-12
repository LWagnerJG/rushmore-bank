import { describe, expect, it } from "vitest";
import { applyDiceRoll } from "../engine/dice";
import { maxWager, applyWager, wagerFromPreset } from "../engine/wager";
import { snakeDraftOrder, totalDraftPicks } from "../engine/snake";

/**
 * Personal BANK: keep rolling until Bank or bust, then next seat.
 * Everyone with pot ≥ 1 re-enters each topic. Any 7 busts.
 */
describe("personal BANK circuit", () => {
  it("does not pass after every throw — only after bank/bust", () => {
    const seatOrder = ["a", "b", "c"];
    let seat = 0;
    const active = new Set(["a", "b", "c"]);
    const rolls: Record<string, number> = { a: 0, b: 0, c: 0 };
    const pots: Record<string, number> = { a: 20, b: 0, c: 30 };

    // a takes three non-seven throws then banks
    for (let i = 0; i < 3; i++) {
      const pid = seatOrder[seat]!;
      rolls[pid]! += 1;
      const o = applyDiceRoll(pots[pid]!, { d1: 1, d2: 2 }, rolls[pid]!);
      expect(o.busted).toBe(false);
      pots[pid] = o.potAfter;
    }
    expect(seat).toBe(0);
    expect(rolls.a).toBe(3);
    active.delete("a");
    seat = (seat + 1) % seatOrder.length;

    // b still gets a continuous turn when they have a pot
    expect(seatOrder[seat]).toBe("b");
    rolls.b! += 1;
    const o = applyDiceRoll(pots.b!, { d1: 2, d2: 3 }, rolls.b!);
    pots.b = o.potAfter;
    expect(pots.b).toBeGreaterThan(0);
    expect(active.has("c")).toBe(true);
  });

  it("snake draft still covers 4 picks for N=2..10", () => {
    for (let n = 2; n <= 10; n++) {
      expect(snakeDraftOrder(n, 4, 0)).toHaveLength(totalDraftPicks(n));
    }
  });
});

describe("wager + any-seven bust", () => {
  it("max wager is full balance E+B", () => {
    expect(maxWager(40, 100)).toBe(140);
    expect(wagerFromPreset("all_new", 40, 30)).toBe(40);
    const locked = applyWager({ banked: 30, earned: 40, wager: 50 });
    expect(locked.pot).toBe(50);
    expect(locked.protected).toBe(20);
  });

  it("first personal roll totaling 7 busts", () => {
    const first = applyDiceRoll(10, { d1: 3, d2: 4 }, 1);
    expect(first.busted).toBe(true);
    expect(first.potAfter).toBe(0);
  });
});
