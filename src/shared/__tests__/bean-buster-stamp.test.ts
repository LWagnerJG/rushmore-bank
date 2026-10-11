import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BEAN_BUSTER_STAMP_HOLD_MS,
  BEAN_BUSTER_STAMP_OUT_MS,
  BEAN_BUSTER_STAMP_SHAKE_MS,
  BEAN_BUSTER_STAMP_SLAM_MS,
  BEAN_BUSTER_STAMP_TOTAL_MS,
  beanBusterStampCaption,
  beanBusterStampRotationDeg,
} from "../bean-buster-stamp";

const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);
const stamp = readFileSync(
  resolve(__dirname, "../../components/BeanBusterStamp.tsx"),
  "utf8",
);
const dice = readFileSync(
  resolve(__dirname, "../../components/DicePanel.tsx"),
  "utf8",
);
const sfx = readFileSync(resolve(__dirname, "../../lib/sfx.ts"), "utf8");

describe("bean buster stamp contracts", () => {
  it("uses BEAN BUSTER wording (not BUSTED)", () => {
    expect(stamp).toMatch(/>BEAN BUSTER</);
    expect(stamp).not.toMatch(/BEAN BUSTED/);
    expect(stamp).toMatch(/beanBusterStampCaption/);
  });

  it("is a fixed high-z overlay with pointer-events none", () => {
    expect(css).toMatch(/\.bean-buster-stamp\s*\{[\s\S]*?position:\s*fixed/);
    expect(css).toMatch(/\.bean-buster-stamp\s*\{[\s\S]*?z-index:\s*90/);
    expect(css).toMatch(
      /\.bean-buster-stamp\s*\{[\s\S]*?pointer-events:\s*none/,
    );
  });

  it("slams instantly (no fade-in) with ~120ms scale + ~250ms shake", () => {
    expect(BEAN_BUSTER_STAMP_SLAM_MS).toBe(120);
    expect(BEAN_BUSTER_STAMP_SHAKE_MS).toBe(250);
    expect(BEAN_BUSTER_STAMP_HOLD_MS).toBe(1400);
    expect(BEAN_BUSTER_STAMP_OUT_MS).toBe(80);
    expect(BEAN_BUSTER_STAMP_TOTAL_MS).toBe(1480);
    expect(css).toMatch(/bean-buster-stamp-slam\s+120ms/);
    expect(css).toMatch(/bean-buster-stamp-shake\s+250ms/);
    expect(css).toMatch(/scale\(1\.6\)/);
    // Instant appear — stamp root must not fade opacity in
    const root =
      css.match(/\.bean-buster-stamp\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(root).not.toMatch(/opacity:\s*0/);
  });

  it("uses SVG distress filter (no heavy bitmap)", () => {
    expect(stamp).toMatch(/feTurbulence/);
    expect(stamp).toMatch(/feDisplacementMap/);
    expect(stamp).toMatch(/bean-buster-distress/);
    expect(css).toMatch(/filter:\s*url\(#bean-buster-distress\)/);
  });

  it("honors prefers-reduced-motion (no shake, static stamp)", () => {
    expect(stamp).toMatch(/bean-buster-stamp-reduced/);
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*?\.bean-buster-stamp/,
    );
    expect(css).toMatch(/\.bean-buster-stamp-reduced/);
  });

  it("wires into DicePanel for every client on bust", () => {
    expect(dice).toMatch(/BeanBusterStamp/);
    expect(dice).toMatch(/active=\{showBust\}/);
    expect(dice).toMatch(/got busted|beanBusterStampCaption|bustRollerName/);
  });

  it("bust SFX is thump + buzzer (square/saw)", () => {
    expect(sfx).toMatch(/case "bust"/);
    expect(sfx).toMatch(/type:\s*"square"/);
    expect(sfx).toMatch(/type:\s*"sawtooth"/);
  });

  it("rotation stays in [-12, -6] and is stable per rollId", () => {
    const a = beanBusterStampRotationDeg("roll-abc");
    const b = beanBusterStampRotationDeg("roll-abc");
    const c = beanBusterStampRotationDeg("roll-xyz");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(-12);
    expect(a).toBeLessThanOrEqual(-6);
    expect(c).toBeGreaterThanOrEqual(-12);
    expect(c).toBeLessThanOrEqual(-6);
  });

  it("caption names the roller", () => {
    expect(beanBusterStampCaption("Sam", false)).toBe("Sam got busted");
    expect(beanBusterStampCaption("Sam", true)).toBe("You got busted");
  });
});
