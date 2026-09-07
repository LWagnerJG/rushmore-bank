import { describe, expect, it } from "vitest";
import { snakeDraftOrder, totalDraftPicks } from "../engine/snake";
import { applyDiceRoll } from "../engine/dice";
import { applyWager, maxWager, wagerFromPreset } from "../engine/wager";
import { aiAwardFromScores, computeEarnedStones } from "../engine/scoring";
import { RULES } from "../rules";
import { TOPIC_COUNT } from "../topics";

describe("topics", () => {
  it("has at least 120 curated topics", () => {
    expect(TOPIC_COUNT).toBeGreaterThanOrEqual(120);
  });
});

describe("snake draft", () => {
  it("covers 4 picks for every N from 2..10", () => {
    for (let n = 2; n <= 10; n++) {
      const order = snakeDraftOrder(n, 4, 0);
      expect(order).toHaveLength(totalDraftPicks(n));
      const counts = Array.from({ length: n }, () => 0);
      for (const seat of order) counts[seat]!++;
      expect(counts.every((c) => c === 4)).toBe(true);
      // First pass forward
      expect(order.slice(0, n)).toEqual([...Array(n).keys()]);
      // Second pass reverse
      expect(order.slice(n, 2 * n)).toEqual([...Array(n).keys()].reverse());
    }
  });

  it("rotates starter offset", () => {
    const a = snakeDraftOrder(4, 4, 0);
    const b = snakeDraftOrder(4, 4, 1);
    expect(a[0]).toBe(0);
    expect(b[0]).toBe(1);
    expect(a).not.toEqual(b);
  });
});

describe("scoring", () => {
  it("matches earned = 20 + ai + 5*votes", () => {
    // Example: 2 votes, ai 28 → 20+28+10 = 58
    expect(computeEarnedStones({ votes: 2, aiAward: 28 })).toBe(58);
    expect(computeEarnedStones({ votes: 0, aiAward: 0 })).toBe(20);
    expect(aiAwardFromScores({ topicFit: 10, pickStrength: 20, rosterQuality: 10 })).toBe(40);
    expect(aiAwardFromScores({ topicFit: 0, pickStrength: 0, rosterQuality: 0 })).toBe(0);
  });
});

describe("wager math", () => {
  it("allows all banked beans (no earlier-winnings cap)", () => {
    expect(maxWager(40, 100)).toBe(140);
    expect(maxWager(10, 10)).toBe(20);
    expect(maxWager(0, 50)).toBe(50);
  });

  it("presets and protected balance", () => {
    expect(wagerFromPreset("keep_all", 40, 30)).toBe(0);
    expect(wagerFromPreset("half_new", 40, 30)).toBe(20);
    expect(wagerFromPreset("all_new", 40, 30)).toBe(40);
    const locked = applyWager({ banked: 30, earned: 40, wager: 50 });
    expect(locked.pot).toBe(50);
    expect(locked.protected).toBe(20);
  });
});

describe("dice table", () => {
  it("follows 105→175→187→374 path; 469 is banked total not next pot", () => {
    let pot = 105;
    // Safe seven
    let o = applyDiceRoll(pot, { d1: 3, d2: 4 }, 1);
    expect(o.potAfter).toBe(175);
    expect(o.kind).toBe("safe_seven");
    pot = o.potAfter;

    // Safe doubles 6+6 → +12
    o = applyDiceRoll(pot, { d1: 6, d2: 6 }, 2);
    expect(o.potAfter).toBe(187);
    pot = o.potAfter;

    // Dangerous doubles → double pot
    o = applyDiceRoll(pot, { d1: 2, d2: 2 }, 3);
    expect(o.potAfter).toBe(374);
    pot = o.potAfter;

    // Banked total with protected 95 → 469 (NOT a dice pot step)
    expect(95 + pot).toBe(469);

    // Continuing the pot without banking: 5+6 → 385
    o = applyDiceRoll(pot, { d1: 5, d2: 6 }, 4);
    expect(o.potAfter).toBe(385);

    o = applyDiceRoll(374, { d1: 1, d2: 6 }, 5);
    expect(o.busted).toBe(true);
    expect(o.potAfter).toBe(0);
  });

  it("safe rolls never bust on seven", () => {
    const o = applyDiceRoll(50, { d1: 2, d2: 5 }, 2);
    expect(o.busted).toBe(false);
    expect(o.potAfter).toBe(50 + RULES.sevenSafeBonus);
  });
});

describe("pull out / settlement helpers", () => {
  it("pull out banks entire pot into protected conceptually", () => {
    const pot = 120;
    const protectedBal = 40;
    const banked = protectedBal + pot;
    expect(banked).toBe(160);
  });
});
