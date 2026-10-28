/**
 * Lost pick / phase / wager alarms must re-arm or fire on wake — same class
 * as lost dice clocks. Without recovery the UI hits 0 while the server never
 * advances (vote stuck, draft miss never fires, wager never locks).
 */
import assert from "node:assert/strict";
import type { Connection } from "partyserver";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";
import { RULES } from "../rules";

const START = 1_800_000_000_000;

function room(connections: Connection[] = []) {
  const harness = createTestServer("CLK", { connections });
  const { server } = harness;
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
  return harness;
}

describe("pick / phase / wager wake recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  it("reconnect after pick deadline with a lost alarm force-misses", async () => {
    const conn = { id: "A", send() {} } as unknown as Connection;
    const g = room([conn]);
    await g.server.beginDraft();
    assert.equal(g.server.state.draftCursor, 0);
    const deadline = g.server.state.pickDeadlineAt!;
    await g.server.clearAlarm();
    vi.setSystemTime(deadline + 10);
    await g.server.onConnect(conn);
    assert.equal(g.server.state.draftCursor, 1);
    assert.equal(g.server.state.picks.length, 1);
  });

  it("stale pick context after mid-draft seat growth re-arms instead of clearing", async () => {
    const g = room();
    await g.server.beginDraft();
    const beforeCtx = (
      g.server as unknown as { alarmPayload: { context: string } | null }
    ).alarmPayload?.context;
    assert.ok(beforeCtx);
    // Simulate seat growth remap without re-arm (old bug).
    g.server.state.draftOrder = ["A", "B", "C", "bot-x", "C", "B", "A", "bot-x"];
    g.server.state.draftCursor = 0;
    g.server.state.seatOrder = ["A", "B", "C", "bot-x"];
    // Old alarm context no longer matches owner.
    const advanced = await g.server.ensurePickDeadline();
    assert.equal(advanced, false);
    assert.equal(g.deadline(), g.server.state.pickDeadlineAt);
    const afterCtx = (
      g.server as unknown as { alarmPayload: { context: string } | null }
    ).alarmPayload?.context;
    assert.notEqual(afterCtx, beforeCtx);
    assert.ok(afterCtx?.includes("bot-x") || afterCtx !== beforeCtx);
  });

  it("admin_spawn_bots mid-draft re-arms pick clock with new context", async () => {
    const g = room();
    await g.server.beginDraft();
    const oldDeadline = g.server.state.pickDeadlineAt;
    await g.server.handleAdminSpawnBots("A", undefined, 1, true);
    assert.ok(g.server.state.seatOrder.length > 3);
    assert.ok(g.server.state.pickDeadlineAt);
    // Fresh clock armed (may equal old if same ms — context must match owner).
    const owner = (
      g.server as unknown as {
        alarmOwner: (k: string) => { context: string } | null;
      }
    ).alarmOwner("pick");
    const payload = (
      g.server as unknown as { alarmPayload: { kind: string; context: string } | null }
    ).alarmPayload;
    assert.equal(payload?.kind, "pick");
    assert.equal(payload?.context, owner?.context);
    assert.ok(g.server.state.pickDeadlineAt! >= (oldDeadline ?? 0));
  });

  it("voting phase with lost alarm finalizes after deadline on resync", async () => {
    const sent: Array<Record<string, unknown>> = [];
    const a = {
      id: "A",
      send(payload: string) {
        sent.push(JSON.parse(payload) as Record<string, unknown>);
      },
    } as unknown as Connection;
    const g = room([a]);
    g.server.state.phase = "VOTING_AND_JUDGING";
    g.server.state.judgeStatus = "pending";
    g.server.state.scores = [];
    g.server.state.phaseDeadlineAt = START + RULES.humanVoteSeconds * 1000;
    await g.server.setAlarmAt(g.server.state.phaseDeadlineAt, {
      kind: "phase",
      revision: g.server.state.phaseRevision,
    });
    await g.server.clearAlarm();
    vi.setSystemTime(g.server.state.phaseDeadlineAt + 5);
    sent.length = 0;
    await g.server.onMessage(
      a,
      JSON.stringify({ type: "resync", lastVersion: 0 }),
    );
    assert.equal(g.server.state.phase, "SCORE_REVEAL");
    assert.equal(sent.some((m) => m.type === "state"), true);
  });

  it("wager with lost alarm locks and starts dice after deadline", async () => {
    const g = room();
    g.server.state.phase = "WAGER_SELECTION";
    g.server.state.earnedThisRound = { A: 20, B: 20, C: 20 };
    g.server.state.wagers = {};
    g.server.state.wagerDeadlineAt = START + RULES.wagerTimeoutSeconds * 1000;
    await g.server.setAlarmAt(g.server.state.wagerDeadlineAt, {
      kind: "wager",
      revision: g.server.state.phaseRevision,
    });
    await g.server.clearAlarm();
    vi.setSystemTime(g.server.state.wagerDeadlineAt + 5);
    const advanced = await g.server.ensureWagerDeadline();
    assert.equal(advanced, true);
    assert.equal(g.server.state.phase, "DICE");
  });

  it("does not fire pick while the clock is paused", async () => {
    const g = room();
    await g.server.beginDraft();
    g.server.state.pickPaused = true;
    g.server.state.pickPauseRemainingMs = 5000;
    await g.server.clearAlarm();
    vi.setSystemTime(START + 60_000);
    const advanced = await g.server.ensurePickDeadline();
    assert.equal(advanced, false);
    assert.equal(g.server.state.draftCursor, 0);
  });
});
