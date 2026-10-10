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
  it("marks the under-tray total as Your beans with the bean glyph", () => {
    expect(dice).toMatch(/Your beans/);
    expect(dice).toMatch(/function BeanGlyph/);
    expect(dice).toMatch(/<BeanGlyph/);
    expect(dice).toMatch(/dice-your-beans-value/);
    expect(css).toMatch(/\.dice-your-beans-label/);
    expect(css).toMatch(/\.dice-bean-glyph/);
  });

  it("shows the other roller's beans only when it is not your turn", () => {
    expect(dice).toMatch(/!myTurn && roller && rollerBeans != null/);
    expect(dice).toMatch(/'s beans/);
    expect(dice).toMatch(/dice-roller-beans/);
  });

  it("keeps the beans row in the same height budget as the old Pot/Safe pair", () => {
    const row =
      css.match(/\.dice-beans-row\s*\{([^{}]*)\}/)?.[1] ?? "";
    expect(row).toMatch(/min-height:\s*2\.85rem/);
    expect(row).toMatch(/justify-content:\s*space-between/);
    // No hard rule or blur on the ownership row
    expect(row).not.toMatch(/border|backdrop-filter|filter|blur/);
  });
});
