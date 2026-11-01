import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(srcDir, p), "utf8");

describe("home: Join becomes primary when a code is typed", () => {
  const home = read("components/HomePage.tsx");
  const css = read("app/globals.css");

  it("toggles join-mode from any non-empty code and restores when cleared", () => {
    expect(home).toMatch(/home-cta-stack/);
    expect(home).toMatch(/home-cta-join-mode/);
    expect(home).toMatch(/code\.trim\(\)/);
    expect(home).toMatch(/Create game/);
    expect(home).toMatch(/home-create-slot/);
    expect(home).toMatch(/home-join-block/);
  });

  it("promotes Join to full-width primary and collapses Create without a hard cut", () => {
    expect(home).toMatch(
      /home-join-go[\s\S]{0,120}code\.trim\(\)\s*\?\s*"btn-primary"\s*:\s*"btn-secondary"/,
    );
    expect(home).toMatch(/onMouseDown=\{\(e\) => e\.preventDefault\(\)\}/);
    expect(css).toMatch(/\.home-cta-join-mode\s+\.home-create-slot/);
    expect(css).toMatch(/max-height:\s*0/);
    expect(css).toMatch(
      /\.home-cta-join-mode\s+\.home-join-block\s+\.home-join-go/,
    );
    expect(css).toMatch(/background:\s*var\(--btn-bg\)/);
    expect(css).toMatch(/width:\s*100%/);
  });

  it("keeps a subtle motion path with reduced-motion off-ramp", () => {
    expect(css).toMatch(/home-create-slot[\s\S]*?transition:/);
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*?\.home-create-slot/,
    );
  });
});
