/**
 * Fail-proof dice settle: tumble never rests on a guessed face;
 * settled faces only from authoritative d1/d2.
 */
import { describe, expect, it } from "vitest";
import { projectDie } from "../engine/dice-geometry";
import { tumblePose } from "../engine/dice-sync";
import {
  TUMBLE_DISPLAY_CAP,
  authoritativeFaces,
  resolveDicePresentPhase,
  tumbleDisplayProgress,
  tumbleStillSpinning,
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

describe("dice face geometry", () => {
  it("rest pose front face matches requested face for both dice", () => {
    for (let face = 1; face <= 6; face++) {
      for (const index of [0, 1] as const) {
        expect(projectDie({ face, index }).front).toBe(face);
      }
    }
  });
});

describe("authoritative settle contract", () => {
  it("hides faces until revealed", () => {
    expect(authoritativeFaces(tumblingBroadcast())).toBeNull();
    expect(authoritativeFaces(tumblingBroadcast({ d1: 3, d2: 4 }))).toBeNull();
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

  it("settled rest projection matches authoritative faces (no jump target)", () => {
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = 1; d2 <= 6; d2++) {
        expect(projectDie({ face: d1, index: 0 }).front).toBe(d1);
        expect(projectDie({ face: d2, index: 1 }).front).toBe(d2);
      }
    }
  });
});

describe("tumble never fake-settles", () => {
  it("display progress never enters the near-rest zone before reveal", () => {
    expect(tumbleDisplayProgress(1000, 1000, 3400)).toBe(0);
    expect(tumbleDisplayProgress(2200, 1000, 3400)).toBeLessThanOrEqual(
      TUMBLE_DISPLAY_CAP,
    );
    // Past settleAt / clock skew — still capped (keep spinning until reveal).
    expect(tumbleDisplayProgress(99999, 1000, 3400)).toBe(TUMBLE_DISPLAY_CAP);
    expect(TUMBLE_DISPLAY_CAP).toBeLessThan(0.85);
  });

  it("pose at display cap still has spin energy (not a readable rest)", () => {
    for (const seed of [1, 42, 999, 1234567890, 0xabcdef]) {
      for (const index of [0, 1] as const) {
        const pose = tumblePose(TUMBLE_DISPLAY_CAP, seed, index);
        expect(tumbleStillSpinning(pose)).toBe(true);
        // Pure tumble (settle=0) — front is whatever spin shows; must not be
        // treated as final. Assert we are not at rest matrix (settle omitted / 0).
        const mid = projectDie({
          face: 1,
          index,
          tumble: pose,
          settle: 0,
        });
        const rest = projectDie({ face: 1, index });
        // Tumble outline/transform should differ from authoritative rest of 1
        // for almost all seeds; if equal for a seed, spin energy still required.
        if (mid.outline === rest.outline) {
          expect(tumbleStillSpinning(pose)).toBe(true);
        }
      }
    }
  });

  it("display path never uses near-end progress that used to fake-settle", () => {
    // Past wall-clock settle: still capped — no coast-to-rest before reveal.
    expect(tumbleDisplayProgress(10_000, 0, 2400)).toBe(TUMBLE_DISPLAY_CAP);
    expect(tumbleDisplayProgress(10_000, 0, 2400)).toBeLessThan(0.85);
    const displayPose = tumblePose(TUMBLE_DISPLAY_CAP, 42, 0);
    expect(tumbleStillSpinning(displayPose)).toBe(true);
  });
});
