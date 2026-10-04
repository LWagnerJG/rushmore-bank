/**
 * Fail-proof dice settle: tumble may scramble faces;
 * settled faces only from authoritative d1/d2 (hard cut, no jump).
 */
import { describe, expect, it } from "vitest";
import {
  authoritativeFaces,
  displayFaces,
  liveReadoutRoll,
  resolveDicePresentPhase,
  resolveDiceReadout,
  type DiceReadoutRoll,
} from "../engine/dice-present";
import type { PublicDiceBroadcast } from "../types";

function tumblingBroadcast(
  overrides: Partial<PublicDiceBroadcast> = {},
): PublicDiceBroadcast {
  return {
    rollId: "roll-1",
    rollerId: "p1",
    personalRollNumber: 1,
    animStartedAt: 1000,
    animSettleAt: 3400,
    animSeed: 42,
    revealed: false,
    potBefore: 10,
    ...overrides,
  };
}

function settledBroadcast(
  d1: number,
  d2: number,
  busted: boolean,
  overrides: Partial<PublicDiceBroadcast> = {},
): PublicDiceBroadcast {
  const total = d1 + d2;
  return tumblingBroadcast({
    revealed: true,
    d1,
    d2,
    busted,
    potAfter: busted ? 0 : 10 + total,
    note: busted ? "BEAN BUSTER — pot wiped." : `+${total}`,
    outcomeKind: busted ? "bust" : "add_sum",
    ...overrides,
  });
}

describe("authoritative settle contract", () => {
  it("hides auth faces until revealed — even if d1/d2 leaked on wire", () => {
    expect(authoritativeFaces(tumblingBroadcast())).toBeNull();
    expect(authoritativeFaces(tumblingBroadcast({ d1: 3, d2: 4 }))).toBeNull();
    expect(displayFaces(tumblingBroadcast({ d1: 3, d2: 4 }))).toBeNull();
    expect(
      resolveDicePresentPhase(tumblingBroadcast({ d1: 3, d2: 4 })).kind,
    ).toBe("tumbling");
  });

  it("settled phase only when revealed with valid faces", () => {
    const settled = tumblingBroadcast({
      revealed: true,
      d1: 2,
      d2: 5,
      busted: false,
      potAfter: 17,
      note: "+7",
      outcomeKind: "add_sum",
    });
    expect(authoritativeFaces(settled)).toEqual({ d1: 2, d2: 5 });
    expect(displayFaces(settled)).toEqual({ d1: 2, d2: 5 });
    expect(resolveDicePresentPhase(settled)).toMatchObject({
      kind: "settled",
      d1: 2,
      d2: 5,
    });
  });

  it("rejects invalid revealed faces instead of inventing a rest", () => {
    expect(
      authoritativeFaces(
        tumblingBroadcast({ revealed: true, d1: 0, d2: 3 }),
      ),
    ).toBeNull();
    expect(
      authoritativeFaces(
        tumblingBroadcast({ revealed: true, d1: 7, d2: 1 }),
      ),
    ).toBeNull();
  });

  it("idle defaults are explicit; tumble never returns auth display faces", () => {
    expect(displayFaces(null)).toEqual({ d1: 1, d2: 1 });
    expect(displayFaces(tumblingBroadcast())).toBeNull();
  });

  it("first settled pair is always the server pair (no alternate settle)", () => {
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = 1; d2 <= 6; d2++) {
        const phase = resolveDicePresentPhase(
          tumblingBroadcast({
            revealed: true,
            d1,
            d2,
            potAfter: 0,
            note: "",
            outcomeKind: "add_sum",
          }),
        );
        expect(phase).toMatchObject({ kind: "settled", d1, d2 });
        // Invariant: no other settled candidate exists in the phase model.
        if (phase.kind === "settled") {
          expect(phase.d1).toBe(d1);
          expect(phase.d2).toBe(d2);
        }
      }
    }
  });
});

