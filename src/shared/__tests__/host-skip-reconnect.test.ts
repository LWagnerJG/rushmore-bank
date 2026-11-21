/**
 * Disconnect action grace → draft skip, mid-game rejoin reclaim,
 * host-only skip permission, and lock_in × host_skip race safety.
 */
import assert from "node:assert/strict";
import type { Connection } from "partyserver";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTestServer } from "../../../test/party-server-harness";
import { RULES } from "../rules";

const START = 1_900_000_000_000;

const draftPanel = readFileSync(
  resolve(__dirname, "../../components/DraftPanel.tsx"),
  "utf8",
);
const settings = readFileSync(
  resolve(__dirname, "../../components/SettingsSheet.tsx"),
  "utf8",
);
const board = readFileSync(
  resolve(__dirname, "../../components/DraftBoard.tsx"),
  "utf8",
);

function draftGame() {
  const harness = createTestServer("SKIP");
  const { server } = harness;
  server.state.players = ["A", "B", "C"].map((id, seat) => ({
    id,
    name: id === "A" ? "Luke" : id === "B" ? "Sam" : "Alex",
    seat,
    connected: true,
    isHost: seat === 0,
    role: "player" as const,
    stones: 40,
    joinedAt: START,
  }));
  server.state.seatOrder = ["A", "B", "C"];
  server.state.rosterLocked = true;
  server.state.selectedTopic = {
    id: "t1",
    text: "Best snacks",
    scope: "everyday",
    scopeBoundary: "food",
  };
  return { server, harness };
}

