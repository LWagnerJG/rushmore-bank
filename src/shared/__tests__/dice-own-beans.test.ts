import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = resolve(__dirname, "../..");
const dice = readFileSync(resolve(srcDir, "components/DicePanel.tsx"), "utf8");
const css = readFileSync(resolve(srcDir, "app/globals.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("dice own-beans ownership", () => {
  it("shows Your beans under the tray only when you are not the roller", () => {
    expect(dice).toMatch(/showYourBeansUnder/);
    expect(dice).toMatch(/you\.role === "player" && !myTurn/);
    expect(dice).toMatch(/Your beans/);
    expect(dice).toMatch(/function BeanGlyph/);
    expect(dice).not.toMatch(/dice-roller-beans/);
  });

  it("pins the current roller with total + at risk, saying You when it is you", () => {
    expect(dice).toMatch(/function PinnedRoller/);
    expect(dice).toMatch(/railYouLabel/);
    expect(dice).toMatch(/At risk/);
    expect(dice).toMatch(/dice-pinned-roller/);
    expect(css).toMatch(/\.dice-pinned-roller/);
    expect(css).toMatch(/coral-ink/);
  });
});

describe("dice score ticker", () => {
  it("loops with translateX only, duplicates the set, and pauses on touch", () => {
    expect(dice).toMatch(/function ScoreTicker/);
    expect(dice).toMatch(/onPointerDown/);
    expect(dice).toMatch(/dice-ticker-paused/);
    expect(dice).toMatch(/aria-hidden="true"/);
    expect(css).toMatch(/@keyframes\s+dice-ticker-scroll/);
    expect(css).toMatch(/translateX\(-50%\)/);
    expect(css).toMatch(/animation-play-state:\s*paused/);
    // GPU transform only — no left/margin animation
    const keyframes =
      css.match(/@keyframes\s+dice-ticker-scroll\s*\{[\s\S]*?\}/)?.[0] ?? "";
    expect(keyframes).toMatch(/transform:\s*translateX/);
    expect(keyframes).not.toMatch(/(?:^|[;\s])(?:left|margin|width)\s*:/);
  });

  it("fades edges with mask-image and respects prefers-reduced-motion", () => {
    expect(css).toMatch(/mask-image:\s*linear-gradient/);
    expect(css).not.toMatch(/\.dice-ticker[^{]*\{[^}]*\bblur\b/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(dice).toMatch(/dice-ticker-static/);
    expect(dice).toMatch(/reducedMotion/);
  });
});
