import assert from "node:assert/strict";
import type * as Party from "partykit/server";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import QuarryServer from "../../../party/server";
import { RULES } from "../rules";

const START = 1_800_000_000_000;

function game() {
  const saved = new Map<string, unknown>();
  let deadline: number | null = null;
  const room = {
    id: "TEST",
    storage: {
      async get(key: string) { return structuredClone(saved.get(key)); },
      async put(key: string, value: unknown) { saved.set(key, structuredClone(value)); },
      async delete(key: string) { return saved.delete(key); },
      async getAlarm() { return deadline; },
      async setAlarm(at: number) { deadline = at; },
      async deleteAlarm() { deadline = null; },
    },
    getConnections: () => [],
  } as unknown as Party.Room;
  const server = new QuarryServer(room);
  server.state.players = ["A", "B", "C"].map((id, seat) => ({
    id, name: id, seat, connected: true, isHost: seat === 0,
    role: "player", stones: 20, joinedAt: START,
  }));
  server.state.seatOrder = ["A", "B", "C"];
  server.state.rosterLocked = true;
  server.state.configuredTopicRounds = 3;
  server.state.earnedThisRound = { A: 20, B: 20, C: 20 };
  return {
    room, server, saved,
    deadline: () => deadline,
    async fire(target = server) {
      assert.notEqual(deadline, null, "expected a scheduled deadline");
      vi.setSystemTime(deadline!);
      // Storage consumes the physical alarm before invoking onAlarm.
      deadline = null;
      await target.onAlarm();
    },
  };
}

async function reconnect(server: QuarryServer, id = "B") {
  const conn = { id, send() {} } as unknown as Party.Connection;
  server.onClose(conn);
  server.onConnect(conn);
  await server.persist();
}

async function voting(server: QuarryServer) {
  server.state.phase = "VOTING_AND_JUDGING";
  server.state.judgeStatus = "pending";
  server.state.phaseDeadlineAt = Date.now() + RULES.humanVoteSeconds * 1000;
  await server.setAlarmAt(server.state.phaseDeadlineAt, {
    kind: "phase", revision: server.state.phaseRevision,
  });
}

async function dice(server: QuarryServer) {
  server.state.pots = { A: 10, B: 10, C: 10 };
  server.state.protectedStones = { A: 20, B: 20, C: 20 };
  server.state.diceActiveIds = ["A", "B", "C"];
  await server.beginDice();
}

