/**
 * Disconnect action grace → draft skip, mid-game rejoin reclaim,
 * host-only skip permission, lock_in × host_skip race safety,
 * and host unstick across phases.
 */
import assert from "node:assert/strict";
import type { Connection } from "partyserver";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTestServer } from "../../../test/party-server-harness";
import { RULES } from "../rules";
import { presenceCue, presenceFor } from "../presence";
import { projectPublicStateShared } from "../engine/public-state";

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
const rail = readFileSync(
  resolve(__dirname, "../../components/PlayerRail.tsx"),
  "utf8",
);
const dice = readFileSync(
  resolve(__dirname, "../../components/DicePanel.tsx"),
  "utf8",
);

const START = 1_900_000_000_000;

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
    assert.ok(server.state.players.some((p) => p.id === "A"));
  });

  it("projects reconnecting during grace and away after", async () => {
    const { server } = draftGame();
    await server.beginDraft();
    server.onClose({ id: "B", send() {} } as unknown as Connection, 1000, "", true);
    const during = projectPublicStateShared(server.state, {
      gracePlayerIds: server.gracePlayerIds(),
    });
    assert.equal(during.players.find((p) => p.id === "B")?.presence, "reconnecting");
    assert.equal(presenceCue(during.players.find((p) => p.id === "B")!)?.label, "reconnecting…");

    await vi.advanceTimersByTimeAsync(RULES.disconnectActionGraceMs + 50);
    await Promise.resolve();
    await Promise.resolve();
    const after = projectPublicStateShared(server.state, {
      gracePlayerIds: server.gracePlayerIds(),
    });
    assert.equal(after.players.find((p) => p.id === "B")?.presence, "away");
    assert.equal(presenceCue(after.players.find((p) => p.id === "B")!)?.label, "skipped");
  });

  it("clears presence to live as soon as they rejoin", async () => {
    const { server } = draftGame();
    await server.beginDraft();
    server.onClose({ id: "B", send() {} } as unknown as Connection, 1000, "", true);
    await vi.advanceTimersByTimeAsync(RULES.disconnectActionGraceMs + 50);
    await Promise.resolve();
    await Promise.resolve();
    server.onConnect({ id: "B", send() {} } as unknown as Connection);
    await server.handleJoin("B", "Sam", "player");
    const pub = projectPublicStateShared(server.state, {
      gracePlayerIds: server.gracePlayerIds(),
    });
    const b = pub.players.find((p) => p.id === "B")!;
    assert.equal(b.connected, true);
    assert.equal(b.presence, "live");
    assert.equal(presenceCue(b), null);
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
    server.onClose({ id: "B", send() {} } as unknown as Connection, 1000, "", true);
    await vi.advanceTimersByTimeAsync(RULES.disconnectActionGraceMs + 50);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(server.state.players.find((p) => p.id === "B")?.connected, false);
    assert.equal(server.seatPastDisconnectGrace("B"), true);
    await server.handleLockIn("A", "chips");
    assert.equal(server.state.picks.some((p) => p.playerId === "B"), true);
    assert.match(
      server.state.picks.find((p) => p.playerId === "B")!.text,
      /Skipped \(away\)/i,
    );
    assert.equal(server.currentDraftPlayerId(), "C");
  });

  it("host_skip_away expires grace early and advances draft", async () => {
    const { server } = draftGame();
    await server.beginDraft();
    assert.equal(server.currentDraftPlayerId(), "A");
    // Soft-disconnect the on-clock seat; host (still A during grace) cannot
    // skip-away self — drop B instead and have host A expire B early.
    server.onClose({ id: "B", send() {} } as unknown as Connection, 1000, "", true);
    assert.equal(server.gracePlayerIds().includes("B"), true);
    await assert.rejects(
      () => server.handleHostSkipAway("B", "A"),
      /Host only/,
    );
    await server.handleHostSkipAway("A", "B");
    assert.equal(server.gracePlayerIds().includes("B"), false);
    assert.equal(server.state.players.find((p) => p.id === "B")?.connected, false);
    // B is past grace — when their turn starts they are auto-missed.
    await server.handleLockIn("A", "chips");
    assert.match(
      server.state.picks.find((p) => p.playerId === "B")!.text,
      /Skipped \(away\)/i,
    );
  });

  it("presence helpers map live / reconnecting / away", () => {
    assert.equal(presenceFor(true, false), "live");
    assert.equal(presenceFor(false, true), "reconnecting");
    assert.equal(presenceFor(false, false), "away");
  });

  it("renders settings invite + column Skip + presence chips", () => {
    expect(settings).toMatch(/settings-invite/);
    expect(settings).toMatch(/settings-room-code/);
    expect(settings).toMatch(/Tap to copy|Copied/);
    expect(settings).toMatch(/Share invite|QRCodeSVG/);
    expect(settings).toMatch(/host_skip_away/);
    expect(settings).not.toMatch(/void _roomCode/);
    expect(draftPanel).not.toMatch(/host_skip_draft/);
    expect(board).toMatch(/host_skip_draft/);
    expect(board).toMatch(/draft-host-skip-btn/);
    expect(board).toMatch(/presenceCue|player-presence-chip/);
    expect(board).toMatch(/skipArmed/);
    expect(rail).toMatch(/player-presence-chip/);
    expect(rail).toMatch(/presenceCue|cue\.label/);
    expect(dice).toMatch(/host_skip_dice/);
  });
});
