import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");
const room = readFileSync(
  resolve(__dirname, "../../components/RoomClient.tsx"),
  "utf8",
);
const brand = readFileSync(
  resolve(__dirname, "../../components/BrandMark.tsx"),
  "utf8",
);
const home = readFileSync(resolve(__dirname, "../../app/page.tsx"), "utf8");
const topic = readFileSync(
  resolve(__dirname, "../../components/TopicPanel.tsx"),
  "utf8",
);
const lobby = readFileSync(
  resolve(__dirname, "../../components/LobbyPanel.tsx"),
  "utf8",
);
const vote = readFileSync(
  resolve(__dirname, "../../components/VotePanel.tsx"),
  "utf8",
);
const results = readFileSync(
  resolve(__dirname, "../../components/ResultsPanel.tsx"),
  "utf8",
);
const wager = readFileSync(
  resolve(__dirname, "../../components/WagerPanel.tsx"),
  "utf8",
);
const score = readFileSync(
  resolve(__dirname, "../../components/ScorePanel.tsx"),
  "utf8",
);
const dice = readFileSync(
  resolve(__dirname, "../../components/DicePanel.tsx"),
  "utf8",
);

describe("type hierarchy — one hero per screen", () => {
  it("keeps #108 three-size tokens", () => {
    expect(css).toMatch(/--text-meta:\s*0\.875rem/);
    expect(css).toMatch(/--text-body:\s*1rem/);
    expect(css).toMatch(/--text-display:\s*clamp\(/);
  });

  it("makes in-room brand quiet chrome (not a headline)", () => {
    expect(brand).toMatch(/chrome/);
    expect(brand).toMatch(/brand-mark-chrome-word/);
    expect(css).toMatch(/\.brand-mark-chrome-word\s*\{/);
    const word =
      css.match(/\.brand-mark-chrome-word\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(word).toMatch(/font-size:\s*0\.9375rem|15px|16px/);
    expect(word).toMatch(/font-weight:\s*600/);
    expect(word).toMatch(/color:\s*var\(--muted\)/);
    expect(room).toMatch(/BrandMark[^>]*chrome/);
    expect(home).toMatch(/BrandMark\s+large/);
  });

  it("makes draft topic the display hero and timer a secondary pill", () => {
    expect(room).toMatch(/type-display room-chrome-topic|room-chrome-topic/);
    expect(room).toMatch(/<TimerPill[\s\S]*?until=\{state\.pickDeadlineAt\}/);
    const pill = css.match(/\.timer-pill\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(pill).toMatch(/font-size:\s*var\(--text-meta\)/);
    expect(pill).not.toMatch(/blur\s*\(/);
    const urgent =
      css.match(/\.timer-pill-urgent\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(urgent).toMatch(/var\(--coral-ink\)/);
    expect(urgent).not.toMatch(/animation|pulse/);
  });

  it("keeps a stable chrome row height for the timer slot", () => {
    const top = css.match(/\.room-chrome-top\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(top).toMatch(/min-height:\s*var\(--tap-min\)/);
    expect(css).toMatch(/\.room-chrome-end-spacer/);
  });

  it("uses topic/phase titles as display heroes (not ad-hoc rem sizes)", () => {
    const topicTitle =
      css.match(/\.topic-title\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(topicTitle).toMatch(/font-size:\s*var\(--text-display\)/);
    expect(topic).toMatch(/topic-title/);
    const diceTitle =
      css.match(/\.dice-up-title\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(diceTitle).toMatch(/font-size:\s*var\(--text-display\)/);
    expect(dice).toMatch(/dice-up-title/);
  });

  it("home keeps large brand as the only display-scale hero", () => {
    expect(home).toMatch(/BrandMark\s+large/);
    expect(home).not.toMatch(/<h1 className="type-display"/);
    expect(home).toMatch(/What’s your name\?/);
  });

  it("phase panels expose exactly one type-display heading each", () => {
    const countDisplay = (src: string) =>
      (src.match(/type-display/g) ?? []).length;
    // Lobby: room code is the hero
    expect(lobby).toMatch(/lobby-room-code type-display/);
    expect(countDisplay(lobby)).toBe(1);
    // Vote / score / results: one heading class
    expect(vote).toMatch(/type-display/);
    expect(score).toMatch(/type-display/);
    expect(results).toMatch(/type-display/);
    expect(results).toMatch(/Final standings/);
    // Wager has mutually exclusive branches, each with one hero
    expect(wager).toMatch(/type-display/);
  });
});
