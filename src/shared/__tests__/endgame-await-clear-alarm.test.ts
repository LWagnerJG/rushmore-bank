/**
 * Host end_game must await clearAlarm — same race as host pause (#224).
 * A fire-and-forget deleteAlarm can finish after a later setAlarmAt
 * (e.g. rematch into lobby / next clock) and wipe it.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";

const START = 1_800_000_000_000;

describe("end_game awaits clearAlarm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  it("does not resolve until deleteAlarm finishes", async () => {
    const harness = createTestServer("ENDGAME");
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
    server.state.phase = "ROUND_RESULTS";
    await server.setAlarmAt(START + 30_000, {
      kind: "phase",
      revision: server.state.phaseRevision,
    });
    assert.notEqual(harness.deadline(), null);

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

    const endDone = server.handleEndGame("A");
    let resolved = false;
    void endDone.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    assert.equal(resolved, false);
    assert.equal(server.state.phase, "GAME_RESULTS");
    assert.equal(server.state.gameOver, true);

    releaseDelete();
    await endDone;
    assert.equal(resolved, true);
    assert.equal(harness.deadline(), null);
  });
});
