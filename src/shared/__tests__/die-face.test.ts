/**
 * Hard guarantee: a die never paints fewer than 1 or more than 6 pips
 * for a shown face, and settled totals always equal auth d1+d2.
 *
 * Covers scramble→settle, rapid rollId changes, and reconnect-style replays.
 */
import { describe, expect, it } from "vitest";
import { DIE_PIPS } from "../engine/dice-geometry";
import {
  assertLegalDiePaint,
  assertLegalTrayPaint,
  diePaintModel,
  diePipCount,
  normalizeDieFace,
  pipsForDieFace,
  replaceDieFacePips,
  resolveTrayPaint,
  scramblePaintPair,
  DIE_PIP_CLASS,
} from "../engine/die-face";
import { resolveDicePresentPhase } from "../engine/dice-present";
import { scrambleFaceAt, scrambleTickCount } from "../engine/dice-scramble";
import type { PublicDiceBroadcast } from "../types";

function tumbling(
  rollId: string,
  overrides: Partial<PublicDiceBroadcast> = {},
): PublicDiceBroadcast {
  return {
    rollId,
    rollerId: "p1",
    personalRollNumber: 1,
    animStartedAt: 1000,
    animSettleAt: 3400,
    animSeed: 99,
    revealed: false,
    potBefore: 10,
    ...overrides,
  };
}

function settled(
  rollId: string,
  d1: number,
  d2: number,
): PublicDiceBroadcast {
  return tumbling(rollId, {
    revealed: true,
    d1,
    d2,
    potAfter: 10 + d1 + d2,
    note: `+${d1 + d2}`,
    outcomeKind: "add_sum",
    busted: false,
  });
}

describe("normalizeDieFace + pip table", () => {
  it("accepts only integers 1–6", () => {
    for (const bad of [0, 7, 8, -1, 1.5, NaN, Infinity, "3", null, undefined]) {
      expect(normalizeDieFace(bad)).toBeNull();
      expect(diePaintModel(bad).pipCount).toBe(0);
    }
    for (let f = 1; f <= 6; f++) {
      expect(normalizeDieFace(f)).toBe(f);
      expect(diePipCount(normalizeDieFace(f))).toBe(f);
    }
  });

  it("DIE_PIPS row length always equals the face value", () => {
    for (let f = 1; f <= 6; f++) {
      expect(DIE_PIPS[f]).toHaveLength(f);
      expect(pipsForDieFace(f as 1 | 2 | 3 | 4 | 5 | 6)).toHaveLength(f);
    }
  });

  it("rejects a painted face of 7 pips (the live bug)", () => {
    const seven = diePaintModel(7);
    expect(seven.face).toBeNull();
    expect(seven.pipCount).toBe(0);
    expect(() =>
      assertLegalDiePaint({ face: 7 as never, pipCount: 7, pipSlots: [0, 1, 2, 3, 4, 5, 6] }),
    ).toThrow(/7 pips/);
  });
});

describe("replaceDieFacePips — replace never append", () => {
  it("clears every pip node then paints exactly one face's count", () => {
    const nodes: Array<{ className: string; remove: () => void }> = [];
    const created: Array<{ className: string }> = [];
    const svg = {
      ownerDocument: {
        createElementNS(ns: string, tag: string) {
          void ns;
          void tag;
          const node = {
            className: "",
            attrs: {} as Record<string, string>,
            setAttribute(k: string, v: string) {
              this.attrs[k] = v;
              if (k === "class") this.className = v;
            },
          };
          created.push(node);
          return node;
        },
      },
      appendChild(n: { className: string; remove: () => void }) {
        n.remove = () => {
          const i = nodes.indexOf(n);
          if (i >= 0) nodes.splice(i, 1);
        };
        nodes.push(n);
      },
      querySelectorAll(sel: string) {
        const cls = sel.replace(/^\./, "");
        const matches = nodes.filter((n) => n.className.split(/\s+/).includes(cls));
        return {
          forEach(fn: (n: { remove: () => void }) => void) {
            for (const n of [...matches]) fn(n);
          },
        };
      },
    };

    // Pretend leftover scramble stacked 4 + 3 = 7 pips.
    for (let i = 0; i < 7; i++) {
      const n = {
        className: DIE_PIP_CLASS,
        remove() {
          const idx = nodes.indexOf(this);
          if (idx >= 0) nodes.splice(idx, 1);
        },
      };
      nodes.push(n);
    }
    expect(nodes).toHaveLength(7);

    const model = replaceDieFacePips(svg as unknown as ParentNode, 4);
    expect(model.face).toBe(4);
    expect(model.pipCount).toBe(4);
    expect(nodes).toHaveLength(4);
    expect(nodes.every((n) => n.className === DIE_PIP_CLASS)).toBe(true);

    replaceDieFacePips(svg as unknown as ParentNode, 1);
    expect(nodes).toHaveLength(1);

    replaceDieFacePips(svg as unknown as ParentNode, 7);
    expect(nodes).toHaveLength(0);
  });
});

