import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, rootToken, rulesFor } from "./contrast";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");
const css = read("../../app/globals.css");
const card = read("../../components/RushmoreCard.tsx");

describe("vote: your pick reads at a glance", () => {
  it("marks the pick with a badge + aria-pressed, not a ✓ glued to the name", () => {
    expect(card).toMatch(/aria-pressed=\{!!selected\}/);
    expect(card).toMatch(
      /className="rushmore-vote-badge"[^>]*>\s*✓ Your vote\s*</,
    );
    expect(card).not.toMatch(/selected \? " ✓"/);
  });

  it("paints the pick as ink on a light coral plate — never white on a tint", () => {
    const rules = rulesFor(css, ".rushmore-card-selected");
    expect(rules.length).toBeGreaterThan(0);
    for (const decls of rules) {
      expect(decls).not.toMatch(/(^|[^-])color:\s*#fff/i);
      expect(decls).not.toMatch(/gradient/);
      // Ring is an inset shadow, so the pick never changes the card's box.
      expect(decls).not.toMatch(/border(-width)?:\s*\d/);
    }
    const plate = rules
      .map((d) => d.match(/background:\s*(#[0-9a-f]{6})\s*;/i)?.[1])
      .find(Boolean);
    expect(plate).toBeDefined();
    expect(
      contrastRatio(rootToken(css, "text"), plate!),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the badge AA: white on the button coral", () => {
    const badge = rulesFor(css, ".rushmore-vote-badge").join("\n");
    expect(badge).toMatch(/background:\s*var\(--btn-bg\)/);
    expect(badge).toMatch(/(^|[^-])color:\s*#fff/);
    expect(
      contrastRatio("#ffffff", rootToken(css, "btn-bg")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("pops the badge in under 300ms on transform/opacity, off for reduced motion", () => {
    const kf =
      css.match(/@keyframes\s+vote-badge-in\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const props = [...kf.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(props.length).toBeGreaterThan(0);
    for (const p of props) expect(["opacity", "transform"]).toContain(p);
    expect(rulesFor(css, ".rushmore-vote-badge").join("\n")).toMatch(
      /animation:\s*vote-badge-in\s+var\(--motion-fast\)/,
    );
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce\)\s*\{\s*\.rushmore-vote-badge\s*\{\s*animation:\s*none/,
    );
  });

  it("drops the double-tap dim that flickered every card after a vote", () => {
    const guard = rulesFor(css, ".rushmore-card-disabled").join("\n");
    expect(guard).toMatch(/pointer-events:\s*none/);
    expect(guard).not.toMatch(/opacity/);
  });
});