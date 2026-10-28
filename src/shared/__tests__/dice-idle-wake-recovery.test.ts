/**
 * READY dice_idle must recover when its alarm is lost — same class as stuck
 * COMMITTED rolls / lost settle-hold. Without recovery the table stays READY
 * forever (AFK auto-bank never fires).
 */
import assert from "node:assert/strict";
import type { Connection } from "partyserver";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";
import { RULES } from "../rules";

const START = 1_800_000_000_000;

function game(connections: Connection[] = []) {
  const harness = createTestServer("IDLE", { connections });
  const { server } = harness;
  server.state.players = ["A", "B"].map((id, seat) => ({
    id,
    name: id,
    seat,
    connected: true,
    isHost: seat === 0,
    role: "player" as const,
    stones: 20,
    joinedAt: START,
  }));
  server.state.seatOrder = ["A", "B"];
  server.state.rosterLocked = true;
  return {
    server,
    saved: harness.saved,
    deadline: harness.deadline,
    setDeadline: harness.setDeadline,
    deadlineRef: harness.deadlineRef,
  };
}

async function readyIdle(server: ReturnType<typeof game>["server"]) {
  server.state.pots = { A: 10, B: 10 };
  server.state.protectedStones = { A: 20, B: 20 };
  server.state.diceActiveIds = ["A", "B"];
  await server.beginDice();
  assert.equal(server.state.diceSubphase, "READY");
  assert.ok(server.state.diceIdleDeadlineAt);
  assert.equal(
    (server as unknown as { alarmPayload: { kind: string } | null }).alarmPayload
      ?.kind,
    "dice_idle",
  );
}

describe("READY dice_idle wake recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  it("reconnect after idle deadline with a lost alarm auto-banks", async () => {
    const conn = { id: "A", send() {} } as unknown as Connection;
    const g = game([conn]);
    await readyIdle(g.server);
    const deadline = g.server.state.diceIdleDeadlineAt!;
    await g.server.clearAlarm();
    assert.equal(g.deadline(), null);
    assert.equal(g.server.state.diceSubphase, "READY");
    assert.equal(g.server.currentDicePlayerId(), "A");

    vi.setSystemTime(deadline + 50);
    await g.server.onConnect(conn);
    // A was auto-banked; turn advanced to B.
    assert.ok(!g.server.state.diceActiveIds.includes("A"));
    assert.equal(g.server.state.diceSubphase, "READY");
    assert.equal(g.server.currentDicePlayerId(), "B");
  });

  it("lost alarm before deadline is re-armed, then auto-banks on fire", async () => {
    const g = game();
    await readyIdle(g.server);
    const deadline = g.server.state.diceIdleDeadlineAt!;
    await g.server.clearAlarm();
    assert.equal(g.deadline(), null);

    const rearmed = await g.server.ensureDiceIdle();
    assert.equal(rearmed, false);
    assert.equal(g.deadline(), deadline);
    assert.equal(g.server.state.diceSubphase, "READY");
    assert.equal(g.server.currentDicePlayerId(), "A");

    vi.setSystemTime(deadline);
    g.setDeadline(null);
    await g.server.onAlarm();
    assert.ok(!g.server.state.diceActiveIds.includes("A"));
    assert.equal(g.server.currentDicePlayerId(), "B");
  });

  it("onStart with overdue READY and no alarm auto-banks (hibernate)", async () => {
    const g = game();
    await readyIdle(g.server);
    const deadline = g.server.state.diceIdleDeadlineAt!;
    await g.server.persist();
    await g.server.clearAlarm();
    g.saved.delete("alarm");
    vi.setSystemTime(deadline + 10);
    const restarted = createTestServer("IDLE", {
      saved: g.saved,
      deadlineRef: g.deadlineRef,
    }).server;
    await restarted.onStart();
    assert.ok(!restarted.state.diceActiveIds.includes("A"));
    assert.equal(restarted.state.diceSubphase, "READY");
    assert.equal(restarted.currentDicePlayerId(), "B");
  });

  it("stale dice_idle context after deadline auto-banks instead of clearing", async () => {
    const g = game();
    await readyIdle(g.server);
    const deadline = g.server.state.diceIdleDeadlineAt!;
    const poisoned = {
      kind: "dice_idle" as const,
      revision: g.server.state.phaseRevision,
      deadlineAt: deadline,
      context: '["dice_idle","DICE",0,1,"wrong-seat"]',
    };
    (g.server as unknown as { alarmPayload: typeof poisoned }).alarmPayload =
      poisoned;
    g.saved.set("alarm", poisoned);
    g.setDeadline(null);
    vi.setSystemTime(deadline + 5);
    await g.server.onAlarm();
    assert.ok(!g.server.state.diceActiveIds.includes("A"));
    assert.equal(g.server.currentDicePlayerId(), "B");
  });

  it("resync after idle deadline with a lost alarm advances every client", async () => {
    const sentA: Array<Record<string, unknown>> = [];
    const sentB: Array<Record<string, unknown>> = [];
    const a = {
      id: "A",
      send(payload: string) {
        sentA.push(JSON.parse(payload) as Record<string, unknown>);
      },
    } as unknown as Connection;
    const b = {
      id: "B",
      send(payload: string) {
        sentB.push(JSON.parse(payload) as Record<string, unknown>);
      },
    } as unknown as Connection;
    const g = game([a, b]);
    await readyIdle(g.server);
    const deadline = g.server.state.diceIdleDeadlineAt!;
    await g.server.clearAlarm();
    vi.setSystemTime(deadline + 1);
    sentA.length = 0;
    sentB.length = 0;
    await g.server.onMessage(
      a,
      JSON.stringify({ type: "resync", lastVersion: 0 }),
    );
    assert.ok(!g.server.state.diceActiveIds.includes("A"));
    assert.equal(sentA.some((m) => m.type === "state"), true);
    assert.equal(sentB.some((m) => m.type === "state"), true);
  });

  it("does not auto-bank while bank-confirm pause is open", async () => {
    const g = game();
    await readyIdle(g.server);
    await g.server.handleBankConfirmOpen("A");
    assert.ok(g.server.state.diceIdlePauseRemainingMs != null);
    assert.equal(g.server.state.diceIdleDeadlineAt, null);
    await g.server.clearAlarm();
    vi.setSystemTime(START + RULES.diceIdleBankSeconds * 1000 + 100);
    const advanced = await g.server.ensureDiceIdle();
    assert.equal(advanced, false);
    assert.equal(g.server.state.diceSubphase, "READY");
    assert.equal(g.server.currentDicePlayerId(), "A");
    assert.ok(g.server.state.diceActiveIds.includes("A"));
  });
});
