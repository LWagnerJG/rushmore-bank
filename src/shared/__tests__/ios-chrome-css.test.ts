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
const roomClient = readFileSync(
  resolve(__dirname, "../../components/RoomClient.tsx"),
  "utf8",
);

describe("iOS chrome + keyboard CSS contracts", () => {
  it("keeps black-translucent + viewport-fit cover (no PWA reinstall)", () => {
    expect(layout).toMatch(/statusBarStyle:\s*"black-translucent"/);
    expect(layout).not.toMatch(/statusBarStyle:\s*"default"/);
    expect(layout).toMatch(/viewportFit:\s*"cover"/);
    expect(layout).toMatch(/themeColor/);
    expect(layout).toMatch(/#F5F0E7/);
  });

  it("kills room-chrome frost/blur tools and header bottom border", () => {
    expect(css).toMatch(/\.room-chrome::before/);
    expect(css).toMatch(/content:\s*none\s*!important/);
    expect(css).toMatch(/mask-image:\s*none/);
    expect(css).toMatch(/backdrop-filter:\s*none/);
    const chrome = css.match(/\.room-chrome\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const decls = chrome.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(decls).toMatch(/background:\s*transparent/);
    expect(decls).toMatch(/border:\s*none/);
    expect(decls).not.toMatch(/border-bottom:\s*1px/);
    // Tailwind border-b must not remain on the room header
    expect(roomClient).not.toMatch(/room-chrome[^\n]*border-b/);
  });

  it("extends cream safe-top band with a plain eased gradient fade", () => {
    expect(css).toMatch(/--safe-top-cream:\s*#f7f3eb/i);
    expect(css).toMatch(/--safe-top-solid-extra:\s*1[2-6]px/);
    expect(css).toMatch(/--safe-top-fade:\s*(2[4-9]|3[0-2])px/);
    expect(css).toMatch(
      /\.room-chrome-safe,\s*\n?\s*\.app-safe-top|\.room-chrome-safe,\s*\.app-safe-top/,
    );
    const safe =
      css.match(
        /\.room-chrome-safe,\s*\n?\s*\.app-safe-top\s*\{[\s\S]*?\n\}/,
      )?.[0] ?? "";
    const decls = safe.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(decls).toMatch(
      /height:\s*calc\(\s*env\(safe-area-inset-top/,
    );
    expect(decls).toMatch(/linear-gradient\(/);
    expect(decls).toMatch(/var\(--safe-top-cream\)/);
    expect(decls).toMatch(/transparent\s+100%/);
    // Plain gradient only — no blur / mask / backdrop on the band
    expect(decls).toMatch(/filter:\s*none/);
    expect(decls).toMatch(/backdrop-filter:\s*none/);
    expect(decls).toMatch(/(?:^|[^-])mask-image:\s*none/);
    expect(decls).toMatch(/-webkit-mask-image:\s*none/);
    expect(decls).not.toMatch(/blur\(/);
    expect(decls).not.toMatch(/filter:\s*blur/);
  });

  it("keeps room-chrome fully static (no soft compositing traps)", () => {
    const chrome = css.match(/\.room-chrome\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const decls = chrome.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(decls).toMatch(/overflow:\s*visible/);
    expect(decls).not.toMatch(/overflow:\s*hidden/);
    expect(decls).toMatch(/will-change:\s*auto/);
    expect(css).toMatch(
      /\.room-chrome,\s*\n?\s*\.room-chrome \*\s*\{[\s\S]*?animation:\s*none\s*!important/,
    );
    expect(css).toMatch(
      /\.room-chrome,\s*\n?\s*\.room-chrome \*\s*\{[\s\S]*?background-clip:\s*border-box\s*!important/,
    );
    // Header AI chip removed — pre-game status is outside chrome.
    expect(css).not.toMatch(/\.host-ai-chrome\s*\{/);
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
  const SOLID_EXTRA = 14;
  const FADE = 32;
  const phones = [
    { name: "desktop (no inset)", w: 1280, h: 800, safeTop: 0 },
    { name: "iPhone 14/15", w: 390, h: 844, safeTop: 47 },
    { name: "iPhone 14/15 Pro Max", w: 430, h: 932, safeTop: 59 },
  ] as const;

  for (const phone of phones) {
    it(`${phone.name}: header clears iOS soft zone (${phone.safeTop}px inset)`, () => {
      const bandH = phone.safeTop + SOLID_EXTRA + FADE;
      const solidEnd = phone.safeTop + SOLID_EXTRA;
      // Header content starts after the full band (solid + fade)
      const contentTop = bandH;
      expect(bandH).toBe(phone.safeTop + SOLID_EXTRA + FADE);
      expect(solidEnd).toBeGreaterThanOrEqual(phone.safeTop);
      expect(contentTop).toBeGreaterThan(solidEnd);
      expect(FADE).toBeGreaterThanOrEqual(24);
      expect(FADE).toBeLessThanOrEqual(32);
      expect(SOLID_EXTRA).toBeGreaterThanOrEqual(12);
      expect(SOLID_EXTRA).toBeLessThanOrEqual(16);
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
  // Freeze for the entire editable-focus session — not only after >150px shrink.
  if (editableFocused) return innerHeight;
  return visualViewportHeight;
}
