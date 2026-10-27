/**
 * SETTLED settle-hold must recover when its alarm is lost — same class as
 * stuck COMMITTED rolls. Hold due-time lives only on the alarm; without
 * recovery the table stays SETTLED forever (not READY, never advances).
 */
import assert from "node:assert/strict";
import type { Connection } from "partyserver";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";
import { RULES } from "../rules";

const START = 1_800_000_000_000;

function game(connections: Connection[] = []) {
  const harness = createTestServer("HOLD", { connections });
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

async function settleContinue(server: ReturnType<typeof game>["server"]) {
  server.state.pots = { A: 10, B: 10 };
  server.state.protectedStones = { A: 20, B: 20 };
  server.state.diceActiveIds = ["A", "B"];
  await server.beginDice();
  await server.handleRoll("A");
  // Non-bust so settle-hold continues the same seat.
  server.state.lastDice = {
    ...server.state.lastDice!,
    d1: 2,
    d2: 3,
    busted: false,
    potAfter: 15,
    outcomeKind: "add_sum",
    note: "+5",
  };
  vi.setSystemTime(server.state.lastDice!.animSettleAt + 1);
  await server.afterDiceAnim();
  assert.equal(server.state.diceSubphase, "SETTLED");
  assert.equal(server.state.lastDice!.revealed, true);
  assert.equal(
    (server as unknown as { alarmPayload: { kind: string } | null }).alarmPayload
      ?.kind,
    "dice_settle_hold",
  );
}

describe("SETTLED settle-hold wake recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  it("reconnect with a lost hold alarm advances instead of soft-locking", async () => {
    const conn = { id: "A", send() {} } as unknown as Connection;
    const g = game([conn]);
    await settleContinue(g.server);
    await g.server.clearAlarm();
    assert.equal(g.deadline(), null);
    assert.equal(g.server.state.diceSubphase, "SETTLED");

    await g.server.onConnect(conn);
    assert.equal(g.server.state.diceSubphase, "READY");
    assert.equal(g.server.currentDicePlayerId(), "A");
  });

  it("onStart with SETTLED and no alarm advances (hibernate)", async () => {
    const g = game();
    await settleContinue(g.server);
    await g.server.persist();
    await g.server.clearAlarm();
    g.saved.delete("alarm");
    vi.setSystemTime(Date.now() + RULES.diceSettleHoldMs + 50);
    const restarted = createTestServer("HOLD", {
      saved: g.saved,
      deadlineRef: g.deadlineRef,
    }).server;
    await restarted.onStart();
    assert.equal(restarted.state.diceSubphase, "READY");
  });

  it("stale settle-hold context advances instead of clearing into a soft-lock", async () => {
    const g = game();
    await settleContinue(g.server);
    const poisoned = {
      kind: "dice_settle_hold" as const,
      revision: g.server.state.phaseRevision,
      deadlineAt: Date.now() + 1000,
      context: '["dice_settle_hold","DICE",0,null,"other-roll"]',
    };
    (g.server as unknown as { alarmPayload: typeof poisoned }).alarmPayload =
      poisoned;
    g.saved.set("alarm", poisoned);
    g.setDeadline(null);
    await g.server.onAlarm();
    assert.equal(g.server.state.diceSubphase, "READY");
  });

  it("resync with a lost hold alarm advances every client", async () => {
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
    await settleContinue(g.server);
    await g.server.clearAlarm();
    sentA.length = 0;
    sentB.length = 0;
    await g.server.onMessage(
      a,
      JSON.stringify({ type: "resync", lastVersion: 0 }),
    );
    assert.equal(g.server.state.diceSubphase, "READY");
    assert.equal(sentA.some((m) => m.type === "state"), true);
    assert.equal(sentB.some((m) => m.type === "state"), true);
  });

  it("does not auto-advance while an unresolved bust_redo prompt is open", async () => {
    const g = game();
    await settleContinue(g.server);
    g.server.state.partyPrompt = {
      kind: "bust_redo",
      targetPlayerIds: ["A"],
      resolved: false,
      redoAvailable: true,
    };
    await g.server.clearAlarm();
    const advanced = await g.server.ensureDiceSettleHold();
    assert.equal(advanced, false);
    assert.equal(g.server.state.diceSubphase, "SETTLED");
  });
});
