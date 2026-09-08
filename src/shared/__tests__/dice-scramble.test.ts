/**
 * Scramble anticipation helpers — cosmetic only; settle uses auth faces.
 */
import { describe, expect, it } from "vitest";
import {
  scrambleFaceAt,
  scrambleTickCount,
  SCRAMBLE_TICK_MS,
} from "../engine/dice-scramble";
import { resolveDicePresentPhase } from "../engine/dice-present";
import type { PublicDiceBroadcast } from "../types";
import { RULES } from "../rules";

describe("dice scramble", () => {
  it("returns faces in 1..6 for many ticks", () => {
    for (let tick = 0; tick < 40; tick++) {
      const a = scrambleFaceAt(42, 0, tick);
      const b = scrambleFaceAt(42, 1, tick);
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(6);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(6);
    }
  });

  it("changes across ticks (anticipation, not a stuck face)", () => {
    const faces = new Set<number>();
    for (let tick = 0; tick < 24; tick++) {
      faces.add(scrambleFaceAt(99, 0, tick));
    }
    expect(faces.size).toBeGreaterThan(1);
  });

  it("is deterministic for the same seed/tick (synced clients)", () => {
    expect(scrambleFaceAt(12345, 0, 7)).toBe(scrambleFaceAt(12345, 0, 7));
    expect(scrambleFaceAt(12345, 1, 7)).toBe(scrambleFaceAt(12345, 1, 7));
  });

  it("tick count advances only during tumble window", () => {
    expect(scrambleTickCount(1000, 3400, 1000)).toBe(0);
    expect(scrambleTickCount(1000, 3400, 1000 + SCRAMBLE_TICK_MS * 3)).toBe(3);
    expect(scrambleTickCount(1000, 3400, 5000)).toBe(
      Math.floor((3400 - 1000) / SCRAMBLE_TICK_MS),
    );
  });
});

describe("scramble then settle invariant", () => {
  it("tumbling phase never exposes auth faces; settled paints server pair", () => {
    const tumbling: PublicDiceBroadcast = {
      rollId: "r1",
      rollerId: "p1",
      personalRollNumber: 1,
      animStartedAt: 1000,
      animSettleAt: 3400,
      animSeed: 7,
      revealed: false,
      potBefore: 10,
      d1: 6,
      d2: 6,
    };
    expect(resolveDicePresentPhase(tumbling).kind).toBe("tumbling");

    const settled: PublicDiceBroadcast = {
      ...tumbling,
      revealed: true,
      d1: 2,
      d2: 5,
      potAfter: 17,
      note: "+7",
      outcomeKind: "add_sum",
    };
    expect(resolveDicePresentPhase(settled)).toMatchObject({
      kind: "settled",
      d1: 2,
      d2: 5,
    });
  });

  it("idle bank decision window is ~15s; draft pick stays 60s", () => {
    expect(RULES.diceIdleBankSeconds).toBe(15);
    expect(RULES.pickClockSeconds).toBe(60);
  });
});
