import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);
const railSrc = readFileSync(
  resolve(__dirname, "../../components/PlayerRail.tsx"),
  "utf8",
);
const noticeSrc = readFileSync(
  resolve(__dirname, "../../components/RoomNotice.tsx"),
  "utf8",
);
const roomSrc = readFileSync(
  resolve(__dirname, "../../components/RoomClient.tsx"),
  "utf8",
);

describe("player chip score tiles", () => {
  it("stacks round delta under the total (not beside it)", () => {
    const score =
      css.match(/\.player-chip-score\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(score).toMatch(/flex-direction:\s*column/);
    expect(railSrc).toMatch(/player-chip-earned/);
    expect(railSrc).toMatch(/player-chip-earned-spacer/);
  });

  it("locks fixed equal chip widths and allows horizontal scroll", () => {
    const chip = css.match(/\.player-chip\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(chip).toMatch(/--player-chip-w/);
    expect(chip).toMatch(/flex:\s*0\s+0\s+var\(--player-chip-w\)/);
    expect(css).toMatch(/\.player-rail-track\s*\{[\s\S]*?overflow-x:\s*auto/);
  });

  it("uses accessible coral fill for the You tile", () => {
    const you = css.match(/\.player-chip-you\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(you).toMatch(/background:\s*var\(--btn-bg\)/);
    expect(you).toMatch(/color:\s*#fff/);
  });

  it("keeps tabular numerals on stones and earned", () => {
    expect(railSrc).toMatch(/player-chip-stones tabular-nums/);
    expect(railSrc).toMatch(/player-chip-earned tabular-nums/);
    expect(css).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });
});

describe("room notice toast", () => {
  it("is wired as a muted auto-dismiss component", () => {
    expect(roomSrc).toMatch(/RoomNotice/);
    expect(noticeSrc).toMatch(/DISMISS_MS|setTimeout/);
    expect(css).toMatch(/\.room-notice\s*\{/);
    const notice = css.match(/\.room-notice\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(notice).toMatch(/color:\s*var\(--muted\)/);
    expect(notice).not.toMatch(/var\(--coral\)/);
  });
});
