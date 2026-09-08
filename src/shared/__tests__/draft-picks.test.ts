import { describe, expect, it } from "vitest";
import {
  clampRostersToCap,
  playerPickCount,
  rosterFull,
  upsertDraftPick,
} from "../engine/draft-picks";
import { RULES } from "../rules";
import type { DraftPick } from "../types";

function pick(
  playerId: string,
  turnIndex: number,
  pickIndex: number,
  text: string,
): DraftPick {
  return { playerId, turnIndex, pickIndex, text };
}

/**
 * Regression: host redo used to resume DRAFT at correctedTurn+1 and
 * re-walk already-filled turns, appending a 5th pick for players who
 * already had 4 (board find() hid duplicates; review listed five).
 */
describe("draft pick cap + redo upsert", () => {
  it("hard-caps at 4 picks per player", () => {
    let picks: DraftPick[] = [];
    for (let i = 0; i < 4; i++) {
      picks = upsertDraftPick(picks, pick("a", i, i, `A${i}`));
    }
    expect(playerPickCount(picks, "a")).toBe(RULES.picksPerPlayer);
    expect(rosterFull(picks, "a")).toBe(true);
    expect(() =>
      upsertDraftPick(picks, pick("a", 99, 4, "A5")),
    ).toThrow(/Roster full/);
  });

  it("redo replaces the same turnIndex instead of appending", () => {
    let picks: DraftPick[] = [
      pick("a", 0, 0, "One"),
      pick("a", 5, 1, "Two"),
      pick("a", 6, 2, "Three"),
      pick("a", 11, 3, "Four"),
      pick("b", 1, 0, "Bee"),
    ];
    // Simulate host remove turn 5 then lock replacement
    picks = picks.filter((p) => p.turnIndex !== 5);
    expect(playerPickCount(picks, "a")).toBe(3);
    picks = upsertDraftPick(picks, pick("a", 5, 1, "Two-fixed"));
    expect(playerPickCount(picks, "a")).toBe(4);
    expect(picks.filter((p) => p.turnIndex === 5)).toHaveLength(1);
    expect(picks.find((p) => p.turnIndex === 5)?.text).toBe("Two-fixed");
  });

  it("re-walking filled turns must not create a 5th via upsert", () => {
    let picks: DraftPick[] = [
      pick("a", 0, 0, "One"),
      pick("a", 5, 1, "Two"),
      pick("a", 6, 2, "Three"),
      pick("a", 11, 3, "Four"),
    ];
    // Old bug path: after redo, cursor walked turn 1 for player b, then
    // later hit player a again and pushed another row. Guard: upsert to a
    // new turn while already full throws.
    expect(() =>
      upsertDraftPick(picks, pick("a", 2, 4, "Fifth")),
    ).toThrow(/Roster full/);
    // Upserting an existing turn is fine (replace)
    picks = upsertDraftPick(picks, pick("a", 0, 0, "One-b"));
    expect(playerPickCount(picks, "a")).toBe(4);
  });

  it("clampRostersToCap drops extras beyond 4", () => {
    const bloated: DraftPick[] = [
      pick("a", 0, 0, "1"),
      pick("a", 1, 1, "2"),
      pick("a", 2, 2, "3"),
      pick("a", 3, 3, "4"),
      pick("a", 4, 4, "5"),
    ];
    const clamped = clampRostersToCap(bloated);
    expect(playerPickCount(clamped, "a")).toBe(4);
    expect(clamped.some((p) => p.text === "5")).toBe(false);
  });
});
