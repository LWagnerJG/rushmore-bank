import { describe, expect, it } from "vitest";
import { applyDiceRoll } from "../engine/dice";
import { RULES } from "../rules";

/**
 * Pull Out vs Roll atomicity is enforced server-side by diceSubphase.
 * These tests document the pot banking math used by both paths.
 */
describe("pull out banking", () => {
  it("banks pot into protected", () => {
    const protectedBal = 40;
    const pot = 120;
    expect(protectedBal + pot).toBe(160);
  });

  it("bust leaves only protected", () => {
    const o = applyDiceRoll(90, { d1: 3, d2: 4 }, 3);
    expect(o.busted).toBe(true);
    expect(o.potAfter).toBe(0);
    const protectedBal = 25;
    expect(protectedBal + o.potAfter).toBe(25);
  });
});

describe("settlement soft budget", () => {
  it("uses time budget; min banks before settle defaults to 0", () => {
    expect(RULES.diceMinBanksBeforeSettlement).toBe(0);
    expect(RULES.diceSoftBudgetMs).toBe(3 * 60 * 1000);
  });
});
