/**
 * Host pause + current seat leave must still force-miss the pick.
 * onPickTimeout no-ops while pickPaused; without clearing pause first,
 * the table soft-locks on a disconnected seat until someone resumes.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";

const START = 1_800_000_000_000;

function game() {
  const harness = createTestServer("PAUSELEAVE");
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
  return { server, harness };
}

describe("draft pause × leave force-miss", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  it("force-misses current seat after leave while clock is paused", async () => {
    const { server } = game();
    await server.beginDraft();
    assert.equal(server.currentDraftPlayerId(), "A");
    await server.handlePause("A");
    assert.equal(server.state.pickPaused, true);
    assert.equal(server.state.draftCursor, 0);

    await server.skipDraftIfCurrentLeft("A");

    assert.equal(server.state.pickPaused, false);
    assert.equal(server.state.draftCursor, 1);
    assert.equal(server.state.picks.length, 1);
    assert.equal(server.state.picks[0]!.playerId, "A");
    assert.match(server.state.picks[0]!.text, /Missed/i);
  });

  it("force-misses during CORRECTION pause when the redo seat leaves", async () => {
    const { server } = game();
    await server.beginDraft();
    // Fill first pick so we can correct it later from a later cursor.
    await server.handleLockIn("A", "alpha");
    await server.handleLockIn("B", "bravo");
    // Host corrects A's pick while B is next — enter CORRECTION on turn 0.
    await server.handleCorrect("A", 0, "invalid");
    assert.equal(server.state.phase, "CORRECTION");
    assert.equal(server.currentDraftPlayerId(), "A");
    await server.handlePause("A");
    assert.equal(server.state.pickPaused, true);

    await server.skipDraftIfCurrentLeft("A");

    assert.equal(server.state.pickPaused, false);
    // Correction miss should leave CORRECTION (applyCorrectionLockIn resumes).
    assert.notEqual(server.state.phase, "CORRECTION");
  });
});