describe("authoritative deadlines across reconnects", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  for (const id of ["A", "B"]) {
    it(`expires exactly one draft pick after ${id} reconnects`, async () => {
      const g = game();
      await g.server.beginDraft();
      const deadline = g.deadline();
      await reconnect(g.server, id);
      assert.equal(g.deadline(), deadline, "reconnect must not extend the clock");
      await g.fire();
      assert.equal(g.server.state.draftCursor, 1);
      assert.equal(g.server.state.picks.length, 1);
      assert.equal(g.server.state.picks[0].playerId, "A");
      // A repeated delivery must not expire the new player's future clock.
      await g.server.onAlarm();
      assert.equal(g.server.state.draftCursor, 1);
      assert.equal(g.server.state.picks.length, 1);
      assert.equal(g.deadline(), g.server.state.pickDeadlineAt);
    });
  }

  for (const topicRound of [0, 2]) {
    it(`finishes voting after reconnect in topic round ${topicRound + 1}`, async () => {
      const g = game();
      g.server.state.topicRound = topicRound;
      await voting(g.server);
      await reconnect(g.server);
      await g.fire();
      assert.equal(g.server.state.phase, "SCORE_REVEAL");
      assert.equal(g.server.state.scoresLocked, true);
      assert.equal(g.server.state.scores.length, 3);
      const earned = structuredClone(g.server.state.earnedThisRound);
      await g.server.onAlarm();
      assert.deepEqual(g.server.state.earnedThisRound, earned);
      assert.equal(g.saved.has("alarm"), false);
    });
  }

  it("locks missing wagers and starts dice after reconnect", async () => {
    const g = game();
    await g.server.beginWagers();
    await reconnect(g.server);
    await g.fire();
    assert.equal(g.server.state.phase, "DICE");
    assert.equal(g.server.state.diceSubphase, "READY");
    assert.deepEqual(g.server.state.wagers, { A: 1, B: 1, C: 1 });
    assert.equal(g.server.state.ledger.filter(e => e.kind === "wager_lock").length, 3);
  });

  it("auto-banks an idle roller after another player reconnects", async () => {
    const g = game();
    await dice(g.server);
    await reconnect(g.server);
    await g.fire();
    assert.equal(g.server.currentDicePlayerId(), "B");
    assert.equal(g.server.state.players[0].stones, 30);
    assert.equal(g.server.state.pots.A, 0);
    assert.equal(g.server.state.ledger.filter(e => e.kind === "bank").length, 1);
    await g.server.onAlarm();
    assert.equal(g.server.currentDicePlayerId(), "B");
  });

  it("keeps the restored idle clock after cancelling bank confirmation", async () => {
    const g = game();
    await dice(g.server);
    await g.server.handleBankConfirmOpen("A");
    assert.equal(g.deadline(), null);
    vi.setSystemTime(START + 5000);
    await g.server.handleBankConfirmCancel("A");
    await g.fire();
    assert.equal(g.server.currentDicePlayerId(), "B");
    assert.equal(g.server.state.pots.A, 0);
  });

  it("reveals a committed roll and completes its hold after reconnects", async () => {
    const g = game();
    await dice(g.server);
    await g.server.handleRoll("A");
    const roll = structuredClone(g.server.state.lastDice!);
    await reconnect(g.server);
    await g.fire();
    assert.equal(g.server.state.diceSubphase, "SETTLED");
    assert.equal(g.server.state.lastDice!.revealed, true);
    assert.equal(g.server.state.pots.A, roll.potAfter);
    const entries = g.server.state.ledger.length;
    await g.server.onAlarm();
    assert.equal(g.server.state.diceSubphase, "SETTLED", "must finish the hold first");
    assert.equal(g.server.state.ledger.length, entries);
    await reconnect(g.server);
    await g.fire();
    assert.equal(g.server.state.diceSubphase, "READY");
    assert.equal(g.server.currentDicePlayerId(), roll.busted ? "B" : "A");
    assert.equal(g.server.state.ledger.length, entries);
  });

  it("reaches final-round results once when the last pot auto-banks", async () => {
    const g = game();
    g.server.state.topicRound = 2;
    await dice(g.server);
    g.server.state.diceActiveIds = ["A"];
    await reconnect(g.server);
    await g.fire();
    assert.equal(g.server.state.phase, "ROUND_RESULTS");
    assert.equal(g.server.state.topicRound, 3);
    assert.equal(g.saved.has("alarm"), false);
    await g.server.onAlarm();
    assert.equal(g.server.state.topicRound, 3);
  });

  it("preserves a paused draft and only expires the resumed clock", async () => {
    const g = game();
    await g.server.beginDraft();
    g.server.handlePause("A");
    await g.server.persist();
    await reconnect(g.server);
    await g.server.onAlarm();
    assert.equal(g.server.state.draftCursor, 0);
    assert.equal(g.deadline(), null);
    await g.server.handleResume("A");
    await g.fire();
    assert.equal(g.server.state.draftCursor, 1);
  });

  it("ignores an old delivery after extending the pick deadline", async () => {
    const g = game();
    await g.server.beginDraft();
    const oldDeadline = g.deadline()!;
    await g.server.handleExtend("A");
    vi.setSystemTime(oldDeadline);
    await g.server.onAlarm();
    assert.equal(g.server.state.draftCursor, 0);
    assert.equal(g.deadline(), oldDeadline + RULES.hostExtendSeconds * 1000);
    await g.fire();
    assert.equal(g.server.state.draftCursor, 1);
  });

  it("discards a stale draft alarm after leaving its phase", async () => {
    const g = game();
    await g.server.beginDraft();
    g.server.state.phase = "LOBBY";
    await g.fire();
    assert.equal(g.server.state.phase, "LOBBY");
    assert.equal(g.server.state.picks.length, 0);
    assert.equal(g.saved.has("alarm"), false);
  });

  it("restores a durable deadline after reconnect and server restart", async () => {
    const g = game();
    await g.server.beginDraft();
    await reconnect(g.server);
    const restarted = new QuarryServer(g.room);
    await restarted.onStart();
    await reconnect(restarted, "A");
    await g.fire(restarted);
    assert.equal(restarted.state.draftCursor, 1);
    assert.equal(restarted.state.picks.length, 1);
  });

  it("upgrades an existing revision-only alarm using its persisted deadline", async () => {
    const g = game();
    await g.server.beginDraft();
    const revision = g.server.state.phaseRevision;
    await reconnect(g.server);
    // Old deployed rooms have no turn identity or deadline in the payload.
    g.saved.set("alarm", { kind: "pick", revision });
    const restarted = new QuarryServer(g.room);
    await restarted.onStart();
    await reconnect(restarted, "A");
    await g.fire(restarted);
    assert.equal(restarted.state.draftCursor, 1);
  });
});
