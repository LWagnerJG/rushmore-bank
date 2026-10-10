import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, mixHex, rootToken, rulesFor } from "./contrast";

const srcDir = resolve(__dirname, "../..");
const css = readFileSync(resolve(srcDir, "app/globals.css"), "utf8");
const scene = readFileSync(resolve(srcDir, "components/dice/DiceScene.tsx"), "utf8");
const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Declarations of every rule whose selector is exactly `sel`. */
function rule(sel: string): string {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bodies = [...clean.matchAll(new RegExp(`(?:^|[{}])\\s*${esc}\\s*\\{([^{}]*)\\}`, "g"))];
  if (bodies.length === 0) throw new Error(`no rule for ${sel}`);
  return bodies.map((m) => m[1]).join("\n");
}

function decl(body: string, prop: string): string {
  const v = body.match(new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;]+);`))?.[1]?.trim();
  if (!v) throw new Error(`no ${prop} in ${body}`);
  return v.replace(/\s+/g, " ");
}

const REM = 16;
function px(v: string): number {
  const m = /^(-?[\d.]+)(px|rem)$/.exec(v.trim());
  if (!m) throw new Error(`expected px/rem, got "${v}"`);
  return Number(m[1]) * (m[2] === "rem" ? REM : 1);
}

function rgba(v: string): { hex: string; a: number } {
  const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(v);
  if (!m) throw new Error(`expected rgba(), got "${v}"`);
  const hex = `#${[m[1], m[2], m[3]].map((c) => Number(c).toString(16).padStart(2, "0")).join("")}`;
  return { hex, a: Number(m[4]) };
}

describe("dice screen fits a 375×667 phone", () => {
  const layout = rule(".dice-layout");

  it("sizes the tray from the small viewport, net of the top inset and bottom pad", () => {
    const tray = decl(layout, "--dice-tray-h");
    // svh never changes as Safari's toolbar collapses, so the tray never resizes mid-turn.
    expect(tray).toMatch(/100svh/);
    expect(tray).not.toMatch(/dvh|lvh|\d+vh/);
    expect(tray).toMatch(/env\(safe-area-inset-top, 0px\)/);
    expect(tray).toMatch(/var\(--phase-pad-b\)/);
    const [, floor, ceiling] = /^clamp\( ?(\d+)px, .*, (\d+)px ?\)$/.exec(tray) ?? [];
    expect(Number(floor)).toBeGreaterThanOrEqual(180);
    expect(Number(ceiling)).toBe(260);
  });

  it("keeps one tray height on every beat, so arming your turn never moves Bank", () => {
    expect(decl(rule(".bean-dice-tray"), "height")).toMatch(/^var\(--dice-tray-h/);
    const trayRules = rulesFor(css, "bean-dice-tray");
    const heights = trayRules.flatMap((b) => [...b.matchAll(/(?:^|[;\s])((?:min-|max-)?height)\s*:/g)].map((m) => m[1]));
    expect(heights).toEqual(["height"]);
  });

  it("sizes the die from the tray so the first-roll TAP chip stays clear", () => {
    expect(decl(layout, "--dice-die")).toBe(
      "min(138px, calc(var(--dice-tray-h) - 90px), calc(50vw - 50px))",
    );
    const die = rule(".bean-pip-die");
    expect(decl(die, "width")).toBe("var(--dice-die, 138px)");
    expect(decl(die, "height")).toBe("var(--dice-die, 138px)");

    const hint = rule(".bean-dice-hint");
    const first = rule(".bean-dice-hint-first");
    const [padY] = decl(first, "padding").split(" ");
    const chipBottom =
      px(decl(hint, "top").replace(" !important", "")) +
      px(decl(first, "font-size")) * Number(decl(first, "line-height")) +
      2 * px(padY) +
      2 * 1.5;
    // The die is centred, so `tray - 90px` leaves 45px above it.
    expect(90 / 2).toBeGreaterThanOrEqual(chipBottom + 4);
  });

  it("gives the closed party slot no layout gap", () => {
    const gap = px(decl(layout, "gap"));
    expect(px(decl(rule(".dice-party-slot"), "margin-top"))).toBe(-gap);
    expect(px(decl(rule(".dice-party-slot-inner > *"), "margin-top"))).toBe(gap);
  });

  it("holds the stage header's height when a bust swaps in the smaller spectator title", () => {
    const display = /clamp\(([\d.]+rem)/.exec(rootToken(css, "text-display"))?.[1] ?? "";
    const status = rule(".dice-up-status");
    const natural =
      px(display) * Number(rootToken(css, "leading-display")) +
      px(decl(status, "margin-top")) +
      px(rootToken(css, "text-meta")) * Number(rootToken(css, "leading-meta"));
    expect(px(decl(rule(".dice-stage-chrome"), "min-height"))).toBeGreaterThanOrEqual(natural);
  });
});

describe("dice paint", () => {
  it("draws the die shadow without a filter", () => {
    expect(clean).not.toMatch(/drop-shadow\(/);
    for (const body of rulesFor(css, "bean-pip-die")) {
      expect(body).not.toMatch(/(?:^|[;\s])(?:-webkit-)?filter\s*:\s*(?!none)/);
    }
    expect(decl(rule(".bean-pip-die::before"), "box-shadow")).toMatch(/rgba\(16, 45, 37/);
    expect(scene).not.toMatch(/filter=|<filter|feGaussianBlur|feDropShadow/);
  });

  it("prints the bust line in coral ink, with headroom over AA for its large type", () => {
    const title = rule(".dice-result-bust-title");
    expect(decl(title, "color")).toBe("var(--coral-ink)");
    expect(decl(title, "font-weight")).toBe("800");
    expect(decl(title, "font-size")).toMatch(/^clamp\(1\.2rem,/);

    const tint = rgba(decl(rule(".dice-result-bust"), "background"));
    const mint = rgba(
      decl(rule(".dice-stage-panel"), "background").match(/rgba\(167, 215, 194, [\d.]+\)/)?.[0] ?? "",
    );
    const ink = rootToken(css, "coral-ink");
    // Darkest chip pixel: the tint's top stop over the panel's mint band, on either page.
    for (const page of [rootToken(css, "bg"), "#ffe8d4"]) {
      const chip = mixHex(tint.hex, mixHex(mint.hex, page, mint.a), tint.a);
      expect(contrastRatio(ink, chip), page).toBeGreaterThanOrEqual(4);
    }
  });
});
