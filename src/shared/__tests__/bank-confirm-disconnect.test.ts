/**
 * Soft-disconnect while bank-confirm is open must re-arm the idle clock.
 * Confirm clears diceIdleDeadlineAt; grace keeps the seat on the table (#222),
 * so without cancelling confirm the table freezes until grace expires.
 */
import assert from "node:assert/strict";
import type { Connection } from "partyserver";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";

const START = 1_800_000_000_000;

describe("bank-confirm × soft-disconnect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  it("cancels confirm and re-arms idle when the roller soft-disconnects", async () => {
    const harness = createTestServer("BANKDISC");
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
    // handleBankConfirmCancel is fire-and-forget from onClose
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(server.state.diceIdlePauseRemainingMs, null);
    assert.notEqual(server.state.diceIdleDeadlineAt, null);
    assert.notEqual(harness.deadline(), null);
    assert.equal(server.state.phase, "DICE");
  });
});
