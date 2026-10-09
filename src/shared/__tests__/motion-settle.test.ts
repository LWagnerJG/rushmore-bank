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
  resolve(__dirname, "../../app/page.tsx"),
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

describe("MotionSettle wiring", () => {
  it("swaps to motion-settled after animationend", () => {
    expect(settleSrc).toMatch(/motion-settled/);
    expect(settleSrc).toMatch(/onAnimationEnd/);
    expect(settleSrc).toMatch(/setSettled\(true\)/);
  });

  it("room phase body uses MotionSettle + phase-enter (not bare forwards class)", () => {
    expect(roomSrc).toMatch(/MotionSettle/);
    expect(roomSrc).toMatch(/motionClass="phase-enter"/);
  });

  it("home shell uses MotionSettle for animate-rise", () => {
    expect(homeSrc).toMatch(/MotionSettle/);
    expect(homeSrc).toMatch(/motionClass="animate-rise"/);
  });

  it("room chrome BrandMark keeps shimmer off and solid wordmark path", () => {
    expect(roomSrc).toMatch(/BrandMark\s+shimmer=\{false\}/);
    expect(brandSrc).toMatch(/text-\[var\(--text\)\]/);
    expect(brandSrc).toMatch(/shapeRendering="auto"/);
  });

  it("chrome AI cue stays a static chip (no pulse class)", () => {
    expect(cueSrc).toMatch(/host-ai-chrome/);
    expect(cueSrc).not.toMatch(/pulse-soft|animate-/);
    expect(roomSrc).toMatch(/variant="chrome"/);
  });
});
