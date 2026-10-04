/**
 * BANK readout / BEAN BUSTER must match the revealed roll on the first paint.
 * Regression: sticky lag showed a prior +10 beside a fresh bust.
 */
import { describe, expect, it } from "vitest";
import {
  isBeanBusterReadout,
  resolveDiceReadout,
  type DiceReadout,
} from "../engine/dice-present";
import type { PublicDiceBroadcast } from "../types";

function tumbling(
  overrides: Partial<PublicDiceBroadcast> = {},
): PublicDiceBroadcast {
  return {
    rollId: "roll-new",
    rollerId: "charlie",
    personalRollNumber: 2,
    animStartedAt: 1000,
    animSettleAt: 3400,
    animSeed: 42,
    revealed: false,
    potBefore: 20,
    ...overrides,
  };
}

const stickyTen: DiceReadout = {
  rollId: "roll-prior",
  d1: 4,
  d2: 6,
  gain: 10,
  name: "Charlie",
  busted: false,
  note: "+10",
};

describe("resolveDiceReadout", () => {
  it("clears when server nulls lastDice (next seat)", () => {
    expect(resolveDiceReadout(null, "Charlie", stickyTen)).toBeNull();
  });

  it("keeps prior sticky while the next roll is still tumbling", () => {
    expect(resolveDiceReadout(tumbling(), "Charlie", stickyTen)).toEqual(
      stickyTen,
    );
  });

  it("on bust reveal, first paint uses live 7 — never prior +10 sticky", () => {
    const bust = tumbling({
      rollId: "roll-bust",
      revealed: true,
      d1: 3,
      d2: 4,
      potAfter: 0,
      busted: true,
      note: "BEAN BUSTER — pot wiped.",
      outcomeKind: "bust",
    });
    const live = resolveDiceReadout(bust, "Charlie", stickyTen);
    expect(live).toMatchObject({
      rollId: "roll-bust",
      d1: 3,
      d2: 4,
      gain: 0,
      busted: true,
      name: "Charlie",
    });
    expect(live!.d1 + live!.d2).toBe(7);
    expect(isBeanBusterReadout(live)).toBe(true);
    // Sticky prior must not win this frame.
    expect(live!.gain).not.toBe(10);
    expect(live!.rollId).not.toBe(stickyTen.rollId);
  });

  it("BEAN BUSTER only when busted faces sum to 7", () => {
    expect(
      isBeanBusterReadout({
        ...stickyTen,
        busted: true,
        d1: 4,
        d2: 6,
      }),
    ).toBe(false);
    expect(
      isBeanBusterReadout({
        rollId: "r",
        d1: 2,
        d2: 5,
        gain: 0,
        name: "A",
        busted: true,
      }),
    ).toBe(true);
    expect(isBeanBusterReadout(null)).toBe(false);
  });

  it("faces and gain always match the revealed rollId pair", () => {
    const settled = tumbling({
      revealed: true,
      d1: 5,
      d2: 5,
      potBefore: 10,
      potAfter: 20,
      busted: false,
      note: "Doubles",
      outcomeKind: "double_pot",
    });
    const live = resolveDiceReadout(settled, "Sam", stickyTen);
    expect(live).toMatchObject({
      rollId: settled.rollId,
      d1: 5,
      d2: 5,
      gain: 10,
      busted: false,
    });
  });
});
