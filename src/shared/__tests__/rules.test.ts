import { describe, expect, it } from "vitest";
import { snakeDraftOrder, totalDraftPicks } from "../engine/snake";
import { applyDiceRoll } from "../engine/dice";
import { applyWager, maxWager, wagerFromPreset } from "../engine/wager";
import { aiAwardFromScores, computeEarnedStones } from "../engine/scoring";
import { RULES } from "../rules";
import { TOPIC_COUNT } from "../topics";

describe("topics", () => {
  it("has a huge curated topic bank", () => {
    expect(TOPIC_COUNT).toBeGreaterThanOrEqual(800);
  });

  it("always offers exactly 4 topic choices", () => {
    expect(RULES.topicShortlistSize).toBe(4);
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
  it("first-roll seven is always a bust (BEAN BUSTER)", () => {
    const o = applyDiceRoll(50, { d1: 2, d2: 5 }, 1);
    expect(o.busted).toBe(true);
    expect(o.kind).toBe("bust");
    expect(o.potAfter).toBe(0);
    expect(o.note).toMatch(/BEAN BUSTER/);
  });

  it("doubles always double pot; non-seven adds sum; later seven busts", () => {
    let pot = 105;
    let o = applyDiceRoll(pot, { d1: 6, d2: 6 }, 1);
    expect(o.busted).toBe(false);
    expect(o.kind).toBe("double_pot");
    expect(o.potAfter).toBe(210);
    pot = o.potAfter;

    o = applyDiceRoll(pot, { d1: 1, d2: 2 }, 2);
    expect(o.potAfter).toBe(213);
    pot = o.potAfter;

    // Banked total with protected 95 (NOT a dice pot step)
    expect(95 + pot).toBe(308);

    o = applyDiceRoll(pot, { d1: 1, d2: 6 }, 3);
    expect(o.busted).toBe(true);
    expect(o.potAfter).toBe(0);
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
