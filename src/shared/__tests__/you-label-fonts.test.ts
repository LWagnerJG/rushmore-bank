import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const layout = readFileSync(
  resolve(__dirname, "../../app/layout.tsx"),
  "utf8",
);
const board = readFileSync(
  resolve(__dirname, "../../components/DraftBoard.tsx"),
  "utf8",
);
const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

describe("you-label + font trim", () => {
  it("shows You on the draft board column for the local player", () => {
    expect(board).toMatch(/railYouLabel\(\)/);
    expect(board).toMatch(/mine \? railYouLabel\(\)/);
    expect(board).toMatch(/Your pick/);
  });

  it("drops Nunito 400 from the font load list", () => {
    const nunito = layout.match(/Nunito\(\{[\s\S]*?\}\)/)?.[0] ?? "";
    expect(nunito).toMatch(/weight:\s*\["600",\s*"700",\s*"800"\]/);
    expect(nunito).not.toMatch(/"400"/);
    expect(css).toMatch(/body\s*\{[\s\S]*font-weight:\s*600/);
  });
});
