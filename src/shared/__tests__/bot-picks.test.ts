import { describe, expect, it } from "vitest";
import {
  botPickCandidates,
  botShouldBank,
  botWagerAmount,
  chooseBotPick,
} from "../bot-picks";
import { parseBotCountDraft } from "../admin-bots";
import { normalizePick } from "../types";

describe("admin bot count draft", () => {
  it("allows empty while typing (no snap to 1)", () => {
    expect(parseBotCountDraft("", 8)).toBeNull();
    expect(parseBotCountDraft("  ", 8)).toBeNull();
  });

  it("parses digits and caps at maxAdd without forcing 1↔8 flicker", () => {
    expect(parseBotCountDraft("8", 8)).toBe(8);
    expect(parseBotCountDraft("1", 8)).toBe(1);
    expect(parseBotCountDraft("3", 8)).toBe(3);
    expect(parseBotCountDraft("99", 8)).toBe(8);
    expect(parseBotCountDraft("0", 8)).toBeNull();
    expect(parseBotCountDraft("ab", 8)).toBeNull();
  });
});

describe("bot picks", () => {
  it("returns topic-relevant candidates for known catalogs", () => {
    const picks = botPickCandidates(
      "greatest-nba-players",
      "Greatest NBA players",
    );
    expect(picks.length).toBeGreaterThan(10);
    expect(picks.some((p) => /Jordan|LeBron|Kobe/i.test(p))).toBe(true);
  });

  it("never repeats taken picks", () => {
    const taken: string[] = [];
    const used = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const text = chooseBotPick({
        topicId: "best-road-trip-snacks",
        topicText: "Best road trip snacks",
        botId: `bot-test-${i}`,
        turnIndex: i,
        takenNormalized: taken,
      });
      const norm = normalizePick(text);
      expect(used.has(norm)).toBe(false);
      used.add(norm);
      taken.push(norm);
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(48);
    }
  });

  it("banks more often as rolls and pot grow", () => {
    expect(
      botShouldBank({ pot: 10, personalRolls: 0, botId: "bot-a" }),
    ).toBe(false);
    const late = Array.from({ length: 20 }, (_, i) =>
      botShouldBank({ pot: 180, personalRolls: 4, botId: `bot-late-${i}` }),
    );
    expect(late.filter(Boolean).length).toBeGreaterThan(5);
  });

  it("wagers within available beans", () => {
    for (let i = 0; i < 10; i++) {
      const w = botWagerAmount({
        earned: 40,
        banked: 20,
        botId: `bot-w-${i}`,
      });
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(60);
    }
  });
});
