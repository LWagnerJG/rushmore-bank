import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);

const screens = [
  "LobbyPanel.tsx",
  "ResultsPanel.tsx",
  "DraftPanel.tsx",
  "VotePanel.tsx",
  "WagerPanel.tsx",
  "ScorePanel.tsx",
  "DicePanel.tsx",
  "page.tsx",
].map((name) => {
  const path =
    name === "page.tsx"
      ? resolve(__dirname, "../../app/page.tsx")
      : resolve(__dirname, `../../components/${name}`);
  return { name, src: readFileSync(path, "utf8") };
});

describe("design tokens consistency", () => {
  it("locks a 4/8px spacing scale", () => {
    expect(css).toMatch(/--space-1:\s*4px/);
    expect(css).toMatch(/--space-2:\s*8px/);
    expect(css).toMatch(/--space-3:\s*12px/);
    expect(css).toMatch(/--space-4:\s*16px/);
    expect(css).toMatch(/--space-5:\s*24px/);
    expect(css).toMatch(/--space-6:\s*32px/);
    expect(css).toMatch(/\.stack\s*\{/);
    expect(css).toMatch(/gap:\s*var\(--space-4\)/);
  });

  it("locks two text sizes plus one display size", () => {
    expect(css).toMatch(/--text-meta:\s*0\.875rem/);
    expect(css).toMatch(/--text-body:\s*1rem/);
    expect(css).toMatch(/--text-display:\s*clamp\(/);
    expect(css).toMatch(/\.type-meta\s*\{/);
    expect(css).toMatch(/\.type-body\s*\{/);
    expect(css).toMatch(/\.type-display\s*\{/);
  });

  it("defines exactly one primary and one secondary button style", () => {
    expect(css).toMatch(/\.btn-primary\s*\{/);
    expect(css).toMatch(/\.btn-secondary\s*\{/);
    // Primary uses accessible dark coral for ≥4.5:1 contrast
    expect(css).toMatch(/--btn-bg:\s*#c05530/);
    expect(css).toMatch(/--tap-min:\s*44px/);
    const primary =
      css.match(/\.btn-primary\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(primary).toMatch(/min-height:\s*var\(--tap-min\)|background:\s*var\(--btn-bg\)/);
    // Button motion is transform/opacity only and under 300ms
    const btnBlock =
      css.match(
        /\.btn-primary,\s*\n?\s*\.btn-secondary,\s*\n?\s*\.icon-btn\s*\{[\s\S]*?\n\}/,
      )?.[0] ?? "";
    expect(btnBlock).toMatch(/transform/);
    expect(btnBlock).toMatch(/opacity/);
    expect(btnBlock).not.toMatch(/background\s+\d/);
    expect(btnBlock).not.toMatch(/box-shadow\s+\d/);
    expect(btnBlock).toMatch(/--motion-fast/);
    expect(css).toMatch(/--motion-fast:\s*(1\d\d|2\d\d)ms/);
  });

  it("keeps cream/green/coral palette tokens", () => {
    expect(css).toMatch(/--bg:\s*#f5f0e7/i);
    expect(css).toMatch(/--coral:\s*#e76f4e/i);
    expect(css).toMatch(/--mint:\s*#a7d7c2/i);
    expect(css).toMatch(/--text:\s*#23483e/i);
    expect(css).toMatch(/--safe-top-cream:\s*#f7f3eb/i);
  });

  it("game screens use btn-primary/btn-secondary only (no third styles)", () => {
    for (const { name, src } of screens) {
      expect(src, name).not.toMatch(/btn-danger/);
      expect(src, name).not.toMatch(/btn-party-sip/);
    }
  });

  it("respects prefers-reduced-motion for buttons", () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.btn-primary/,
    );
  });

  it("does not reintroduce blur/backdrop/filter on cream safe-top", () => {
    const safe =
      css.match(
        /\.room-chrome-safe,\s*\n?\s*\.app-safe-top\s*\{[\s\S]*?\n\}/,
      )?.[0] ?? "";
    const decls = safe.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(decls).toMatch(/filter:\s*none/);
    expect(decls).toMatch(/backdrop-filter:\s*none/);
    expect(decls).not.toMatch(/blur\(/);
  });
});