describe("tray paint: scramble → settle → rollId change → reconnect", () => {
  it("scramble ticks never paint illegal pip counts", () => {
    const phase = resolveDicePresentPhase(tumbling("roll-a"));
    expect(phase.kind).toBe("tumbling");
    for (let tick = 0; tick < 80; tick++) {
      const pair = scramblePaintPair(42, tick);
      const tray = resolveTrayPaint(phase, pair);
      assertLegalTrayPaint(tray);
      expect(tray.total).toBeNull();
      expect(tray.authD1).toBeNull();
      expect(tray.pipCount1).toBeGreaterThanOrEqual(1);
      expect(tray.pipCount1).toBeLessThanOrEqual(6);
      expect(tray.pipCount2).toBeGreaterThanOrEqual(1);
      expect(tray.pipCount2).toBeLessThanOrEqual(6);
      expect(tray.pipCount1).toBe(pair.d1);
      expect(tray.pipCount2).toBe(pair.d2);
    }
  });

  it("hard-cut settle: paint equals server d1/d2; total === d1+d2", () => {
    const priorScramble = scramblePaintPair(7, 12);
    // Mid-tumble with scramble that could look "busy"
    let phase = resolveDicePresentPhase(tumbling("roll-b", { animSeed: 7 }));
    let tray = resolveTrayPaint(phase, priorScramble);
    assertLegalTrayPaint(tray);

    // Settle to a seven (3+4) — must show exactly 3 and 4 pips, total 7
    phase = resolveDicePresentPhase(settled("roll-b", 3, 4));
    tray = resolveTrayPaint(phase, priorScramble); // scramble ignored when settled
    assertLegalTrayPaint(tray);
    expect(tray.paintD1).toBe(3);
    expect(tray.paintD2).toBe(4);
    expect(tray.pipCount1).toBe(3);
    expect(tray.pipCount2).toBe(4);
    expect(tray.total).toBe(7);
    expect(tray.total).toBe(tray.authD1! + tray.authD2!);
    expect(tray.scrambling).toBe(false);
  });

  it("rapid successive rolls: each rollId paints only its own auth faces", () => {
    const rolls: Array<[string, number, number]> = [
      ["roll-1", 6, 6],
      ["roll-2", 1, 2],
      ["roll-3", 5, 2],
      ["roll-4", 4, 3],
    ];
    for (const [rollId, d1, d2] of rolls) {
      // tumble
      let phase = resolveDicePresentPhase(tumbling(rollId));
      for (let t = 0; t < 10; t++) {
        const tray = resolveTrayPaint(phase, scramblePaintPair(t, t));
        assertLegalTrayPaint(tray);
        expect(tray.rollId).toBe(rollId);
        expect(tray.total).toBeNull();
      }
      // settle
      phase = resolveDicePresentPhase(settled(rollId, d1, d2));
      const tray = resolveTrayPaint(phase, scramblePaintPair(99, 99));
      assertLegalTrayPaint(tray);
      expect(tray.rollId).toBe(rollId);
      expect(tray.paintD1).toBe(d1);
      expect(tray.paintD2).toBe(d2);
      expect(tray.total).toBe(d1 + d2);
    }
  });

  it("reconnect-style replay of the same settled broadcast stays legal", () => {
    const broadcast = settled("roll-reconnect", 2, 5);
    for (let i = 0; i < 20; i++) {
      const phase = resolveDicePresentPhase(broadcast);
      const tray = resolveTrayPaint(phase, null);
      assertLegalTrayPaint(tray);
      expect(tray.total).toBe(7);
      expect(tray.paintD1).toBe(2);
      expect(tray.paintD2).toBe(5);
      expect(tray.pipCount1 + tray.pipCount2).toBe(7);
      // Sum of pips across dice can be 7; each die still ≤ 6
      expect(tray.pipCount1).toBeLessThanOrEqual(6);
      expect(tray.pipCount2).toBeLessThanOrEqual(6);
    }
  });

  it("shown total always equals d1+d2 of the current settled rollId", () => {
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = 1; d2 <= 6; d2++) {
        const rollId = `r-${d1}x${d2}`;
        const phase = resolveDicePresentPhase(settled(rollId, d1, d2));
        const tray = resolveTrayPaint(phase, scramblePaintPair(1, 1));
        assertLegalTrayPaint(tray);
        expect(tray.rollId).toBe(rollId);
        expect(tray.total).toBe(d1 + d2);
        expect(tray.paintD1! + tray.paintD2!).toBe(tray.total);
      }
    }
  });

  it("scrambleFaceAt values are always legal before and after normalize", () => {
    const end = scrambleTickCount(0, 2400, 2400);
    for (let tick = 0; tick <= end; tick++) {
      for (const die of [0, 1] as const) {
        const raw = scrambleFaceAt(12345, die, tick);
        expect(raw).toBeGreaterThanOrEqual(1);
        expect(raw).toBeLessThanOrEqual(6);
        const face = normalizeDieFace(raw);
        expect(face).toBe(raw);
        assertLegalDiePaint(diePaintModel(face));
      }
    }
  });
});
