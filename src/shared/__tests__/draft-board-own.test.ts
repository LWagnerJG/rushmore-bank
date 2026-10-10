import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const board = readFileSync(
  resolve(__dirname, "../../components/DraftBoard.tsx"),
  "utf8",
);
const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);

describe("draft board own-pick tint", () => {
  it("marks own picks with a single solid tint class", () => {
    expect(board).toMatch(/draft-board-cell-mine/);
    expect(css).toMatch(/\.draft-board-cell-mine\s*\{/);
    const mine =
      css.match(/\.draft-board-cell-mine\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(mine).toMatch(/background:\s*#d8ebe2/);
    expect(mine).not.toMatch(/gradient|blur|filter/);
  });

  it("drops You badge / stacked own-column chrome", () => {
    expect(board).not.toMatch(/draft-board-you-label/);
    expect(board).not.toMatch(/>\s*You\s*</);
  });

  it("does not jump-to-column on draft cursor", () => {
    expect(board).not.toMatch(/offsetLeft/);
    expect(board).not.toMatch(/scrollLeft\s*=\s*Math\.max/);
    expect(board).not.toMatch(/activeCell/);
  });

  it("does not use a sticky header strip", () => {
    const th =
      css.match(/\.draft-board-table thead th\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const decls = th.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(decls).toMatch(/position:\s*static/);
    expect(decls).not.toMatch(/position:\s*sticky/);
  });
});