describe("disconnect action grace + host skip + rejoin", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  it("skips a disconnected draft seat after ~9s grace, not immediately", async () => {
    const { server } = draftGame();
    await server.beginDraft();
    assert.equal(server.currentDraftPlayerId(), "A");
    server.onClose({ id: "A", send() {} } as unknown as Connection, 1000, "", true);
    assert.equal(server.state.phase, "DRAFT");
    assert.equal(server.state.draftCursor, 0);
    assert.equal(server.state.picks.length, 0);

    await vi.advanceTimersByTimeAsync(RULES.disconnectActionGraceMs - 500);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(server.state.draftCursor, 0);
    assert.equal(server.state.picks.length, 0);

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(server.state.draftCursor, 1);
    assert.equal(server.state.picks.length, 1);
    assert.match(server.state.picks[0]!.text, /Skipped \(away\)/i);
    assert.equal(server.state.players.find((p) => p.id === "A")?.connected, false);
    // Seat held for rejoin
    assert.ok(server.state.players.some((p) => p.id === "A"));
  });

  it("reconnects the same id mid-game and restores the seat", async () => {
    const { server } = draftGame();
    await server.beginDraft();
    await server.handleLockIn("A", "chips");
    assert.equal(server.state.draftCursor, 1);
    server.onClose({ id: "B", send() {} } as unknown as Connection, 1000, "", true);
    await vi.advanceTimersByTimeAsync(RULES.disconnectActionGraceMs + 50);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(server.currentDraftPlayerId(), "C");
    const stonesBefore = server.state.players.find((p) => p.id === "B")!.stones;
    const pickCount = server.state.picks.filter((p) => p.playerId === "A").length;

    server.onConnect({ id: "B", send() {} } as unknown as Connection);
    await server.handleJoin("B", "Sam", "player");
    const b = server.state.players.find((p) => p.id === "B")!;
    assert.equal(b.connected, true);
    assert.equal(b.stones, stonesBefore);
    assert.equal(b.seat, 1);
    assert.equal(
      server.state.picks.filter((p) => p.playerId === "A").length,
      pickCount,
    );
    assert.equal(server.state.seatOrder[1], "B");
  });

  it("reclaims a disconnected seat by unique nickname on a new connection id", async () => {
    const { server } = draftGame();
    await server.beginDraft();
    await server.handleLockIn("A", "pretzel");
    server.onClose({ id: "B", send() {} } as unknown as Connection, 1000, "", true);
    await vi.advanceTimersByTimeAsync(RULES.disconnectActionGraceMs + 50);
    await Promise.resolve();
    await Promise.resolve();

    await server.handleJoin("B2", "Sam", "player");
    assert.equal(server.state.players.some((p) => p.id === "B"), false);
    const reclaimed = server.state.players.find((p) => p.id === "B2")!;
    assert.equal(reclaimed.name, "Sam");
    assert.equal(reclaimed.seat, 1);
    assert.equal(reclaimed.connected, true);
    assert.equal(server.state.seatOrder[1], "B2");
  });

  it("host_skip_draft is host-only and advances like an auto-skip", async () => {
    const { server } = draftGame();
    await server.beginDraft();
    await assert.rejects(
      () => server.handleHostSkipDraft("B", 0),
      /Host only/,
    );
    assert.equal(server.state.draftCursor, 0);
    await server.handleHostSkipDraft("A", 0);
    assert.equal(server.state.draftCursor, 1);
    assert.equal(server.state.picks[0]!.text, "Skipped");
    assert.match(server.state.notice ?? "", /Host skipped/i);
  });

  it("rejects a stale host skip after lock_in advances the cursor", async () => {
    const { server } = draftGame();
    await server.beginDraft();
    await server.handleLockIn("A", "salsa");
    assert.equal(server.state.draftCursor, 1);
    assert.equal(server.state.picks.length, 1);
    // Late skip still targeting turn 0 must no-op — do not skip B.
    await server.handleHostSkipDraft("A", 0);
    assert.equal(server.state.draftCursor, 1);
    assert.equal(server.state.picks.length, 1);
    assert.equal(server.state.picks[0]!.text, "salsa");
  });

  it("lock_in wins the race when the slot is already filled by skip", async () => {
    const { server } = draftGame();
    await server.beginDraft();
    await server.handleHostSkipDraft("A", 0);
    assert.equal(server.state.picks[0]!.text, "Skipped");
    await assert.rejects(
      () => server.handleLockIn("A", "too-late"),
      /Not your turn|Slot already filled/,
    );
    assert.equal(server.state.picks.filter((p) => p.turnIndex === 0).length, 1);
  });

  it("immediately skips an already-away seat when their turn starts", async () => {
    const { server } = draftGame();
    await server.beginDraft();
    // B drops while A is picking — grace expires before B's turn.
    server.onClose({ id: "B", send() {} } as unknown as Connection, 1000, "", true);
    await vi.advanceTimersByTimeAsync(RULES.disconnectActionGraceMs + 50);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(server.state.players.find((p) => p.id === "B")?.connected, false);
    assert.equal(server.leaveTimers.has("B"), false);
    await server.handleLockIn("A", "chips");
    // startPickClock must auto-fill B without waiting the pick clock.
    assert.equal(server.state.picks.some((p) => p.playerId === "B"), true);
    assert.match(
      server.state.picks.find((p) => p.playerId === "B")!.text,
      /Skipped \(away\)/i,
    );
    assert.equal(server.currentDraftPlayerId(), "C");
  });

  it("renders settings invite + host Skip + disconnected cue", () => {
    expect(settings).toMatch(/settings-invite/);
    expect(settings).toMatch(/settings-room-code/);
    expect(settings).toMatch(/Share invite|QRCodeSVG/);
    expect(settings).not.toMatch(/void _roomCode/);
    expect(draftPanel).toMatch(/host_skip_draft/);
    expect(draftPanel).toMatch(/turnIndex:\s*state\.draftCursor/);
    expect(draftPanel).toMatch(/Skip \$\{turnPlayer\.name\}|Skip \{turnPlayer/);
    expect(draftPanel).not.toMatch(/confirm/i);
    expect(board).toMatch(/disconnected, skipped/);
  });
});
