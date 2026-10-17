/**
 * Host Pause / Resume / +15s must bump phaseRevision so gesture keys
 * (`host_pause:${rev}`, …) get a fresh actionId for each successful tap.
 * Without the bump, a second +15s (or Pause→Resume→Pause) reuses a burned id.
 */
import assert from "node:assert/strict";
import type { Connection } from "partyserver";
import { describe, expect, it } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";
import { gestureKeyFor } from "../../hooks/useGameRoom";
import { RULES } from "../rules";

function hostConn(sent: unknown[] = []) {
  return {
    id: "A",
    send(payload: string) {
      sent.push(JSON.parse(payload));
    },
  } as unknown as Connection;
}

function draftRoom() {
  const sent: unknown[] = [];
  const conn = hostConn(sent);
  const { server } = createTestServer("CLK1", { connections: [conn] });
  server.state.players = ["A", "B"].map((id, seat) => ({
    id,
    name: id,
    seat,
    connected: true,
    isHost: seat === 0,
    role: "player" as const,
    stones: 0,
    joinedAt: 1,
  }));
  server.state.seatOrder = ["A", "B"];
  server.state.draftOrder = [0, 1, 1, 0];
  server.state.draftCursor = 0;
  server.state.rosterLocked = true;
  server.state.phase = "DRAFT";
  server.state.pickDeadlineAt = Date.now() + RULES.pickClockSeconds * 1000;
  server.state.pickPaused = false;
  server.state.phaseRevision = 0;
  return { server, conn, sent };
}

describe("host clock gesture dedupe", () => {
  it("keys pause/resume/extend by revision only (double-tap safe)", () => {
    expect(gestureKeyFor({ type: "host_pause" }, 2)).toBe("host_pause:2");
    expect(gestureKeyFor({ type: "host_resume" }, 2)).toBe("host_resume:2");
    expect(gestureKeyFor({ type: "host_extend" }, 2)).toBe("host_extend:2");
    expect(gestureKeyFor({ type: "host_extend" }, 3)).toBe("host_extend:3");
  });

  it("bumps revision on extend so a second +15s is not eaten", async () => {
    const { server, conn } = draftRoom();
    const before = server.state.pickDeadlineAt!;
    const rev0 = server.state.phaseRevision;
    const id1 = gestureKeyFor({ type: "host_extend" }, rev0);
    await server.onMessage(
      conn,
      JSON.stringify({ type: "host_extend", actionId: id1 }),
    );
    assert.equal(
      server.state.pickDeadlineAt,
      before + RULES.hostExtendSeconds * 1000,
    );
    assert.equal(server.state.phaseRevision, rev0 + 1);
    assert.equal(server.seenAction(id1), true);

    const id2 = gestureKeyFor(
      { type: "host_extend" },
      server.state.phaseRevision,
    );
    assert.notEqual(id2, id1);
    const mid = server.state.pickDeadlineAt!;
    await server.onMessage(
      conn,
      JSON.stringify({ type: "host_extend", actionId: id2 }),
    );
    assert.equal(
      server.state.pickDeadlineAt,
      mid + RULES.hostExtendSeconds * 1000,
    );
    assert.equal(server.state.phaseRevision, rev0 + 2);
  });

  it("bumps on pause and resume so Pause→Resume→Pause lands", async () => {
    const { server, conn } = draftRoom();
    const rev0 = server.state.phaseRevision;

    const pause1 = gestureKeyFor({ type: "host_pause" }, rev0);
    await server.onMessage(
      conn,
      JSON.stringify({ type: "host_pause", actionId: pause1 }),
    );
    assert.equal(server.state.pickPaused, true);
    assert.equal(server.state.phaseRevision, rev0 + 1);

    const resume = gestureKeyFor(
      { type: "host_resume" },
      server.state.phaseRevision,
    );
    await server.onMessage(
      conn,
      JSON.stringify({ type: "host_resume", actionId: resume }),
    );
    assert.equal(server.state.pickPaused, false);
    assert.equal(server.state.phaseRevision, rev0 + 2);

    const pause2 = gestureKeyFor(
      { type: "host_pause" },
      server.state.phaseRevision,
    );
    assert.notEqual(pause2, pause1);
    await server.onMessage(
      conn,
      JSON.stringify({ type: "host_pause", actionId: pause2 }),
    );
    assert.equal(server.state.pickPaused, true);
    assert.equal(server.state.phaseRevision, rev0 + 3);
  });

  it("rejects a reused extend actionId after the first tap", async () => {
    const { server, conn } = draftRoom();
    const before = server.state.pickDeadlineAt!;
    const id = gestureKeyFor({ type: "host_extend" }, 0);
    await server.onMessage(
      conn,
      JSON.stringify({ type: "host_extend", actionId: id }),
    );
    const afterFirst = server.state.pickDeadlineAt!;
    assert.equal(afterFirst, before + RULES.hostExtendSeconds * 1000);
    await server.onMessage(
      conn,
      JSON.stringify({ type: "host_extend", actionId: id }),
    );
    assert.equal(server.state.pickDeadlineAt, afterFirst);
  });
});
