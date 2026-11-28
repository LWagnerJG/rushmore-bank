/**
 * Fair first-player / roll-order + dice RNG contracts.
 *
 * - Fisher–Yates (crypto) must not bias toward join/host order.
 * - Bust rate must depend on faces (P(7)=1/6), not roll number.
 * - Deterministic-seed paths stay stable for regressions.
 */
import { describe, expect, it } from "vitest";
import {
  applyDiceRoll,
  fisherYatesShuffle,
  mulberry32,
  mulberry32Uint32,
  randomInt,
  roll2d6,
  rollD6,
} from "../engine";
import { createTestServer } from "../../../test/party-server-harness";

/** Chi-square p≈0.001 critical value for df = n-1 (n categories). */
function chiSquareCritical(df: number): number {
  // Conservative thresholds for the dfs we use (3 and 5).
  if (df === 3) return 16.27;
  if (df === 5) return 20.52;
  if (df === 35) return 66.62; // 36 faces
  return df * 2 + 20;
}

function chiSquare(counts: number[], expected: number): number {
  let sum = 0;
  for (const c of counts) {
    const d = c - expected;
    sum += (d * d) / expected;
  }
  return sum;
}

describe("crypto Fisher–Yates seat shuffle", () => {
  it("is a permutation of the input", () => {
    const ids = ["host", "p2", "p3", "p4", "p5"];
    const out = fisherYatesShuffle(ids);
    expect(out).toHaveLength(ids.length);
    expect([...out].sort()).toEqual([...ids].sort());
    expect(out).not.toBe(ids);
  });

  it("does not preserve join order every time (biased-sort regression)", () => {
    const ids = ["host", "a", "b", "c"];
    let sameAsInput = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const out = fisherYatesShuffle(ids);
      if (out.every((id, j) => id === ids[j])) sameAsInput += 1;
    }
    // P(identity) = 1/24 ≈ 4.2%. 200 trials → expect ~8; >40 would be screwy.
    expect(sameAsInput).toBeLessThan(40);
  });

  it("first-seat distribution is uniform over many shuffles", () => {
    const ids = ["A", "B", "C", "D"];
    const counts = [0, 0, 0, 0];
    const trials = 8_000;
    for (let i = 0; i < trials; i++) {
      const out = fisherYatesShuffle(ids);
      const idx = ids.indexOf(out[0]!);
      counts[idx]! += 1;
    }
    const expected = trials / ids.length;
    expect(chiSquare(counts, expected)).toBeLessThan(chiSquareCritical(3));
    for (const c of counts) {
      expect(c).toBeGreaterThan(expected * 0.85);
      expect(c).toBeLessThan(expected * 1.15);
    }
  });

  it("full permutation positions are uniform (no host/index-0 sticky seat)", () => {
    const ids = ["host", "x", "y", "z"];
    const posOfHost = [0, 0, 0, 0];
    const trials = 8_000;
    for (let i = 0; i < trials; i++) {
      const out = fisherYatesShuffle(ids);
      posOfHost[out.indexOf("host")]! += 1;
    }
    const expected = trials / ids.length;
    expect(chiSquare(posOfHost, expected)).toBeLessThan(chiSquareCritical(3));
  });

  it("deterministic mulberry seed reproduces a fixed shuffle (regression lock)", () => {
    const ids = ["A", "B", "C", "D", "E"];
    const a = fisherYatesShuffle(ids, mulberry32Uint32(0xc0ffee));
    const b = fisherYatesShuffle(ids, mulberry32Uint32(0xc0ffee));
    expect(a).toEqual(b);
    expect(a).toEqual(["B", "A", "E", "D", "C"]);
    // Different seed → different order (not stuck on join order).
    const c = fisherYatesShuffle(ids, mulberry32Uint32(0xbad5eed));
    expect(c).not.toEqual(a);
    expect(c).toEqual(["D", "B", "E", "A", "C"]);
  });
});

