import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

const srcDir = resolve(__dirname, "../..");
const css = readFileSync(resolve(srcDir, "app/globals.css"), "utf8");
const scene = readFileSync(
  resolve(srcDir, "components/dice/DiceScene.tsx"),
  "utf8",
);
const dieFace = readFileSync(
  resolve(srcDir, "shared/engine/die-face.ts"),
  "utf8",
);

describe("dice faces are pips-only with one landed total", () => {
  it("paints large pips and a centered total under the tray — no corner chips", () => {
    expect(scene).toMatch(/DIE_PIP_CLASS|bean-pip-die-pip/);
    expect(scene).toMatch(/bean-dice-landed-total/);
    expect(scene).toMatch(/data-dice-landed-total=\{total\}/);
    expect(scene).toMatch(/data-dice-d1/);
    expect(scene).toMatch(/data-dice-d2/);
    expect(scene).toMatch(/data-dice-total/);
    expect(scene).not.toMatch(/bean-pip-die-num/);
    expect(scene).not.toMatch(/data-die-number/);
    expect(scene).not.toMatch(/bean-dice-sum/);
    expect(scene).toMatch(/r="8\.4"/);
  });

  it("never paints a blank tumbling die while waiting for the first scramble tick", () => {
    expect(dieFace).toMatch(/scramblePaintPair\(phase\.seed/);
    expect(dieFace).toMatch(/Never paint a blank die mid-tumble/);
  });

  it("keeps pips and the landed total at full opacity (no both/forwards)", () => {
    const pip =
      css.match(/\.bean-pip-die-pip\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const total =
      css.match(/\.bean-dice-landed-total\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(pip).toMatch(/fill:\s*#10261f/);
    expect(total).toMatch(/opacity:\s*1/);
    expect(total).not.toMatch(/forwards|\bboth\b/);
    expect(css).not.toMatch(
      /\.dice-result-fresh[\s\S]{0,80}animation:[^;]*\bboth\b/,
    );
    expect(css).not.toMatch(
      /\.dice-result-bust[\s\S]{0,200}animation:[^;]*\bboth\b/,
    );
    expect(css).toMatch(
      /pointer:\s*coarse[\s\S]*bean-pip-die-pip[\s\S]*opacity:\s*1/,
    );
  });

  it("uses high-contrast ink for pips on cream", () => {
    expect(contrastRatio("#10261f", "#fff8ec")).toBeGreaterThanOrEqual(7);
    expect(contrastRatio("#10261f", "#fffdf6")).toBeGreaterThanOrEqual(7);
    expect(css).toMatch(/\.bean-pip-die-pip[\s\S]*fill:\s*#10261f/);
    expect(css).toMatch(/\.bean-pip-die-body[\s\S]*fill:\s*#fff8ec/);
  });

  it("keeps the ticker under the tray so it cannot cover faces", () => {
    const ticker = css.match(/\.dice-ticker\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const tray = css.match(/\.dice-stage-tray\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(ticker).toMatch(/z-index:\s*0/);
    expect(tray).toMatch(/z-index:\s*2/);
  });
});
