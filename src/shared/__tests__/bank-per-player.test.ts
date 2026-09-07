import { describe, expect, it } from "vitest";
import { applyDiceRoll } from "../engine/dice";
import { maxWager, applyWager, wagerFromPreset } from "../engine/wager";
import { snakeDraftOrder, totalDraftPicks } from "../engine/snake";
import { RULES } from "../rules";

/**
 * Round-robin BANK: one roll then pass. Everyone re-enters each topic
 * (including zero wagers) with two safe personal rolls.
 */
describe("round-robin BANK circuit", () => {
  it("advances seat after every throw (not solo mini-rounds)", () => {
    const seatOrder = ["a", "b", "c"];
    let seat = 0;
    const active = new Set(["a", "b", "c"]);
    const rolls: Record<string, number> = { a: 0, b: 0, c: 0 };
    const pots: Record<string, number> = { a: 20, b: 0, c: 30 };

    // Simulate three passes around the table (one roll each when active)
    for (let i = 0; i < 6; i++) {
      const pid = seatOrder[seat]!;
      if (active.has(pid)) {
        rolls[pid]! += 1;
        const o = applyDiceRoll(pots[pid]!, { d1: 1, d2: 2 }, rolls[pid]!);
        pots[pid] = o.potAfter;
      }
      seat = (seat + 1) % seatOrder.length;
    }

    expect(rolls.a).toBe(2);
    expect(rolls.b).toBe(2);
    expect(rolls.c).toBe(2);
    // Zero wager still got safe rolls
    expect(pots.b).toBeGreaterThan(0);
  });

  it("snake draft still covers 4 picks for N=2..10", () => {
    for (let n = 2; n <= 10; n++) {
      expect(snakeDraftOrder(n, 4, 0)).toHaveLength(totalDraftPicks(n));
    }
  });
});

describe("wager + safe rolls", () => {
  it("max wager is full balance E+B", () => {
    expect(maxWager(40, 100)).toBe(140);
    expect(wagerFromPreset("all_new", 40, 30)).toBe(40);
    const locked = applyWager({ banked: 30, earned: 40, wager: 50 });
    expect(locked.pot).toBe(50);
    expect(locked.protected).toBe(20);
  });

  it("keeps two safe personal rolls", () => {
    expect(RULES.safePersonalRolls).toBe(2);
    const safe = applyDiceRoll(10, { d1: 3, d2: 4 }, 1);
    expect(safe.busted).toBe(false);
    expect(safe.potAfter).toBe(10 + RULES.sevenSafeBonus);
  });
});
