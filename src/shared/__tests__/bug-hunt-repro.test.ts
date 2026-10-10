/**
 * Repro cases for bug-hunt findings (no product fixes — tests document bugs).
 */
import assert from "node:assert/strict";
import type { Connection } from "partyserver";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";

const START = 1_900_000_000_000;

function lobbyThree() {
  const { server } = createTestServer("BH1");
  server.state.players = ["A", "B", "C"].map((id, seat) => ({
    id,
    name: id === "A" ? "Luke" : id,
    seat: null,
    connected: true,
    isHost: seat === 0,
    role: "player" as const,
    stones: 20,
    joinedAt: START,
  }));
  return { server };
}

function votingThree(server: ReturnType<typeof createTestServer>["server"]) {
  server.state.phase = "VOTING_AND_JUDGING";
  server.state.rosterLocked = true;
  server.state.seatOrder = ["A", "B", "C"];
  server.state.players = server.state.players.map((p, i) => ({
    ...p,
    seat: i,
    connected: true,
  }));
  server.state.scores = ["A", "B", "C"].map((id) => ({
    playerId: id,
    votes: 0,
    aiAward: 20,
    topicFit: 5,
    pickStrength: 5,
    rosterQuality: 5,
    explanation: "x",
    earned: 40,
    aiFallback: true,
  }));
  server.state.judgeStatus = "ready";
}

describe("bug-hunt repros", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("P0: stale ballots from left seats can finalize without remaining voters", async () => {
    const { server } = lobbyThree();
    votingThree(server);
    await server.handleVote("A", "B");
    await server.handleVote("B", "A");
    // A disconnects and grace expires → leave (seat held, but out of quorum)
    server.onClose({ id: "A", send() {} } as unknown as Connection, 1000, "", true);
    await vi.advanceTimersByTimeAsync(8_000);
    await Promise.resolve();
    await Promise.resolve();
    await server.maybeFinalizeAfterJudge();
    // BUG: votesIn still 2 (A+B), needed is 2 (B+C) → locks without C
    assert.equal(server.humanVoteNeededCount(), 2);
    assert.equal(Object.keys(server.state.humanVotes).length, 2);
    assert.equal(
      server.state.scoresLocked,
      true,
      "BUG repro: finalized without C voting",
    );
    assert.equal(server.state.humanVotes["C"], undefined);
  });

  it("P0: Start includes disconnected lobby players in seatOrder", async () => {
    const { server } = lobbyThree();
    server.state.players = server.state.players.map((p) =>
      p.id === "C" ? { ...p, connected: false } : p,
    );
    await server.handleStart("A");
    assert.ok(server.state.seatOrder.includes("C"), "BUG repro: ghost seat locked");
    assert.equal(server.state.seatOrder.length, 3);
  });

  it("P1: rematch does not auto-fire when a ready peer leaves", async () => {
    const { server } = lobbyThree();
    server.state.phase = "GAME_RESULTS";
    server.state.gameOver = true;
    server.state.rosterLocked = true;
    server.state.seatOrder = ["A", "B", "C"];
    server.state.rematchReady = { A: true, B: true };
    // C never ready; C disconnects and leaves after grace
    server.onClose({ id: "C", send() {} } as unknown as Connection, 1000, "", true);
    await vi.advanceTimersByTimeAsync(8_000);
    await Promise.resolve();
    await Promise.resolve();
    // After leave, only A+B connected and both ready — but leave path never calls maybeRematchFromReady
    assert.equal(server.state.phase, "GAME_RESULTS", "BUG repro: stuck until another play_again");
    await server.maybeRematchFromReady();
    assert.equal(server.state.phase, "LOBBY", "manual call would rematch");
  });

  it("P1: host_check alarm is never scheduled (dead failover path)", () => {
    const src = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "../../../party/server.ts"),
      "utf8",
    ) as string;
    const schedules = [...src.matchAll(/kind:\s*["']host_check["']/g)];
    // Type union / switch cases mention it; setAlarmAt with host_check should not appear
    assert.equal(
      schedules.filter((m) => {
        const idx = m.index ?? 0;
        const window = src.slice(Math.max(0, idx - 80), idx + 40);
        return window.includes("setAlarmAt");
      }).length,
      0,
      "BUG repro: no setAlarmAt(..., { kind: 'host_check' })",
    );
  });

  it("P1: duplicate name reclaim binds the first orphan by name", () => {
    const { server } = createTestServer("BHN");
    server.state.rosterLocked = true;
    server.state.phase = "DRAFT";
    server.state.seatOrder = ["p1", "p2"];
    server.state.players = [
      {
        id: "p1",
        name: "Luke",
        seat: 0,
        connected: false,
        isHost: true,
        role: "player",
        stones: 50,
        joinedAt: START,
      },
      {
        id: "p2",
        name: "Luke",
        seat: 1,
        connected: false,
        isHost: false,
        role: "player",
        stones: 10,
        joinedAt: START,
      },
    ];
    server.handleJoin("new-device", "Luke", "player");
    const claimed = server.state.players.find((p) => p.connected);
    assert.equal(claimed?.id, "new-device");
    assert.equal(claimed?.stones, 50, "BUG repro: first matching orphan by name wins");
    assert.equal(server.state.seatOrder[0], "new-device");
  });
});
