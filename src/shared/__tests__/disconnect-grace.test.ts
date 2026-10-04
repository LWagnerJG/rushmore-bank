/**
 * Soft-disconnect grace: keep host + vote quorum through app-switch blips.
 */
import assert from "node:assert/strict";
import type * as Party from "partykit/server";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import QuarryServer from "../../../party/server";
import { emptyRoomState } from "../types";
import { projectPublicState } from "../engine/public-state";

const START = 1_800_000_000_000;

function game() {
  const saved = new Map<string, unknown>();
  let deadline: number | null = null;
  const room = {
    id: "GRCE",
    storage: {
      async get(key: string) {
        return structuredClone(saved.get(key));
      },
      async put(key: string, value: unknown) {
        saved.set(key, structuredClone(value));
      },
      async delete(key: string) {
        return saved.delete(key);
      },
      async getAlarm() {
        return deadline;
      },
      async setAlarm(at: number) {
        deadline = at;
      },
      async deleteAlarm() {
        deadline = null;
      },
    },
    getConnections: () => [],
  } as unknown as Party.Room;
  const server = new QuarryServer(room);
  server.state.players = ["A", "B", "C"].map((id, seat) => ({
    id,
    name: id,
    seat,
    connected: true,
    isHost: seat === 0,
    role: "player" as const,
    stones: 20,
    joinedAt: START,
  }));
  server.state.seatOrder = ["A", "B", "C"];
  server.state.rosterLocked = true;
  return { server };
}

describe("disconnect grace robustness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps host through mid-game soft disconnect", () => {
    const g = game();
    const conn = { id: "A", send() {} } as unknown as Party.Connection;
    g.server.onClose(conn);
    assert.equal(g.server.state.players.find((p) => p.id === "A")!.connected, false);
    assert.equal(g.server.state.players.find((p) => p.id === "A")!.isHost, true);
    assert.equal(g.server.state.players.find((p) => p.id === "B")!.isHost, false);
    assert.equal(g.server.humanVoteNeededCount(), 3);
  });

  it("does not lock votes while a seated player is in disconnect grace", async () => {
    const g = game();
    g.server.state.phase = "VOTING_AND_JUDGING";
    g.server.state.scores = ["A", "B", "C"].map((id) => ({
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
    g.server.state.judgeStatus = "ready";
    // C soft-disconnects (grace timer armed)
    g.server.onClose({ id: "C", send() {} } as unknown as Party.Connection);
    assert.equal(g.server.humanVoteNeededCount(), 3);
    await g.server.handleVote("A", "B");
    await g.server.handleVote("B", "A");
    assert.equal(g.server.state.scoresLocked, false, "must wait for C or grace end");
    // Grace expires → leave → quorum drops to 2 → finalize
    await vi.advanceTimersByTimeAsync(8_000);
    // handlePlayerLeave is async from setTimeout — flush
    await Promise.resolve();
    await Promise.resolve();
    await g.server.maybeFinalizeAfterJudge();
    assert.equal(g.server.humanVoteNeededCount(), 2);
    assert.equal(g.server.state.scoresLocked, true);
  });

  it("ready-to-wager needed count ignores disconnected seats", () => {
    const state = emptyRoomState("WG1");
    state.phase = "SCORE_REVEAL";
    state.seatOrder = ["a", "b", "c"];
    state.players = ["a", "b", "c"].map((id, seat) => ({
      id,
      name: id,
      seat,
      connected: id !== "c",
      isHost: seat === 0,
      role: "player" as const,
      stones: 0,
      joinedAt: 1,
    }));
    state.bankBeansReady = { a: true, b: true };
    const pub = projectPublicState(state, "a");
    assert.equal(pub.bankBeansReadyNeeded, 2);
    assert.equal(pub.bankBeansReadyCast, 2);
  });
});
