import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);
const lobby = readFileSync(
  resolve(__dirname, "../../components/LobbyPanel.tsx"),
  "utf8",
);
const wager = readFileSync(
  resolve(__dirname, "../../components/WagerPanel.tsx"),
  "utf8",
);
const room = readFileSync(
  resolve(__dirname, "../../components/RoomClient.tsx"),
  "utf8",
);

describe("sticky primary CTAs on short viewports", () => {
  it("defines a sticky CTA dock without blur or hard band borders", () => {
    const block = css.match(/\.phase-sticky-cta\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block).toMatch(/position:\s*sticky/);
    expect(block).toMatch(/bottom:\s*0/);
    expect(block).toMatch(/background:\s*var\(--bg\)/);
    expect(block).not.toMatch(/backdrop-filter|filter:\s*blur|border-top|box-shadow/);
    expect(css).toMatch(/\.phase-sticky-cta::before/);
    expect(css).toMatch(/linear-gradient\(\s*to bottom/);
  });

  it("pins Lobby Start and Wager lock to the sticky dock", () => {
    expect(lobby).toMatch(/lobby-start-slot phase-sticky-cta/);
    expect(wager.match(/phase-sticky-cta/g)?.length ?? 0).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("drops obsolete Admin FAB clearance under Start", () => {
    const slot = css.match(/\.lobby-start-slot\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(slot).not.toMatch(/padding-bottom:\s*3\.25rem/);
    expect(slot).not.toMatch(/padding-bottom:\s*2\.75rem/);
  });

  it("gives phase panels min-height so sticky CTAs can reach the scrollport", () => {
    expect(room).toMatch(/min-h-full flex-col/);
    expect(room).toMatch(/sticky primary CTAs/i);
  });
});
