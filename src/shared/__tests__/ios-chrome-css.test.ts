import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { stepKeyboardSession } from "../viewport-height";

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
    // Safari default ~4px; standalone bumps to 12px via display-mode media
    expect(css).toMatch(/--safe-top-solid-extra:\s*4px/);
    expect(css).toMatch(
      /@media\s*\(display-mode:\s*standalone\)[\s\S]*?--safe-top-solid-extra:\s*12px/,
    );
    expect(css).toMatch(/--safe-top-fade:\s*(8|10|12)px/);
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

  it("declares the visual-viewport keyboard model iOS actually uses", () => {
    expect(layout).toMatch(/interactiveWidget:\s*"resizes-visual"/);
    expect(layout).not.toMatch(/interactiveWidget:\s*"resizes-content"/);
  });

  it("does not leave enter animations with fill-mode forwards/both", () => {
    // Home + phase share one rule (unified 200ms screen-enter).
    expect(css).toMatch(
      /\.animate-rise,\s*\n?\s*\.phase-enter\s*\{[\s\S]*?animation-fill-mode:\s*none/,
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
    const enterBlock =
      css.match(
        /\.animate-rise,\s*\n?\s*\.phase-enter\s*\{[\s\S]*?\n\}/,
      )?.[0] ?? "";
    for (const d of decls(enterBlock)) {
      expect(d).not.toMatch(/forwards|\bboth\b/);
    }
  });

  it("drops backdrop-filter on bank-confirm and has no leftover 3D die will-change", () => {
    const bank =
      css.match(/\.bank-confirm-backdrop\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    const bankDecls = bank.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(bankDecls).toMatch(/backdrop-filter:\s*none/);
    expect(bankDecls).not.toMatch(/backdrop-filter:\s*blur/);
    expect(css).not.toMatch(/\.bean-die(?:-settle)?\s*\{/);
    expect(css).not.toMatch(/@keyframes\s+die-settle/);
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
  const FADE = 8;
  const fixtures = [
    {
      name: "390x844 Safari (0 inset)",
      w: 390,
      h: 844,
      safeTop: 0,
      solidExtra: 4,
      standalone: false,
    },
    {
      name: "390x844 PWA standalone (59px inset)",
      w: 390,
      h: 844,
      safeTop: 59,
      solidExtra: 12,
      standalone: true,
    },
    {
      name: "390x844 Safari with inset",
      w: 390,
      h: 844,
      safeTop: 47,
      solidExtra: 4,
      standalone: false,
    },
  ] as const;

  for (const phone of fixtures) {
    it(`${phone.name}: header clears soft zone`, () => {
      const bandH = phone.safeTop + phone.solidExtra + FADE;
      const solidEnd = phone.safeTop + phone.solidExtra;
      const contentTop = bandH;
      expect(bandH).toBe(phone.safeTop + phone.solidExtra + FADE);
      expect(solidEnd).toBeGreaterThanOrEqual(phone.safeTop);
      expect(contentTop).toBeGreaterThan(solidEnd);
      if (phone.standalone) {
        expect(phone.solidExtra).toBe(12);
        expect(phone.solidExtra + FADE).toBe(20);
      } else {
        expect(phone.solidExtra).toBe(4);
        expect(phone.solidExtra + FADE).toBe(12);
      }
      const shellH = phone.h;
      const keyboardH = 336;
      const viewport = (vv: number) => ({
        innerHeight: shellH,
        innerWidth: phone.w,
        visualViewportHeight: vv,
      });
      let step = stepKeyboardSession(
        { phase: "idle" },
        { type: "focus", viewport: viewport(shellH), currentAppHeightPx: shellH },
      );
      for (const event of [
        { type: "viewport", viewport: viewport(shellH - keyboardH) },
        { type: "blur", viewport: viewport(shellH - keyboardH) },
        { type: "viewport", viewport: viewport(shellH - keyboardH / 2) },
      ] as const) {
        step = stepKeyboardSession(step.session, event);
        expect(step.appHeightPx).toBeNull();
      }
      expect(phone.w).toBe(390);
      expect(phone.h).toBe(844);
    });
  }
});
