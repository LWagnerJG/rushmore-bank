/**
 * Fail-proof dice settle: tumble never paints a face;
 * settled faces only from authoritative d1/d2.
 */
import { describe, expect, it } from "vitest";
import {
  authoritativeFaces,
  displayFaces,
  resolveDicePresentPhase,
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

describe("authoritative settle contract", () => {
  it("hides faces until revealed — even if d1/d2 leaked on wire", () => {
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

  it("idle defaults are explicit; tumble never returns display faces", () => {
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
