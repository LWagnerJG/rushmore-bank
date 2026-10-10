import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, rootToken, rulesFor } from "./contrast";

const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");
const rail = readFileSync(
  resolve(__dirname, "../../components/PlayerRail.tsx"),
  "utf8",
);

const px = (v: string) =>
  v.endsWith("rem") ? parseFloat(v) * 16 : parseFloat(v) || 0;

/** Exact-selector rule body (comments stripped). */
function rule(selector: string): string {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return clean.match(new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

/** How far a box-shadow paints past the box: above, below, and to the side. */
function shadowExtent(decls: string) {
  const value = decls.match(/box-shadow:\s*([^;]+);/)?.[1] ?? "";
  const layers = value.split(/,(?![^(]*\))/).map((l) => l.trim());
  let top = 0;
  let bottom = 0;
  let side = 0;
  for (const layer of layers) {
    if (layer.startsWith("inset")) continue;
    const [x = 0, y = 0, blur = 0, spread = 0] = (
      layer.replace(/rgba?\([^)]*\)|var\([^)]*\)/g, "").match(/-?[\d.]+(px)?/g) ?? []
    ).map(px);
    top = Math.max(top, blur + spread - y);
    bottom = Math.max(bottom, blur + spread + y);
    side = Math.max(side, blur + spread + Math.abs(x));
  }
  return { top, bottom, side };
}

describe("player rail: no dead band", () => {
  const track = rule(".player-rail-track");
  const [padTop, padInline, padBottom] = (
    track.match(/padding:\s*([^;]+);/)?.[1] ?? ""
  )
    .trim()
    .split(/\s+/)
    .map(px);

  it("keeps the track's scroll padding tight (was 1.1rem top / 3rem bottom)", () => {
    expect(padTop + padBottom).toBeLessThanOrEqual(32);
    expect(padInline).toBeLessThanOrEqual(16);
  });

  it("goes full-bleed so chips align with content and scroll to the screen edge", () => {
    expect(track).toMatch(/margin-inline:\s*-1rem/);
    expect(track).toMatch(/width:\s*auto/);
    expect(track).toMatch(/scroll-padding-inline:\s*1rem/);
    expect(rule(".player-rail-many::after")).toMatch(/right:\s*-1rem/);
    expect(rail).not.toMatch(/"player-rail mt-2"/);
  });

  it("contains every up-chip halo + lift inside the padding (no hard clip edge)", () => {
    const lift = 2;
    const scale = 2;
    for (const sel of [
      ".player-chip-up",
      ".player-chip-other.player-chip-up",
      ".player-chip-you.player-chip-up",
    ]) {
      const ext = shadowExtent(rule(sel));
      expect(ext.top + lift + scale, `${sel} top`).toBeLessThanOrEqual(padTop);
      expect(ext.bottom + scale, `${sel} bottom`).toBeLessThanOrEqual(padBottom);
      expect(ext.side + scale, `${sel} side`).toBeLessThanOrEqual(padInline);
    }
  });
});

describe("player rail: calm up-seat", () => {
  it("lifts once on transform only, under 300ms, with no fill mode", () => {
    const up = rule(".player-chip-up");
    const anim = up.match(/animation:\s*player-chip-up-in\s+(\d+)ms([^;]*);/);
    expect(anim).not.toBeNull();
    expect(Number(anim![1])).toBeLessThan(300);
    expect(anim![2]).not.toMatch(/both|forwards|infinite/);
    const kf =
      css.match(/@keyframes\s+player-chip-up-in\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const props = [...kf.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(props.length).toBeGreaterThan(0);
    for (const p of props) expect(p).toBe("transform");
  });

  it("never grows the up chip with a border (layout shift on every turn)", () => {
    for (const decls of rulesFor(css, ".player-chip-up")) {
      expect(decls).not.toMatch(/(^|[;\s])border(-width)?:/);
    }
  });

  it("keeps the You chip opaque so its white label stays AA", () => {
    for (const decls of rulesFor(css, ".player-chip-you")) {
      expect(decls).not.toMatch(/(^|[;\s])opacity:/);
    }
    expect(
      contrastRatio("#ffffff", rootToken(css, "btn-bg")),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
