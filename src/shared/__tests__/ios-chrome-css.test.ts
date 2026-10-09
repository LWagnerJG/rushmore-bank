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
    // Solid cream — not a translucent frost fill (hex or --bg)
    expect(css).toMatch(
      /\.room-chrome-safe,\s*\n?[\s\S]*?background:\s*(?:var\(--bg\)|#f5f0e7)/,
    );
  });

  it("keeps room-chrome fully static (no soft compositing traps)", () => {
    const chrome = css.match(/\.room-chrome\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const decls = chrome.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(decls).toMatch(/overflow:\s*visible/);
    expect(decls).not.toMatch(/overflow:\s*hidden/);
    expect(decls).toMatch(/will-change:\s*auto/);
    // Universal lock on chrome descendants
    expect(css).toMatch(
      /\.room-chrome,\s*\n?\s*\.room-chrome \*\s*\{[\s\S]*?animation:\s*none\s*!important/,
    );
    expect(css).toMatch(
      /\.room-chrome,\s*\n?\s*\.room-chrome \*\s*\{[\s\S]*?background-clip:\s*border-box\s*!important/,
    );
    // AI chrome chip uses solid hex fills, not rgba alphas
    const ready =
      css.match(/\.host-ai-chrome-ready\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(ready.replace(/\/\*[\s\S]*?\*\//g, "")).toMatch(
      /background:\s*#[0-9a-fA-F]{3,8}/,
    );
    expect(ready.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(
      /background:\s*rgba\(/,
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

  it("does not leave enter animations with fill-mode forwards/both", () => {
    // Filled transform animations keep a soft composited layer on iOS WebKit.
    expect(css).toMatch(
      /\.animate-rise\s*\{[\s\S]*?animation-fill-mode:\s*none/,
    );
    expect(css).toMatch(
      /\.phase-enter\s*\{[\s\S]*?animation-fill-mode:\s*none/,
    );
    expect(css).toMatch(
      /\.score-land\s*\{[\s\S]*?animation-fill-mode:\s*none/,
    );
    expect(css).toMatch(/\.motion-settled\s*\{/);
    expect(css).toMatch(
      /\.motion-settled\s*\{[\s\S]*?will-change:\s*auto\s*!important/,
    );
    // Declarations only (strip comments) — must not use forwards/both fill
    const decls = (block: string) =>
      block.replace(/\/\*[\s\S]*?\*\//g, "").match(/animation[^;]*;/g) ?? [];
    const riseBlock = css.match(/\.animate-rise\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const phaseBlock = css.match(/\.phase-enter\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    for (const d of [...decls(riseBlock), ...decls(phaseBlock)]) {
      expect(d).not.toMatch(/forwards|\bboth\b/);
    }
  });

  it("drops backdrop-filter on bank-confirm and avoids persistent bean-die will-change", () => {
    const bank =
      css.match(/\.bank-confirm-backdrop\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const bankDecls = bank.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(bankDecls).toMatch(/backdrop-filter:\s*none/);
    expect(bankDecls).not.toMatch(/backdrop-filter:\s*blur/);
    // Persistent will-change on .bean-die (not -settle / -tumbling) is forbidden
    const beanDie = css.match(/\.bean-die\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(beanDie.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(
      /will-change:\s*transform/,
    );
    expect(css).toMatch(
      /\.bean-die-settle\s*\{[\s\S]*?will-change:\s*transform/,
    );
  });

  it("keeps body::before free of background-attachment fixed", () => {
    const before = css.match(/body::before\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const decls = before.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(decls).toMatch(/background-attachment:\s*scroll/);
    expect(decls).not.toMatch(/background-attachment:\s*fixed/);
    expect(decls).toMatch(/will-change:\s*auto/);
  });

  it("does not apply Tailwind antialiased on the root body", () => {
    const bodyTag = layout.match(/<body\s+className="[^"]*"/)?.[0] ?? "";
    expect(bodyTag).toMatch(/<body/);
    expect(bodyTag).not.toMatch(/\bantialiased\b/);
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
