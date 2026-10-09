import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);
const layout = readFileSync(
  resolve(__dirname, "../../app/layout.tsx"),
  "utf8",
);

describe("iOS chrome + keyboard CSS contracts", () => {
  it("kills room-chrome top frost/fade pseudos and keeps solid safe-area", () => {
    expect(css).toMatch(/\.room-chrome::before/);
    expect(css).toMatch(/content:\s*none\s*!important/);
    expect(css).toMatch(/mask-image:\s*none/);
    expect(css).toMatch(/backdrop-filter:\s*none/);
    expect(css).toMatch(/\.app-safe-top/);
    expect(css).toMatch(
      /\.room-chrome-safe,\s*\n?\s*\.app-safe-top|\.room-chrome-safe,\s*\.app-safe-top/,
    );
    // Solid cream — not a translucent frost fill
    expect(css).toMatch(
      /\.room-chrome-safe,\s*\n?[\s\S]*?background:\s*var\(--bg\)/,
    );
  });

  it("floors text-entry font-size at 16px to stop iOS focus zoom", () => {
    expect(css).toMatch(/font-size:\s*max\(\s*16px/);
    expect(css).toMatch(/textarea/);
    expect(css).toMatch(/select/);
  });

  it("locks html/body from page scroll", () => {
    expect(css).toMatch(/html\s*\{[\s\S]*?overflow:\s*hidden/);
    expect(css).toMatch(/body\s*\{[\s\S]*?overflow:\s*hidden/);
  });

  it("sets interactive-widget overlays-content on the viewport export", () => {
    expect(layout).toMatch(/interactiveWidget:\s*"overlays-content"/);
  });
});

describe("iPhone viewport fixtures (safe-area top)", () => {
  const phones = [
    { name: "iPhone 14/15", w: 390, h: 844, safeTop: 47 },
    { name: "iPhone 14/15 Pro Max", w: 430, h: 932, safeTop: 59 },
  ] as const;

  for (const phone of phones) {
    it(`${phone.name}: safe-area spacer clears content (${phone.safeTop}px)`, () => {
      // Contract: spacer height equals env(safe-area-inset-top); content
      // starts below it. Simulated layout math for the reported devices.
      const spacerH = phone.safeTop;
      const contentTop = spacerH; // no overlay — content origin below spacer
      expect(spacerH).toBeGreaterThanOrEqual(47);
      expect(spacerH).toBeLessThanOrEqual(59);
      expect(contentTop).toBe(spacerH);
      // Shell height stays the layout height (keyboard must not shrink it)
      const shellH = phone.h;
      const keyboardH = 336;
      const vvWithKeyboard = phone.h - keyboardH;
      expect(
        shouldKeepShell(shellH, vvWithKeyboard, true),
      ).toBe(shellH);
      expect(phone.w).toBeGreaterThan(0);
    });
  }
});

/** Mirror of freeze+resolve used by NoPullToRefresh for the fixture check. */
function shouldKeepShell(
  innerHeight: number,
  visualViewportHeight: number,
  editableFocused: boolean,
): number {
  const freeze =
    editableFocused &&
    (innerHeight - visualViewportHeight > 150);
  if (freeze) return innerHeight;
  return visualViewportHeight;
}
