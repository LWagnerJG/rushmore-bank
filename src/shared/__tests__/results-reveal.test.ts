import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RESULTS_REVEAL_BUDGET_MS,
  WINNER_SWEEP_MS,
  clearRevealCompleted,
  countUpValue,
  hasRevealCompleted,
  markRevealCompleted,
  rankStandings,
  resultsRevealKey,
  revealOrderIndices,
  revealSchedule,
} from "@/lib/results-reveal";

const panel = readFileSync(
  resolve(__dirname, "../../components/ResultsPanel.tsx"),
  "utf8",
);
const list = readFileSync(
  resolve(__dirname, "../../components/ResultsRevealList.tsx"),
  "utf8",
);
const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);

describe("results reveal", () => {
  it("keeps total reveal under ~2.5s for typical player counts", () => {
    expect(RESULTS_REVEAL_BUDGET_MS).toBeLessThanOrEqual(2500);
    for (const n of [2, 3, 4, 6, 8]) {
      const { totalMs } = revealSchedule(n);
      expect(totalMs + WINNER_SWEEP_MS).toBeLessThanOrEqual(
        RESULTS_REVEAL_BUDGET_MS,
      );
      expect(totalMs).toBeGreaterThan(0);
    }
  });

  it("reveals last place before first for 2/4/6 players", () => {
    expect(revealOrderIndices(2)).toEqual([1, 0]);
    expect(revealOrderIndices(4)).toEqual([3, 2, 1, 0]);
    expect(revealOrderIndices(6)).toEqual([5, 4, 3, 2, 1, 0]);
    expect(revealOrderIndices(1)).toEqual([0]);
  });

  it("ranks ties with competition ranks and shared winners", () => {
    const ranked = rankStandings([
      { id: "a", name: "Ada", stones: 90 },
      { id: "b", name: "Bea", stones: 90 },
      { id: "c", name: "Cal", stones: 40 },
      { id: "d", name: "Dee", stones: 40 },
      { id: "e", name: "Eve", stones: 10 },
      { id: "f", name: "Fay", stones: 10 },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3, 3, 5, 5]);
    expect(ranked.filter((r) => r.isWinner).map((r) => r.id).sort()).toEqual([
      "a",
      "b",
    ]);
    // Last-to-first order still puts both winners after everyone else.
    const order = revealOrderIndices(ranked.length);
    const lastTwo = order.slice(-2).map((i) => ranked[i]!.id);
    expect(lastTwo.sort()).toEqual(["a", "b"]);
  });

  it("count-up eases from 0 to target", () => {
    expect(countUpValue(100, 0)).toBe(0);
    expect(countUpValue(100, 1)).toBe(100);
    expect(countUpValue(100, 0.5)).toBeGreaterThan(0);
    expect(countUpValue(100, 0.5)).toBeLessThan(100);
  });

  it("keys reveal on game identity, not phaseRevision", () => {
    const a = resultsRevealKey({
      code: "ABCD",
      createdAt: 100,
      phase: "GAME_RESULTS",
      topicRound: 4,
    });
    const b = resultsRevealKey({
      code: "ABCD",
      createdAt: 100,
      phase: "GAME_RESULTS",
      topicRound: 4,
    });
    const rematch = resultsRevealKey({
      code: "ABCD",
      createdAt: 200,
      phase: "GAME_RESULTS",
      topicRound: 4,
    });
    expect(a).toBe(b);
    expect(a).not.toBe(rematch);
    expect(panel).toMatch(/resultsRevealKey/);
    expect(panel).not.toMatch(/phaseRevision/);
    expect(list).toMatch(/hasRevealCompleted|markRevealCompleted/);
  });

  it("persists completion so reconnects stay idempotent", () => {
    const key = "test-game-1";
    clearRevealCompleted(key);
    expect(hasRevealCompleted(key)).toBe(false);
    markRevealCompleted(key);
    expect(hasRevealCompleted(key)).toBe(true);
    clearRevealCompleted(key);
    expect(hasRevealCompleted(key)).toBe(false);
  });

  it("wires ResultsRevealList into ResultsPanel with tap-to-skip", () => {
    expect(panel).toMatch(/ResultsRevealList/);
    expect(panel).toMatch(/showWinnerSweep=\{final\}/);
    expect(list).toMatch(/tap to skip/i);
    expect(list).toMatch(/prefersReducedMotion|prefers-reduced-motion/);
    expect(list).toMatch(/onClick/);
    // No early winner banner / crown / label before reveal
    expect(panel).not.toMatch(/endgame-winner-kicker/);
    expect(panel).not.toMatch(/endgame-winner-name/);
    expect(panel).not.toMatch(/>Winner</);
    expect(list).not.toMatch(/crown|🏆/);
  });

  it("declutters final screen to rank/name/total + rematch + home", () => {
    expect(panel).toMatch(/Rematch/);
    expect(panel).toMatch(/rematchReadyCast/);
    expect(panel).toMatch(/>\s*Home\s*</);
    expect(panel).not.toMatch(/Same room|no re-joins|endgame-winner-kicker/i);
    expect(panel).not.toMatch(/results-reveal-hint/);
    expect(list).not.toMatch(/results-reveal-hint/);
    expect(list).not.toMatch(/earned-badge|status-pill/);
  });

  it("animates with opacity/transform only and no layout jump", () => {
    expect(css).toMatch(/\.results-reveal-row/);
    const off =
      css.match(/\.results-reveal-row-off\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const on =
      css.match(/\.results-reveal-row-on\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(off).toMatch(/opacity:\s*0/);
    expect(on).toMatch(/opacity:\s*1/);
    // Rows keep space — no display:none / height:0
    expect(off).not.toMatch(/display:\s*none|height:\s*0|visibility:\s*hidden/);
    const rowMotion =
      css.match(
        /\.results-reveal-row(?:-on|-off)?\s*\{[\s\S]*?transition:[^;]+;/,
      )?.[0] ?? "";
    if (rowMotion.includes("transition:")) {
      expect(rowMotion).toMatch(/opacity|transform/);
      expect(rowMotion).not.toMatch(/filter|blur/);
    }
    expect(css).toMatch(/text-overflow:\s*ellipsis/);
    expect(css).toMatch(/@keyframes\s+endgame-green-sweep/);
    const sweep =
      css.match(/@keyframes\s+endgame-green-sweep\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(sweep).toMatch(/transform:\s*translateX/);
    expect(sweep).toMatch(/opacity/);
    expect(sweep).not.toMatch(/filter|blur/);
  });
});
