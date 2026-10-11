/**
 * P0: dice must not tumble forever. Server deadline auto-resolves;
 * client lands within ~1.5s of the server result (hard timeout + resync).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Connection } from "partyserver";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuarryServer } from "../../../party/server";
import { createTestServer } from "../../../test/party-server-harness";
import {
  DICE_HARD_LAND_MS,
  authoritativeFaces,
  diceHardLandAt,
  diceHardLandOverdue,
  diceNextNudgeDelayMs,
  diceRevealOverdue,
  resolveDicePresentPhase,
} from "../engine/dice-present";
import { RULES } from "../rules";
import type { PublicDiceBroadcast } from "../types";

const START = 1_800_000_000_000;

function game(connections: Connection[] = []) {
  const harness = createTestServer("STUK", { connections });
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
    async fire() {
      assert.notEqual(harness.deadline(), null);
      vi.setSystemTime(harness.deadline()!);
      harness.setDeadline(null);
      await server.onAlarm();
    },
  };
}

async function beginDice(server: QuarryServer) {
  server.state.pots = { A: 10, B: 10 };
  server.state.protectedStones = { A: 20, B: 20 };
  server.state.diceActiveIds = ["A", "B"];
  await server.beginDice();
}

function tumbling(
  overrides: Partial<PublicDiceBroadcast> = {},
): PublicDiceBroadcast {
  return {
    rollId: "roll-1",
    rollerId: "A",
    personalRollNumber: 1,
    animStartedAt: START,
    animSettleAt: START + RULES.diceAnimMs,
    animSeed: 7,
    revealed: false,
    potBefore: 10,
    ...overrides,
  };
}

describe("client land deadlines", () => {
  it("nudges at settleAt, then at settleAt + 1.5s, never invents faces", () => {
    const secret = tumbling();
    expect(diceRevealOverdue(secret, START + RULES.diceAnimMs - 1)).toBe(false);
    expect(diceNextNudgeDelayMs(secret, START)).toBe(RULES.diceAnimMs);
    expect(diceRevealOverdue(secret, START + RULES.diceAnimMs)).toBe(true);
    expect(diceNextNudgeDelayMs(secret, START + RULES.diceAnimMs)).toBe(
      DICE_HARD_LAND_MS,
    );
    expect(diceHardLandAt(secret)).toBe(START + RULES.diceAnimMs + 1500);
    expect(diceHardLandOverdue(secret, START + RULES.diceAnimMs + 1500)).toBe(
      true,
    );
    expect(diceNextNudgeDelayMs(secret, START + RULES.diceAnimMs + 1500)).toBe(
      0,
    );
    expect(authoritativeFaces(secret)).toBeNull();
    expect(resolveDicePresentPhase(secret).kind).toBe("tumbling");
  });

  it("lands the frame faces arrive — no animationend wait", () => {
    const shown = tumbling({
      revealed: true,
      d1: 5,
      d2: 2,
      potAfter: 17,
      busted: false,
      outcomeKind: "add_sum",
    });
    expect(resolveDicePresentPhase(shown)).toMatchObject({
      kind: "settled",
      d1: 5,
      d2: 2,
    });
    expect(diceRevealOverdue(shown, START + 10_000)).toBe(false);
    expect(diceNextNudgeDelayMs(shown, START + 10_000)).toBeNull();
  });

  it("DicePanel resyncs on the land deadline; DiceScene does not wait on animationend", () => {
    const panel = readFileSync(
      resolve(__dirname, "../../components/DicePanel.tsx"),
      "utf8",
    );
    const scene = readFileSync(
      resolve(__dirname, "../../components/dice/DiceScene.tsx"),
      "utf8",
    );
    expect(panel).toMatch(/type: "resync"/);
    expect(panel).toMatch(/diceNextNudgeDelayMs/);
    expect(panel).toMatch(/diceHardLandAt/);
    expect(panel).toMatch(/visibilitychange/);
    expect(scene).toMatch(/diceHardLandAt/);
    expect(scene).toMatch(/hardSnap/);
    expect(scene).not.toMatch(/onAnimationEnd|addEventListener\(\s*["']animationend["']/);
    const server = readFileSync(
      resolve(__dirname, "../../../party/server.ts"),
      "utf8",
    );
    expect(server).toMatch(/ensureDiceDeadline/);
    expect(server).toMatch(/recoverOverdueDiceRoll/);
  });
});

describe("server deadline auto-resolves stuck COMMITTED rolls", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  it("reconnect after settleAt with a lost alarm reveals and broadcasts faces", async () => {
    const sent: Array<Record<string, unknown>> = [];
    const conn = {
      id: "A",
      send(payload: string) {
        sent.push(JSON.parse(payload) as Record<string, unknown>);
      },
    } as unknown as Connection;
    const g = game([conn]);
    await beginDice(g.server);
    await g.server.handleRoll("A");
    const roll = structuredClone(g.server.state.lastDice!);
    assert.equal(g.server.state.diceSubphase, "COMMITTED");
    await g.server.clearAlarm();
    vi.setSystemTime(roll.animSettleAt + 50);
    sent.length = 0;
    await g.server.onConnect(conn);
    assert.equal(g.server.state.diceSubphase, "SETTLED");
    assert.equal(g.server.state.lastDice!.revealed, true);
    assert.equal(g.server.state.pots.A, roll.potAfter);
    const stateMsg = sent.find((m) => m.type === "state");
    const pub = stateMsg?.state as {
      diceSubphase: string;
      lastDice: { revealed: boolean; d1: number; d2: number };
    };
    expect(pub.diceSubphase).toBe("SETTLED");
    expect(pub.lastDice.revealed).toBe(true);
    expect(pub.lastDice.d1).toBe(roll.d1);
    expect(pub.lastDice.d2).toBe(roll.d2);
  });

  it("resync after settleAt reveals every client, not just the requester", async () => {
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
    await beginDice(g.server);
    await g.server.handleRoll("A");
    const roll = structuredClone(g.server.state.lastDice!);
    await g.server.clearAlarm();
    vi.setSystemTime(roll.animSettleAt + 1);
    sentA.length = 0;
    sentB.length = 0;
    await g.server.onMessage(a, JSON.stringify({ type: "resync", lastVersion: 0 }));
    assert.equal(g.server.state.lastDice!.revealed, true);
    assert.equal(g.server.state.diceSubphase, "SETTLED");
    expect(sentA.some((m) => m.type === "state")).toBe(true);
    expect(sentB.some((m) => m.type === "state")).toBe(true);
    for (const inbox of [sentA, sentB]) {
      const pub = inbox.find((m) => m.type === "state")?.state as {
        lastDice: { revealed: boolean; d1: number };
      };
      expect(pub.lastDice.revealed).toBe(true);
      expect(pub.lastDice.d1).toBe(roll.d1);
    }
  });

  it("onStart with overdue COMMITTED and no alarm resolves (hibernate)", async () => {
    const g = game();
    await beginDice(g.server);
    await g.server.handleRoll("A");
    const roll = structuredClone(g.server.state.lastDice!);
    await g.server.persist();
    await g.server.clearAlarm();
    g.saved.delete("alarm");
    vi.setSystemTime(roll.animSettleAt + 10);
    const restarted = createTestServer("STUK", {
      saved: g.saved,
      deadlineRef: g.deadlineRef,
    }).server;
    await restarted.onStart();
    assert.equal(restarted.state.diceSubphase, "SETTLED");
    assert.equal(restarted.state.lastDice!.revealed, true);
    assert.equal(restarted.state.pots.A, roll.potAfter);
  });

  it("stale dice_anim context after settleAt reveals instead of clearing", async () => {
    const g = game();
    await beginDice(g.server);
    await g.server.handleRoll("A");
    const roll = structuredClone(g.server.state.lastDice!);
    // Old onAlarm cleared a mismatched dice_anim and left COMMITTED stuck.
    const poisoned = {
      kind: "dice_anim" as const,
      revision: g.server.state.phaseRevision,
      deadlineAt: roll.animSettleAt,
      context: '["dice_anim","DICE",0,0,"other-roll"]',
    };
    (g.server as unknown as { alarmPayload: typeof poisoned }).alarmPayload =
      poisoned;
    g.saved.set("alarm", poisoned);
    vi.setSystemTime(roll.animSettleAt + 5);
    g.setDeadline(null);
    await g.server.onAlarm();
    assert.equal(g.server.state.diceSubphase, "SETTLED");
    assert.equal(g.server.state.lastDice!.revealed, true);
  });

  it("lost alarm before settleAt is re-armed, then lands on fire", async () => {
    const g = game();
    await beginDice(g.server);
    await g.server.handleRoll("A");
    const settleAt = g.server.state.lastDice!.animSettleAt;
    await g.server.clearAlarm();
    assert.equal(g.deadline(), null);
    const conn = { id: "B", send() {} } as unknown as Connection;
    await g.server.onConnect(conn);
    assert.equal(g.server.state.diceSubphase, "COMMITTED");
    assert.equal(g.server.state.lastDice!.revealed, false);
    assert.equal(g.deadline(), settleAt);
    await g.fire();
    assert.equal(g.server.state.diceSubphase, "SETTLED");
    assert.equal(g.server.state.lastDice!.revealed, true);
  });

  it("reconnect mid-roll before settleAt keeps the roll secret and the clock", async () => {
    const g = game();
    await beginDice(g.server);
    await g.server.handleRoll("A");
    const settleAt = g.server.state.lastDice!.animSettleAt;
    const conn = { id: "B", send() {} } as unknown as Connection;
    g.server.onClose(conn, 1000, "", true);
    await g.server.onConnect(conn);
    assert.equal(g.server.state.diceSubphase, "COMMITTED");
    assert.equal(g.server.state.lastDice!.revealed, false);
    assert.equal(g.deadline(), settleAt);
  });
});
