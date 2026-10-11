import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, rootToken } from "./contrast";

const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);
const dice = readFileSync(
  resolve(__dirname, "../../components/DicePanel.tsx"),
  "utf8",
);
const brand = readFileSync(
  resolve(__dirname, "../../components/BrandMark.tsx"),
  "utf8",
);
const rail = readFileSync(
  resolve(__dirname, "../../components/PlayerRail.tsx"),
  "utf8",
);

describe("spacing scale + page tokens", () => {
  it("defines 4/8/12/16/24/32 and page/card tokens", () => {
    expect(css).toMatch(/--space-1:\s*4px/);
    expect(css).toMatch(/--space-2:\s*8px/);
    expect(css).toMatch(/--space-3:\s*12px/);
    expect(css).toMatch(/--space-4:\s*16px/);
    expect(css).toMatch(/--space-5:\s*24px/);
    expect(css).toMatch(/--space-6:\s*32px/);
    expect(css).toMatch(/--page-pad-x:\s*var\(--space-4\)/);
    expect(css).toMatch(/--card-pad:\s*var\(--space-4\)/);
    expect(css).toMatch(/--section-gap:\s*var\(--space-3\)/);
  });

  it("panels and settings use card-pad", () => {
    const panel = css.match(/\.panel\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(panel).toMatch(/padding:\s*var\(--card-pad\)/);
    // Bottom sheet: safe-area only (no extra cream dead band); body scrolls
    const sheet = css.match(/\.settings-sheet\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(sheet).toMatch(
      /padding-bottom:\s*env\(\s*safe-area-inset-bottom/,
    );
    expect(sheet).not.toMatch(/padding-bottom:\s*calc\(\s*16px/);
    expect(css).toMatch(/\.settings-sheet-body\s*\{/);
  });
});

describe("dice ticker speed + size", () => {
  it("runs ~1.8–2× faster with larger type and taller row", () => {
    expect(dice).toMatch(/Math\.max\(12,\s*seats\.length \* 3\.75\)/);
    expect(css).toMatch(/animation-duration:\s*14s/);
    const name = css.match(/\.dice-ticker-name\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const beans = css.match(/\.dice-ticker-beans\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const ticker = css.match(/\.dice-ticker\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(name).toMatch(/font-size:\s*0\.95rem/);
    expect(beans).toMatch(/font-size:\s*1\.05rem/);
    expect(ticker).toMatch(/min-height:\s*2rem/);
  });
});

describe("shared brand mark", () => {
  it("uses one 28–32px icon token (no large/chrome size fork)", () => {
    expect(css).toMatch(/--brand-icon-size:\s*30px/);
    expect(brand).toMatch(/brand-mark-icon/);
    expect(brand).not.toMatch(/large \? 72/);
    expect(brand).not.toMatch(/chrome \? 22/);
  });
});

describe("coral You chip contrast", () => {
  it("puts cream/white text on coral at ≥4.5:1", () => {
    const onCoral = rootToken(css, "on-coral");
    const btnBg = rootToken(css, "btn-bg");
    expect(contrastRatio(onCoral, btnBg)).toBeGreaterThanOrEqual(4.5);
    expect(css).toMatch(
      /\.player-chip-you[^{]*\{[^}]*color:\s*var\(--on-coral\)/,
    );
    expect(rail).toMatch(/wagerTotals/);
    expect(rail).toMatch(/totalBeans/);
    expect(rail).not.toMatch(/quietPotSplit/);
  });
});
