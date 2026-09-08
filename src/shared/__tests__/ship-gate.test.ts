/**
 * Lightweight party-server bot behavior smoke (no PartyKit runtime).
 * Exercises pick/wager helpers + admin count parsing used by the bot brain.
 */
import { describe, expect, it } from "vitest";
import { RULES } from "../rules";
import { parseBotCountDraft } from "../admin-bots";
import { chooseBotPick, botDelayMs } from "../bot-picks";

describe("ship gate: clocks + bots", () => {
  it("draft clock is 60 + 5 grace", () => {
    expect(RULES.pickClockSeconds).toBe(60);
    expect(RULES.pickGraceSeconds).toBe(5);
  });

  it("add-bots draft never snaps empty→1", () => {
    expect(parseBotCountDraft("", 8)).toBeNull();
    expect(parseBotCountDraft("8", 8)).toBe(8);
  });

  it("bot delays are human-scale seconds", () => {
    for (const kind of ["topic", "draft", "vote", "bank", "wager", "dice"] as const) {
      const ms = botDelayMs(kind, 42);
      expect(ms).toBeGreaterThanOrEqual(800);
      expect(ms).toBeLessThanOrEqual(8000);
    }
  });

  it("bot lock-in strings look like answers not Missed pick", () => {
    const text = chooseBotPick({
      topicId: "best-movie-robots",
      topicText: "Best movie robots",
      botId: "bot-ava",
      turnIndex: 0,
      takenNormalized: [],
    });
    expect(text.toLowerCase()).not.toMatch(/missed/);
    expect(text.length).toBeGreaterThan(2);
  });
});
