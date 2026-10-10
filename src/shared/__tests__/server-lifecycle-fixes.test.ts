/**
 * Regression tests for bug-hunt P0/P1 server lifecycle fixes.
 */
import assert from "node:assert/strict";
import type { Connection } from "partyserver";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";
import { projectPublicState } from "../engine/public-state";

const START = 1_910_000_000_000;

function lobbyThree() {
  const { server } = createTestServer("LC1");
  server.state.players = ["A", "B", "C"].map((id, seat) => ({
    id,
    name: id,
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

describe("server lifecycle fixes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not finalize human votes using ballots from left seats", async () => {
    const { server } = lobbyThree();
    votingThree(server);
    await server.handleVote("A", "B");
    await server.handleVote("B", "A");
    server.onClose({ id: "A", send() {} } as unknown as Connection, 1000, "", true);
    await vi.advanceTimersByTimeAsync(8_000);
    await Promise.resolve();
    await Promise.resolve();
    await server.maybeFinalizeAfterJudge();
    assert.equal(server.humanVoteNeededCount(), 2);
    assert.equal(server.humanVoteCastCount(), 1, "A's ballot pruned on leave");
    assert.equal(server.state.scoresLocked, false, "C must still vote");
    assert.equal(server.state.humanVotes["A"], undefined);
  });

  it("Start ignores disconnected lobby players", async () => {
    const { server } = lobbyThree();
    server.state.players = server.state.players.map((p) =>
      p.id === "C" ? { ...p, connected: false } : p,
    );
    await server.handleStart("A");
    assert.equal(server.state.seatOrder.includes("C"), false);
    assert.equal(server.state.seatOrder.length, 2);
  });

  it("rematch auto-fires when a non-ready peer leaves", async () => {
    const { server } = lobbyThree();
    server.state.phase = "GAME_RESULTS";
    server.state.gameOver = true;
    server.state.rosterLocked = true;
    server.state.seatOrder = ["A", "B", "C"];
    server.state.rematchReady = { A: true, B: true };
    server.onClose({ id: "C", send() {} } as unknown as Connection, 1000, "", true);
    await vi.advanceTimersByTimeAsync(8_000);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(server.state.phase, "LOBBY");
  });

  it("rejects duplicate lobby nicknames", () => {
    const { server } = lobbyThree();
    assert.throws(
      () => server.handleJoin("D", "a", "player"),
      /Name taken/,
    );
  });

  it("name reclaim requires a unique orphan", () => {
    const { server } = createTestServer("NM1");
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
    assert.throws(
      () => server.handleJoin("new-device", "Luke", "player"),
      /ambiguous/i,
    );
  });

  it("host admin tools work without a pin when ADMIN_PIN unset", () => {
    const { server } = lobbyThree();
    server.handleAdminSpawnBots("A", undefined, 1);
    assert.ok(server.state.players.some((p) => p.id.startsWith("bot-")));
  });

  it("non-host admin rejected without ADMIN_PIN", () => {
    const { server } = lobbyThree();
    assert.throws(
      () => server.handleAdminSpawnBots("B", "8989", 1),
      /Host only/,
    );
  });

  it("recoverDiceAfterLeave reveals bust instead of banking potBefore", async () => {
    const { server } = lobbyThree();
    server.state.phase = "DICE";
    server.state.rosterLocked = true;
    server.state.seatOrder = ["A", "B", "C"];
    server.state.players = server.state.players.map((p, i) => ({
      ...p,
      seat: i,
      connected: true,
    }));
    server.state.diceActiveIds = ["A", "B", "C"];
    server.state.diceSubphase = "COMMITTED";
    server.state.pots = { A: 30, B: 0, C: 0 };
    server.state.protectedStones = { A: 20, B: 20, C: 20 };
    server.state.lastDice = {
      rollId: "r1",
      rollerId: "A",
      d1: 3,
      d2: 4,
      personalRollNumber: 1,
      potBefore: 30,
      potAfter: 0,
      busted: true,
      note: "bust",
      animStartedAt: START,
      animSettleAt: START + 2400,
      animSeed: 1,
      outcomeKind: "bust",
      revealed: false,
    };
    await server.recoverDiceAfterLeave("A");
    assert.equal(server.state.lastDice?.revealed, true);
    assert.equal(server.state.pots.A, 0);
    assert.equal(
      server.state.diceActiveIds.includes("A"),
      false,
      "busted seat removed",
    );
    assert.equal(server.state.players.find((p) => p.id === "A")!.stones, 20);
  });

  it("empty mid-game room reports exists=false after grace", async () => {
    const { server } = lobbyThree();
    server.state.phase = "TOPIC_SELECTION";
    server.state.rosterLocked = true;
    server.state.seatOrder = ["A", "B", "C"];
    server.state.players = server.state.players.map((p, i) => ({
      ...p,
      seat: i,
      connected: true,
    }));
    for (const id of ["A", "B", "C"]) {
      server.onClose(
        { id, send() {} } as unknown as Connection,
        1000,
        "",
        true,
      );
    }
    assert.equal(server.roomAppearsActive(), true, "grace still active");
    await vi.advanceTimersByTimeAsync(8_000);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(server.roomAppearsActive(), false);
  });

  it("public humanVotesNeeded includes grace seats", () => {
    const { server } = lobbyThree();
    votingThree(server);
    server.onClose({ id: "C", send() {} } as unknown as Connection, 1000, "", true);
    const pub = projectPublicState(server.state, "A", {
      gracePlayerIds: server.gracePlayerIds(),
    });
    assert.equal(pub.humanVotesNeeded, 3);
  });
});
