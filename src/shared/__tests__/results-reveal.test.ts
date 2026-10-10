import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RESULTS_REVEAL_BUDGET_MS,
  countUpValue,
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
  it("keeps total reveal under 2s for typical player counts", () => {
    expect(RESULTS_REVEAL_BUDGET_MS).toBeLessThan(2000);
    for (const n of [2, 3, 4, 6, 8]) {
      const { totalMs } = revealSchedule(n);
      expect(totalMs).toBeLessThan(2000);
      expect(totalMs).toBeGreaterThan(0);
    }
  });

  it("reveals last place before first", () => {
    expect(revealOrderIndices(4)).toEqual([3, 2, 1, 0]);
    expect(revealOrderIndices(1)).toEqual([0]);
  });

  it("count-up eases from 0 to target", () => {
    expect(countUpValue(100, 0)).toBe(0);
    expect(countUpValue(100, 1)).toBe(100);
    expect(countUpValue(100, 0.5)).toBeGreaterThan(0);
    expect(countUpValue(100, 0.5)).toBeLessThan(100);
  });

  it("wires ResultsRevealList into ResultsPanel with tap-to-skip", () => {
    expect(panel).toMatch(/ResultsRevealList/);
    expect(list).toMatch(/Tap to skip|tap to skip/i);
    expect(list).toMatch(/prefersReducedMotion|prefers-reduced-motion/);
    expect(list).toMatch(/onClick/);
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
  });
});