describe("dice readout vs sticky (bust attribution)", () => {
  const priorTen: DiceReadoutRoll = {
    rollId: "roll-prior-10",
    rollerId: "charlie",
    d1: 4,
    d2: 6,
    gain: 10,
    busted: false,
    note: "+10",
  };

  it("SETTLED bust uses live seven — never sticky prior total (Charlie's +10)", () => {
    const bust = settledBroadcast(3, 4, true, {
      rollId: "roll-bust-7",
      rollerId: "charlie",
      potBefore: 20,
    });
    // Sticky still holds the previous +10 (useEffect lag / tumble keep).
    const readout = resolveDiceReadout("SETTLED", bust, priorTen);
    expect(readout.showBust).toBe(true);
    expect(readout.showTotal).toBe(false);
    expect(readout.d1).toBe(3);
    expect(readout.d2).toBe(4);
    expect(readout.d1! + readout.d2!).toBe(7);
    expect(readout.rollId).toBe("roll-bust-7");
    expect(readout.rollerId).toBe("charlie");
    expect(readout.gain).toBe(0);
    expect(readout.resultStale).toBe(false);
  });

  it("BEAN BUSTER never appears for a non-seven sticky while tumbling", () => {
    const tumbling = tumblingBroadcast({
      rollId: "roll-next",
      rollerId: "charlie",
    });
    const stickyBust: DiceReadoutRoll = {
      rollId: "old-bust",
      rollerId: "other",
      d1: 2,
      d2: 5,
      gain: 0,
      busted: true,
    };
    const readout = resolveDiceReadout("COMMITTED", tumbling, stickyBust);
    expect(readout.showBust).toBe(false);
    expect(readout.showTotal).toBe(false);
    expect(readout.busted).toBe(false);
  });

  it("during tumble, sticky may keep a prior non-bust total (stale), not faces as auth", () => {
    const tumbling = tumblingBroadcast({ rollId: "roll-2", rollerId: "charlie" });
    const readout = resolveDiceReadout("COMMITTED", tumbling, priorTen);
    expect(readout.showBust).toBe(false);
    expect(readout.showTotal).toBe(true);
    expect(readout.gain).toBe(10);
    expect(readout.resultStale).toBe(true);
    expect(readout.rollId).toBe("roll-prior-10");
    // Tray must still be tumbling — readout sticky ≠ settled auth faces.
    expect(resolveDicePresentPhase(tumbling).kind).toBe("tumbling");
    expect(authoritativeFaces(tumbling)).toBeNull();
  });

  it("live readout faces always equal server d1/d2 for that rollId", () => {
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = 1; d2 <= 6; d2++) {
        const busted = d1 + d2 === 7;
        const b = settledBroadcast(d1, d2, busted, { rollId: `r-${d1}${d2}` });
        const live = liveReadoutRoll(b);
        expect(live).toMatchObject({ rollId: `r-${d1}${d2}`, d1, d2, busted });
        const readout = resolveDiceReadout("SETTLED", b, priorTen);
        expect(readout.d1).toBe(d1);
        expect(readout.d2).toBe(d2);
        expect(readout.rollId).toBe(`r-${d1}${d2}`);
        expect(readout.showBust).toBe(busted);
        if (busted) {
          expect(readout.d1! + readout.d2!).toBe(7);
          expect(readout.showTotal).toBe(false);
        }
      }
    }
  });

  it("clears bust banner when lastDice is null (next seat)", () => {
    const readout = resolveDiceReadout("READY", null, priorTen);
    expect(readout.showBust).toBe(false);
    // Without a live roll and not tumbling, sticky prior is not shown as bust.
    expect(readout.showTotal).toBe(false);
  });

  it("READY with revealed lastDice shows that roll's faces (same player continue)", () => {
    const last = settledBroadcast(4, 6, false, {
      rollId: "roll-keep",
      rollerId: "charlie",
      potBefore: 5,
      potAfter: 15,
    });
    const readout = resolveDiceReadout("READY", last, null);
    expect(readout.showBust).toBe(false);
    expect(readout.showTotal).toBe(true);
    expect(readout.d1).toBe(4);
    expect(readout.d2).toBe(6);
    expect(readout.gain).toBe(10);
    expect(readout.rollId).toBe("roll-keep");
  });
});