describe("beginDice reshuffles full roll order every round", () => {
  function diceRoom(code: string) {
    const { server } = createTestServer(code);
    server.state.players = ["A", "B", "C", "D"].map((id, seat) => ({
      id,
      name: id,
      seat,
      connected: true,
      isHost: seat === 0,
      role: "player" as const,
      stones: 20,
      joinedAt: 1,
    }));
    server.state.seatOrder = ["A", "B", "C", "D"];
    server.state.rosterLocked = true;
    server.state.pots = { A: 10, B: 10, C: 10, D: 10 };
    server.state.protectedStones = { A: 10, B: 10, C: 10, D: 10 };
    server.state.diceActiveIds = ["A", "B", "C", "D"];
    return server;
  }

  it("first roller is uniform — not stuck on seat 0 / join order", async () => {
    const server = diceRoom("FAIR");
    const firstCounts: Record<string, number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
    };
    const trials = 600;
    for (let i = 0; i < trials; i++) {
      // Reset join order before each beginDice — production still reshuffles.
      server.state.seatOrder = ["A", "B", "C", "D"];
      server.state.diceActiveIds = ["A", "B", "C", "D"];
      server.state.pots = { A: 10, B: 10, C: 10, D: 10 };
      await server.beginDice();
      const first = server.currentDicePlayerId();
      expect(first).toBeTruthy();
      firstCounts[first!]! += 1;
      expect([...server.state.seatOrder].sort()).toEqual(["A", "B", "C", "D"]);
    }
    const expected = trials / 4;
    const counts = ["A", "B", "C", "D"].map((id) => firstCounts[id]!);
    expect(chiSquare(counts, expected)).toBeLessThan(chiSquareCritical(3));
    // Host/join-first must not dominate (biased sort used to stick here).
    expect(firstCounts.A!).toBeLessThan(expected * 1.35);
  });

  it("consecutive rounds reshuffle again (not frozen after game start)", async () => {
    const server = diceRoom("RNDS");
    // One game: many rounds. Do NOT reset seatOrder to join order between
    // rounds — beginDice must re-permute whatever order the prior round left.
    const firstCounts: Record<string, number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
    };
    let sameFirstAsPrev = 0;
    let prevFirst: string | null = null;
    let orderChanged = 0;
    const rounds = 500;
    for (let i = 0; i < rounds; i++) {
      const before = [...server.state.seatOrder];
      server.state.diceActiveIds = ["A", "B", "C", "D"];
      server.state.pots = { A: 10, B: 10, C: 10, D: 10 };
      await server.beginDice();
      const after = [...server.state.seatOrder];
      expect([...after].sort()).toEqual(["A", "B", "C", "D"]);
      if (after.some((id, j) => id !== before[j])) orderChanged += 1;
      const first = server.currentDicePlayerId()!;
      firstCounts[first]! += 1;
      if (prevFirst != null && first === prevFirst) sameFirstAsPrev += 1;
      prevFirst = first;
    }
    // Almost every round should change the permutation (P(same)=1/24).
    expect(orderChanged).toBeGreaterThan(rounds * 0.85);
    // Same first roller twice in a row ≈ 25% for 4 players — not ~100%.
    expect(sameFirstAsPrev / (rounds - 1)).toBeLessThan(0.4);
    expect(sameFirstAsPrev / (rounds - 1)).toBeGreaterThan(0.1);
    const expected = rounds / 4;
    const counts = ["A", "B", "C", "D"].map((id) => firstCounts[id]!);
    expect(chiSquare(counts, expected)).toBeLessThan(chiSquareCritical(3));
  });
});

describe("dice face RNG + bust rates", () => {
  it("rollD6 is uniform 1–6", () => {
    const counts = [0, 0, 0, 0, 0, 0];
    const trials = 12_000;
    for (let i = 0; i < trials; i++) {
      counts[rollD6() - 1]! += 1;
    }
    const expected = trials / 6;
    expect(chiSquare(counts, expected)).toBeLessThan(chiSquareCritical(5));
  });

  it("all 36 face pairs appear roughly equally", () => {
    const counts = new Array(36).fill(0) as number[];
    const trials = 36_000;
    for (let i = 0; i < trials; i++) {
      const [d1, d2] = roll2d6();
      counts[(d1 - 1) * 6 + (d2 - 1)]! += 1;
    }
    const expected = trials / 36;
    expect(chiSquare(counts, expected)).toBeLessThan(chiSquareCritical(35));
  });

  it("second-roll bust rate matches first-roll (~1/6), not forced", () => {
    const trials = 12_000;
    let bust1 = 0;
    let bust2 = 0;
    for (let i = 0; i < trials; i++) {
      const [a1, a2] = roll2d6();
      if (applyDiceRoll(50, { d1: a1, d2: a2 }, 1).busted) bust1 += 1;
      const [b1, b2] = roll2d6();
      if (applyDiceRoll(50, { d1: b1, d2: b2 }, 2).busted) bust2 += 1;
    }
    const p = 1 / 6;
    const expected = trials * p;
    // ±3.5% absolute band around 1/6 for both roll numbers.
    for (const bust of [bust1, bust2]) {
      expect(bust / trials).toBeGreaterThan(p - 0.035);
      expect(bust / trials).toBeLessThan(p + 0.035);
      expect(Math.abs(bust - expected)).toBeLessThan(expected * 0.22);
    }
    // Roll-2 must not be systematically higher than roll-1.
    expect(Math.abs(bust2 - bust1) / trials).toBeLessThan(0.04);
  });

  it("applyDiceRoll busts only on total 7 (not roll count)", () => {
    for (const rollNum of [1, 2, 3, 99]) {
      expect(applyDiceRoll(40, { d1: 3, d2: 4 }, rollNum).busted).toBe(true);
      expect(applyDiceRoll(40, { d1: 2, d2: 3 }, rollNum).busted).toBe(false);
      expect(applyDiceRoll(40, { d1: 6, d2: 6 }, rollNum).busted).toBe(false);
    }
  });

  it("deterministic mulberry seed locks roll2d6 sequence", () => {
    const rng = mulberry32(0x12345678);
    expect(roll2d6(rng)).toEqual([5, 4]);
    expect(roll2d6(rng)).toEqual([4, 4]);
    expect(roll2d6(rng)).toEqual([4, 4]);
    // Re-seed reproduces.
    const rng2 = mulberry32(0x12345678);
    expect(roll2d6(rng2)).toEqual([5, 4]);
  });

  it("randomInt rejection sampling stays in range", () => {
    for (let i = 0; i < 1000; i++) {
      const n = randomInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
    expect(() => randomInt(0)).toThrow(/bound/);
  });
});

describe("no biased Array.sort comparator in party server", () => {
  it("party server does not use sort(() => Math.random() - 0.5)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(
      resolve(__dirname, "../../../party/server.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/\.sort\(\s*\(\)\s*=>\s*Math\.random\s*\(\s*\)\s*-\s*0\.5\s*\)/);
    expect(src).toMatch(/fisherYatesShuffle/);
    expect(src).toMatch(/reshuffleSeatOrder/);
  });
});
