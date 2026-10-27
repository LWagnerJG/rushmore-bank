/**
 * Soft-disconnect while bank-confirm is open must re-arm the idle clock.
 * Confirm clears diceIdleDeadlineAt; grace keeps the seat on the table (#222),
 * so without cancelling confirm the table freezes until grace expires.
 *
 * Cancel must finish before persist: a concurrent persist that still sees
 * diceIdlePauseRemainingMs can write pause + idle-alarm, and on wake
 * alarmOwner("dice_idle") is null → mismatch clears the clock (soft-lock).
 */
import assert from "node:assert/strict";
import type { Connection } from "partyserver";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";
import type { RoomState } from "../types";

const START = 1_800_000_000_000;

async function diceTable(code = "BANKDISC") {
  const harness = createTestServer(code);
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
  server.state.pots = { A: 10, B: 10 };
  server.state.protectedStones = { A: 20, B: 20 };
  server.state.diceActiveIds = ["A", "B"];
  await server.beginDice();
  return harness;
}

describe("bank-confirm × soft-disconnect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  it("cancels confirm and re-arms idle when the roller soft-disconnects", async () => {
    const harness = await diceTable();
    const { server } = harness;
    assert.equal(server.currentDicePlayerId(), "A");
    assert.equal(server.state.diceSubphase, "READY");
    assert.notEqual(server.state.diceIdleDeadlineAt, null);

    await server.handleBankConfirmOpen("A");
    assert.notEqual(server.state.diceIdlePauseRemainingMs, null);
    assert.equal(server.state.diceIdleDeadlineAt, null);
    assert.equal(harness.deadline(), null);

    server.onClose(
      { id: "A", send() {} } as unknown as Connection,
      1000,
      "",
      true,
    );
    // Cancel + persist are async from onClose
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(server.state.diceIdlePauseRemainingMs, null);
    assert.notEqual(server.state.diceIdleDeadlineAt, null);
    assert.notEqual(harness.deadline(), null);
    assert.equal(server.state.phase, "DICE");
  });

  it("persists cancelled confirm (no stale pause left in storage)", async () => {
    const harness = await diceTable("BANKPERS");
    const { server } = harness;
    await server.handleBankConfirmOpen("A");
    assert.notEqual(server.state.diceIdlePauseRemainingMs, null);

    let releasePut!: () => void;
    const holdPut = new Promise<void>((r) => {
      releasePut = r;
    });
    let statePutStarted!: () => void;
    const sawStatePut = new Promise<void>((r) => {
      statePutStarted = r;
    });
    let statePutDone!: () => void;
    const finishedStatePut = new Promise<void>((r) => {
      statePutDone = r;
    });
    const originalPut = harness.ctx.storage.put.bind(harness.ctx.storage);
    let heldOnce = false;
    harness.ctx.storage.put = async (key: string, value: unknown) => {
      // Snapshot at put entry — simulates Durable Object serializing early.
      const snapshot = structuredClone(value);
      if (key === "state" && !heldOnce) {
        heldOnce = true;
        statePutStarted();
        await holdPut;
        await originalPut(key, snapshot);
        statePutDone();
        return;
      }
      return originalPut(key, snapshot);
    };

    server.onClose(
      { id: "A", send() {} } as unknown as Connection,
      1000,
      "",
      true,
    );
    await sawStatePut;
    // Cancel finished before persist snapped state (pause cleared in memory).
    assert.equal(server.state.diceIdlePauseRemainingMs, null);
    assert.notEqual(server.state.diceIdleDeadlineAt, null);
    // Snapshot taken at put entry must already be the cancelled state.
    releasePut();
    await finishedStatePut;

    const saved = harness.saved.get("state") as RoomState;
    assert.ok(saved, "state must be persisted");
    assert.equal(saved.diceIdlePauseRemainingMs, null);
    assert.notEqual(saved.diceIdleDeadlineAt, null);
  });
});
