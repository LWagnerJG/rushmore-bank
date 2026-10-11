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

describe("dice faces always show a number", () => {
  it("paints a face numeral on every die and the settled sum on the tray", () => {
    expect(scene).toMatch(/bean-pip-die-num/);
    expect(scene).toMatch(/data-die-number=\{paint\.face\}/);
    expect(scene).toMatch(/bean-dice-sum/);
    expect(scene).toMatch(/data-dice-sum=\{total\}/);
    expect(scene).toMatch(/data-dice-d1/);
    expect(scene).toMatch(/data-dice-d2/);
    expect(scene).toMatch(/data-dice-total/);
  });

  it("never paints a blank tumbling die while waiting for the first scramble tick", () => {
    expect(dieFace).toMatch(/scramblePaintPair\(phase\.seed/);
    expect(dieFace).toMatch(/Never paint a blank die mid-tumble/);
  });

  it("keeps face numbers and the result at full opacity (no both/forwards)", () => {
    const num =
      css.match(/\.bean-pip-die-num\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const sum = css.match(/\.bean-dice-sum\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(num).toMatch(/opacity:\s*1/);
    expect(sum).toMatch(/opacity:\s*1/);
    expect(num).not.toMatch(/forwards|\bboth\b/);
    expect(sum).not.toMatch(/forwards|\bboth\b/);
    expect(css).not.toMatch(
      /\.dice-result-fresh[\s\S]{0,80}animation:[^;]*\bboth\b/,
    );
    expect(css).not.toMatch(
      /\.dice-result-bust[\s\S]{0,200}animation:[^;]*\bboth\b/,
    );
    expect(css).toMatch(/pointer:\s*coarse[\s\S]*bean-pip-die-num[\s\S]*opacity:\s*1/);
  });

  it("uses high-contrast ink for the face numeral on cream", () => {
    expect(contrastRatio("#1c3a32", "#fff8ec")).toBeGreaterThanOrEqual(7);
    expect(css).toMatch(/\.bean-pip-die-num[\s\S]*background:\s*#1c3a32/);
    expect(css).toMatch(/\.bean-pip-die-num[\s\S]*color:\s*#fff8ec/);
  });

  it("keeps the ticker under the tray so it cannot cover faces", () => {
    const ticker = css.match(/\.dice-ticker\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const tray = css.match(/\.dice-stage-tray\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(ticker).toMatch(/z-index:\s*0/);
    expect(tray).toMatch(/z-index:\s*2/);
  });
});
