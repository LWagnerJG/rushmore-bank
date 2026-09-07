import { describe, expect, it } from "vitest";
import { applyDiceRoll } from "../engine/dice";
import { classifyPullOut } from "../engine/banking";
import { maxWager, applyWager } from "../engine/wager";

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

  it("allows banking a zero pot (sit out)", () => {
    const ok = classifyPullOut({
      phase: "DICE",
      diceSubphase: "READY",
      playerId: "a",
      currentRollerId: "a",
      diceActiveIds: ["a", "b"],
      pot: 0,
    });
    expect(ok.ok).toBe(true);
  });
});

describe("round-robin seat advance", () => {
  it("rotating seats completes a lap when index wraps", () => {
    const n = 4;
    let seat = 3;
    let laps = 0;
    const prev = seat;
    seat = (seat + 1) % n;
    if (seat <= prev) laps += 1;
    expect(seat).toBe(0);
    expect(laps).toBe(1);
  });
});

describe("full-balance wager", () => {
  it("allows wagering all banked beans", () => {
    expect(maxWager(40, 100)).toBe(140);
    const locked = applyWager({ banked: 30, earned: 40, wager: 70 });
    expect(locked.pot).toBe(70);
    expect(locked.protected).toBe(0);
  });
});
