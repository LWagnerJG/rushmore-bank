import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wager = readFileSync(
  resolve(__dirname, "../../components/WagerPanel.tsx"),
  "utf8",
);
const slider = readFileSync(
  resolve(__dirname, "../../components/WagerSlider.tsx"),
  "utf8",
);
const score = readFileSync(
  resolve(__dirname, "../../components/ScorePanel.tsx"),
  "utf8",
);
const rushmore = readFileSync(
  resolve(__dirname, "../../components/RushmoreCard.tsx"),
  "utf8",
);
const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

describe("wager declutter", () => {
  it("shows one stake and clear seconds on the timer", () => {
    expect(wager).toMatch(/wager-stake/);
    expect(wager).not.toMatch(/Stay safe|At risk/);
    expect(wager).toMatch(/\{left\}s/);
    expect(wager).not.toMatch(/wager-timer-label|wager-timer-unit/);
  });

  it("slider ends are bare numbers (not “1 min”)", () => {
    expect(slider).toMatch(/\{min\}/);
    expect(slider).toMatch(/\{max\}/);
    expect(slider).not.toMatch(/\{min\} min/);
  });
});

describe("results declutter", () => {
  it("uses one quiet +N without the base/AI/votes equation", () => {
    expect(score).toMatch(/earned-badge-quiet/);
    expect(score).not.toMatch(/base \+|votes \*|earned-badge-split/);
  });

  it("always shows AI why inline — no toggle or Why label", () => {
    expect(rushmore).toMatch(/className=\"rushmore-why\"/);
    expect(rushmore).not.toMatch(/rushmore-why-toggle|whyOpen|Hide why/);
    expect(rushmore).not.toMatch(/>Why</);
    expect(css).toMatch(/\.rushmore-why\s*\{/);
    expect(css).not.toMatch(/\.rushmore-why-toggle/);
  });

  it("avoids nested buttons on interactive cards", () => {
    expect(rushmore).toMatch(/role=\"button\"/);
    expect(rushmore).not.toMatch(
      /interactive[\s\S]*return \(\s*<button[\s\S]*rushmore-why/,
    );
  });
});
