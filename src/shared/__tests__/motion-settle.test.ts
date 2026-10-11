import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const settleSrc = readFileSync(
  resolve(__dirname, "../../components/MotionSettle.tsx"),
  "utf8",
);
const roomSrc = readFileSync(
  resolve(__dirname, "../../components/RoomClient.tsx"),
  "utf8",
);
const homeSrc = readFileSync(
  resolve(__dirname, "../../components/HomePage.tsx"),
  "utf8",
);

const brandSrc = readFileSync(
  resolve(__dirname, "../../components/BrandMark.tsx"),
  "utf8",
);
const cueSrc = readFileSync(
  resolve(__dirname, "../../components/HostAiJudgeCue.tsx"),
  "utf8",
);
const pregameSrc = readFileSync(
  resolve(__dirname, "../../components/HostAiPreGameStatus.tsx"),
  "utf8",
);
const lobbySrc = readFileSync(
  resolve(__dirname, "../../components/LobbyPanel.tsx"),
  "utf8",
);

const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);

describe("MotionSettle wiring", () => {
  it("swaps to motion-settled after animationend", () => {
    expect(settleSrc).toMatch(/motion-settled/);
    expect(settleSrc).toMatch(/onAnimationEnd/);
    expect(settleSrc).toMatch(/setSettled\(true\)/);
  });

  it("room phase body uses MotionSettle + phase-enter for every phase", () => {
    expect(roomSrc).toMatch(/MotionSettle/);
    expect(roomSrc).toMatch(/motionClass="phase-enter"/);
    expect(roomSrc).toMatch(/key=\{phase \?\? "none"\}/);
    // No SCORE_REVEAL carve-out — every phase shares the enter
    expect(roomSrc).not.toMatch(/phase === "SCORE_REVEAL"\s*\?/);
  });

  it("home shell uses MotionSettle for animate-rise", () => {
    expect(homeSrc).toMatch(/MotionSettle/);
    expect(homeSrc).toMatch(/motionClass="animate-rise"/);
  });

  it("unifies home + phase enter at 200ms / 8–12px translateY", () => {
    expect(css).toMatch(/--motion-enter:\s*200ms/);
    expect(css).toMatch(/--motion-enter-y:\s*1[0-2]px/);
    expect(css).toMatch(
      /\.animate-rise,\s*\n?\s*\.phase-enter\s*\{[\s\S]*?screen-enter/,
    );
    const enter =
      css.match(
        /\.animate-rise,\s*\n?\s*\.phase-enter\s*\{[\s\S]*?\n\}/,
      )?.[0] ?? "";
    const enterDecls = enter.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(enterDecls).toMatch(/animation-fill-mode:\s*none/);
    expect(enterDecls).toMatch(/pointer-events:\s*auto/);
    expect(enterDecls).not.toMatch(/forwards|\bboth\b/);
    // Transform + opacity only in keyframes (no width/height/margin)
    const kf =
      css.match(/@keyframes\s+screen-enter\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(kf).toMatch(/opacity:\s*0/);
    expect(kf).toMatch(/translateY\(var\(--motion-enter-y\)\)/);
    expect(kf).not.toMatch(/width:|height:|margin:|padding:|top:|left:/);
  });

  it("honors prefers-reduced-motion (no enter motion)", () => {
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*?\.animate-rise[\s\S]*?\.phase-enter[\s\S]*?animation:\s*none/,
    );
  });

  it("room chrome BrandMark keeps shimmer off and solid wordmark path", () => {
    expect(roomSrc).toMatch(/BrandMark[^>]*shimmer=\{false\}/);
    expect(roomSrc).toMatch(/BrandMark[^>]*chrome/);
    expect(roomSrc).not.toMatch(/<BrandMark[^>]*\bhero\b/);
    expect(brandSrc).toMatch(/brand-mark-chrome-word|text-\[var\(--text\)\]/);
    expect(brandSrc).toMatch(/shapeRendering="auto"/);
    expect(brandSrc).toMatch(/brand-mark-hero-shine/);
  });

  it("keeps AI judge out of header chrome; host pre-game line is discreet", () => {
    expect(roomSrc).not.toMatch(/HostAiJudgeCue/);
    expect(roomSrc).not.toMatch(/variant="chrome"/);
    expect(cueSrc).not.toMatch(/host-ai-chrome/);
    expect(lobbySrc).toMatch(/HostAiPreGameStatus/);
    expect(pregameSrc).toMatch(/\/api\/judge/);
    expect(pregameSrc).not.toMatch(/pulse-soft|animate-/);
  });
});
