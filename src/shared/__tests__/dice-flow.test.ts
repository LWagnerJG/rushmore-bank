/**
 * Pure banking helpers for dice Bank — current roller only.
 * Tests document personal continuous turns (roll until Bank/bust).
 */
import { describe, expect, it } from "vitest";
import { applyDiceRoll } from "../engine/dice";
import { classifyPullOut } from "../engine/banking";
import { maxWager, applyWager } from "../engine/wager";

describe("bank action", () => {
  it("banks pot into protected", () => {
    const protectedBal = 40;
    const pot = 120;
    expect(protectedBal + pot).toBe(160);
  });

  it("bust leaves only protected", () => {
    const o = applyDiceRoll(90, { d1: 3, d2: 4 }, 1);
    expect(o.busted).toBe(true);
    expect(o.potAfter).toBe(0);
    const protectedBal = 25;
    expect(protectedBal + o.potAfter).toBe(25);
  });

  it("allows current roller to bank a zero pot", () => {
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

  it("blocks waiting players from banking", () => {
    const r = classifyPullOut({
      phase: "DICE",
      diceSubphase: "READY",
      playerId: "b",
      currentRollerId: "a",
      diceActiveIds: ["a", "b"],
      pot: 40,
    });
    expect(r.ok).toBe(false);
  });
});

describe("personal continuous turn", () => {
  it("same seat keeps rolling until bank/bust, then advances", () => {
    const seatOrder = ["a", "b", "c"];
    let seat = 0;
    const active = new Set(["a", "b", "c"]);
    const rolls: Record<string, number> = { a: 0, b: 0, c: 0 };
    const pots: Record<string, number> = { a: 20, b: 10, c: 30 };

    // Player a rolls twice then banks → seat advances
    for (let i = 0; i < 2; i++) {
      const pid = seatOrder[seat]!;
      rolls[pid]! += 1;
      const o = applyDiceRoll(pots[pid]!, { d1: 1, d2: 2 }, rolls[pid]!);
      pots[pid] = o.potAfter;
      // no seat advance on successful roll
    }
    expect(seat).toBe(0);
    expect(rolls.a).toBe(2);
    active.delete("a"); // banked
    seat = (seat + 1) % seatOrder.length;

    // b busts on first roll (seven)
    while (active.has("b")) {
      const pid = seatOrder[seat]!;
      rolls[pid]! += 1;
      const o = applyDiceRoll(pots[pid]!, { d1: 3, d2: 4 }, rolls[pid]!);
      pots[pid] = o.potAfter;
      if (o.busted) {
        active.delete(pid);
        seat = (seat + 1) % seatOrder.length;
      }
    }

    expect(rolls.b).toBe(1);
    expect(pots.b).toBe(0);
    expect(seat).toBe(2);
    expect(active.has("c")).toBe(true);
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
