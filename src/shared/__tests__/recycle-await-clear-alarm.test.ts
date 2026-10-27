/**
 * recycleInactiveRoom must await clearAlarm — same race as pause/end_game
 * (#224/#227). A fire-and-forget deleteAlarm can finish after a later
 * setAlarmAt (join → start → draft clock) and wipe the new clock.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";

const START = 1_800_000_000_000;

describe("recycleInactiveRoom awaits clearAlarm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  it("does not resolve until deleteAlarm finishes", async () => {
    const harness = createTestServer("RECYCLE");
    const { server } = harness;
    // Inactive mid-game zombie (no sockets, grace expired, bots only).
    server.state.phase = "DRAFT";
    server.state.rosterLocked = true;
    server.state.seatOrder = ["bot-1"];
    server.state.players = [
      {
        id: "bot-1",
        name: "Bot Ava",
        seat: 0,
        connected: true,
        isHost: true,
        role: "player",
        stones: 20,
        joinedAt: START,
      },
    ];
    await server.setAlarmAt(START + 30_000, {
      kind: "pick",
      revision: server.state.phaseRevision,
    });
    assert.notEqual(harness.deadline(), null);
    assert.equal(server.roomAppearsActive(), false);

    let releaseDelete!: () => void;
    const holdDelete = new Promise<void>((r) => {
      releaseDelete = r;
    });
    const originalDelete = harness.ctx.storage.deleteAlarm.bind(
      harness.ctx.storage,
    );
    harness.ctx.storage.deleteAlarm = async () => {
      await holdDelete;
      await originalDelete();
    };

    const recycleDone = server.recycleInactiveRoom();
    let resolved = false;
    void recycleDone.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    assert.equal(resolved, false, "must await clearAlarm before returning");
    assert.equal(server.state.phase, "LOBBY");

    releaseDelete();
    await recycleDone;
    assert.equal(resolved, true);
    assert.equal(harness.deadline(), null);
  });

  it("join awaits recycle so a late delete cannot wipe the draft clock", async () => {
    const harness = createTestServer("RECYCLE2");
    const { server } = harness;
    server.state.phase = "DRAFT";
    server.state.rosterLocked = true;
    server.state.seatOrder = ["bot-1"];
    server.state.players = [
      {
        id: "bot-1",
        name: "Bot Ava",
        seat: 0,
        connected: true,
        isHost: true,
        role: "player",
        stones: 20,
        joinedAt: START,
      },
    ];
    await server.setAlarmAt(START + 30_000, {
      kind: "pick",
      revision: server.state.phaseRevision,
    });

    let releaseDelete!: () => void;
    const holdDelete = new Promise<void>((r) => {
      releaseDelete = r;
    });
    const originalDelete = harness.ctx.storage.deleteAlarm.bind(
      harness.ctx.storage,
    );
    harness.ctx.storage.deleteAlarm = async () => {
      await holdDelete;
      await originalDelete();
    };

    const joinDone = server.handleJoin("fresh", "Nova", "player");
    let joined = false;
    void joinDone.then(() => {
      joined = true;
    });
    await Promise.resolve();
    assert.equal(joined, false, "join must await recycle clearAlarm");
    assert.equal(server.state.phase, "LOBBY");

    releaseDelete();
    await joinDone;
    assert.equal(joined, true);
    assert.equal(harness.deadline(), null);

    // Now start draft — clock must stick (no lingering delete).
    server.state.players = [
      {
        id: "fresh",
        name: "Nova",
        seat: 0,
        connected: true,
        isHost: true,
        role: "player",
        stones: 20,
        joinedAt: START,
      },
      {
        id: "p2",
        name: "P2",
        seat: 1,
        connected: true,
        isHost: false,
        role: "player",
        stones: 20,
        joinedAt: START,
      },
    ];
    server.state.seatOrder = ["fresh", "p2"];
    server.state.rosterLocked = true;
    await server.beginDraft();
    assert.notEqual(harness.deadline(), null);
    assert.equal(harness.deadline(), server.state.pickDeadlineAt);
  });
});
