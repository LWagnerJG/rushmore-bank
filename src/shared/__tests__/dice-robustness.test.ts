/**
 * Dice-table robustness: leftover pots, protectedStones sync, bank-confirm
 * cancel vs roll anim, seat reclaim id remaps, bust-redo leave recovery.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { QuarryServer } from "../../../party/server";
import { createTestServer } from "../../../test/party-server-harness";

const START = 1_800_000_000_000;

function game() {
  const harness = createTestServer("ROBU");
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
  return {
    server,
    deadline: harness.deadline,
    async fire() {
      assert.notEqual(harness.deadline(), null);
      vi.setSystemTime(harness.deadline()!);
      harness.setDeadline(null);
      await server.onAlarm();
    },
  };
}

async function beginDice(server: QuarryServer, pots?: Record<string, number>) {
  server.state.pots = pots ?? { A: 10, B: 10, C: 10 };
  server.state.protectedStones = { A: 20, B: 20, C: 20 };
  for (const p of server.state.players) {
    p.stones = server.state.protectedStones[p.id] ?? 20;
  }
  server.state.diceActiveIds = ["A", "B", "C"];
  await server.beginDice();
}

describe("dice table robustness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  it("banks leftover disconnected pots before ROUND_RESULTS", async () => {
    const g = game();
    await beginDice(g.server, { A: 10, B: 0, C: 50 });
    g.server.state.diceActiveIds = ["A", "C"];
    g.server.state.players.find((p) => p.id === "C")!.connected = false;
    g.server.state.players.find((p) => p.id === "B")!.connected = false;
    await g.server.handlePullOut("A");
    assert.equal(g.server.state.phase, "ROUND_RESULTS");
    assert.equal(g.server.state.pots.C, 0);
    assert.equal(g.server.state.players.find((p) => p.id === "C")!.stones, 70);
    assert.equal(g.server.state.protectedStones.C, 70);
  });

  it("syncs protectedStones when banking", async () => {
    const g = game();
    await beginDice(g.server);
    await g.server.handlePullOut("A");
    assert.equal(g.server.state.players.find((p) => p.id === "A")!.stones, 30);
    assert.equal(g.server.state.protectedStones.A, 30);
    assert.equal(g.server.state.pots.A, 0);
  });

  it("bank-confirm cancel after roll does not replace the settle alarm", async () => {
    const g = game();
    await beginDice(g.server);
    await g.server.handleBankConfirmOpen("A");
    await g.server.handleRoll("A");
    const settleAt = g.server.state.lastDice!.animSettleAt;
    assert.equal(g.deadline(), settleAt);
    await g.server.handleBankConfirmCancel("A");
    // Still committed; anim alarm preserved (not swapped for idle).
    assert.equal(g.server.state.diceSubphase, "COMMITTED");
    assert.equal(g.server.state.lastDice!.revealed, false);
    assert.equal(g.deadline(), settleAt);
    assert.equal(g.server.state.diceIdlePauseRemainingMs, null);
    await g.fire();
    assert.equal(g.server.state.diceSubphase, "SETTLED");
    assert.equal(g.server.state.lastDice!.revealed, true);
  });

  it("reclaimSeatId remaps bust and party-prompt ids", () => {
    const g = game();
    g.server.state.bustedPlayerIdsThisRound = ["A"];
    g.server.state.partyBustRedoUsedIds = ["A"];
    g.server.state.partyPrompt = {
      kind: "bust_redo",
      targetPlayerIds: ["A"],
      resolved: false,
      redoAvailable: true,
      acknowledgedPlayerIds: ["A"],
    };
    g.server.state.players.find((p) => p.id === "A")!.connected = false;
    assert.equal(g.server.reclaimSeatId("A", "A-new", "A"), true);
    assert.deepEqual(g.server.state.bustedPlayerIdsThisRound, ["A-new"]);
    assert.deepEqual(g.server.state.partyBustRedoUsedIds, ["A-new"]);
    assert.deepEqual(g.server.state.partyPrompt?.targetPlayerIds, ["A-new"]);
    assert.deepEqual(g.server.state.partyPrompt?.acknowledgedPlayerIds, [
      "A-new",
    ]);
    assert.ok(g.server.state.seatOrder.includes("A-new"));
    assert.ok(!g.server.state.seatOrder.includes("A"));
  });

  it("leaving during bust-redo clears the prompt and banks the leaver", async () => {
    const g = game();
    await beginDice(g.server);
    g.server.state.settings.partyMode = true;
    g.server.state.diceSubphase = "SETTLED";
    g.server.state.diceActiveIds = ["B", "C"];
    g.server.state.bustedPlayerIdsThisRound = ["A"];
    g.server.state.pots.A = 0;
    g.server.state.partyPrompt = {
      kind: "bust_redo",
      targetPlayerIds: ["A"],
      resolved: false,
      redoAvailable: true,
    };
    g.server.state.players.find((p) => p.id === "A")!.connected = false;
    await g.server.recoverDiceAfterLeave("A");
    assert.equal(g.server.state.partyPrompt, null);
    assert.ok(!g.server.state.diceActiveIds.includes("A"));
    // Table continues with a connected roller — not stuck on the drink prompt.
    assert.equal(g.server.state.diceSubphase, "READY");
    assert.ok(["B", "C"].includes(g.server.currentDicePlayerId()!));
  });

  it("host_correct refuses locked scores before mutating picks", async () => {
    const g = game();
    g.server.state.phase = "SCORE_REVEAL";
    g.server.state.scoresLocked = true;
    g.server.state.picks = [
      { playerId: "A", text: "Lion", turnIndex: 0, pickIndex: 0 },
    ];
    g.server.state.takenNormalized = ["lion"];
    await assert.rejects(
      () => g.server.handleCorrect("A", 0, "invalid"),
      /Scores locked/,
    );
    assert.equal(g.server.state.picks.length, 1);
    assert.deepEqual(g.server.state.takenNormalized, ["lion"]);
  });
});
