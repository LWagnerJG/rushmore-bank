/**
 * Mid-game host round changes: validation, notice broadcast, end-of-game.
 */
import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTestServer } from "../../../test/party-server-harness";
import {
  canHostSetTopicRounds,
  displayTopicRound,
  minHostTopicRounds,
  RULES,
} from "../rules";

const settings = readFileSync(
  resolve(__dirname, "../../components/SettingsSheet.tsx"),
  "utf8",
);

function seatedDraft(rounds = 4) {
  const { server } = createTestServer("RNDS");
  server.state.players = ["A", "B", "C"].map((id, seat) => ({
    id,
    name: id,
    seat,
    connected: true,
    isHost: seat === 0,
    role: "player" as const,
    stones: 40,
    joinedAt: 1,
  }));
  server.state.seatOrder = ["A", "B", "C"];
  server.state.rosterLocked = true;
  server.state.phase = "DRAFT";
  server.state.topicRound = 1; // in round 2 (0-based)
  server.state.configuredTopicRounds = rounds;
  server.state.selectedTopic = {
    id: "t1",
    text: "Best snacks",
    scope: "everyday",
    scopeBoundary: "food",
  };
  server.state.draftOrder = [0, 1, 2];
  server.state.draftCursor = 0;
  return server;
}

describe("mid-game host round changes", () => {
  it("displayTopicRound is 1-based in play and completed at results", () => {
    expect(
      displayTopicRound({ phase: "DRAFT", topicRound: 0 }),
    ).toBe(1);
    expect(
      displayTopicRound({ phase: "TOPIC_SELECTION", topicRound: 2 }),
    ).toBe(3);
    expect(
      displayTopicRound({ phase: "ROUND_RESULTS", topicRound: 3 }),
    ).toBe(3);
    expect(minHostTopicRounds({ phase: "DRAFT", topicRound: 1 })).toBe(2);
  });

  it("allows mid-game totals at or above the current round (3–6)", () => {
    expect(
      canHostSetTopicRounds({
        phase: "DRAFT",
        topicRound: 1,
        rounds: 3,
      }),
    ).toBe(true);
    expect(
      canHostSetTopicRounds({
        phase: "DRAFT",
        topicRound: 1,
        rounds: 2,
      }),
    ).toBe(false);
    expect(
      canHostSetTopicRounds({
        phase: "SCORE_REVEAL",
        topicRound: 3,
        rounds: 3,
      }),
    ).toBe(false); // current display round is 4
    expect(
      canHostSetTopicRounds({
        phase: "SCORE_REVEAL",
        topicRound: 3,
        rounds: 4,
      }),
    ).toBe(true);
    expect(
      canHostSetTopicRounds({
        phase: "LOBBY",
        topicRound: 0,
        rounds: 4,
      }),
    ).toBe(false);
    expect(
      canHostSetTopicRounds({
        phase: "GAME_RESULTS",
        topicRound: 4,
        rounds: 5,
      }),
    ).toBe(false);
    expect(
      canHostSetTopicRounds({
        phase: "TOPIC_SELECTION",
        topicRound: 0,
        rounds: 6,
      }),
    ).toBe(true);
  });

  it("host can raise or shorten mid-game; rejects below current / non-host", () => {
    const server = seatedDraft(5);
    assert.throws(() => server.handleSetTopicRounds("B", 4), /Host only/);
    assert.throws(() => server.handleSetTopicRounds("A", 1), /Rounds locked/);
    // In round 2 → cannot set total to below 2; 3 is ok.
    server.handleSetTopicRounds("A", 3);
    assert.equal(server.state.configuredTopicRounds, 3);
    assert.match(server.state.notice ?? "", /Host changed game to 3 rounds/);

    server.handleSetTopicRounds("A", 6);
    assert.equal(server.state.configuredTopicRounds, 6);
    assert.match(server.state.notice ?? "", /Host changed game to 6 rounds/);
  });

  it("setting total to the current round ends the game after this round", async () => {
    const server = seatedDraft(5);
    // Round 2 in progress → set total to 2.
    // displayTopicRound(DRAFT, 1) = 2; 2 is not in host options (3–6).
    // Advance to round 3 so min is 3 (selectable).
    server.state.topicRound = 2;
    server.handleSetTopicRounds("A", 3);
    assert.equal(server.state.configuredTopicRounds, 3);

    server.state.phase = "ROUND_RESULTS";
    server.state.topicRound = 3; // finished round 3
    await server.handleNextTopic("A");
    assert.equal(server.state.phase, "GAME_RESULTS");
  });

  it("settings sheet shows Round X of N and host chips", () => {
    expect(settings).toMatch(/Round \{/);
    expect(settings).toMatch(/displayTopicRound/);
    expect(settings).toMatch(/set_topic_rounds/);
    expect(settings).toMatch(/settings-rounds/);
    expect(settings).toMatch(/canHostSetTopicRounds/);
    expect([...RULES.topicRoundsHostOptions]).toEqual([3, 4, 5, 6]);
  });
});
