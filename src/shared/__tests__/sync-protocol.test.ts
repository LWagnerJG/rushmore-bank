import { describe, expect, it } from "vitest";
import assert from "node:assert/strict";
import type { Connection } from "partyserver";
import { createTestServer } from "../../../test/party-server-harness";
import {
  classifyStateVersion,
  enqueueWhileConnecting,
  makePing,
  makePong,
  pingRttMs,
  shouldApplyState,
  shouldRequestResync,
  socketLooksDead,
  versionFromMessage,
  SYNC_DEAD_SOCKET_MS,
  SYNC_PING_MS,
} from "../engine/sync-protocol";
import { mergePublicState } from "../engine/merge-public-state";
import { projectPublicState } from "../engine/public-state";
import { emptyRoomState } from "../types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("state version gaps", () => {
  it("classifies first / ok / stale / gap", () => {
    expect(classifyStateVersion(null, 1)).toBe("first");
    expect(classifyStateVersion(3, 4)).toBe("ok");
    expect(classifyStateVersion(4, 4)).toBe("stale");
    expect(classifyStateVersion(4, 3)).toBe("stale");
    expect(classifyStateVersion(4, 6)).toBe("gap");
    expect(shouldRequestResync("gap")).toBe(true);
    expect(shouldRequestResync("ok")).toBe(false);
    expect(shouldApplyState("stale")).toBe(false);
    expect(shouldApplyState("gap")).toBe(true);
  });

  it("reads seq or stateVersion from a wire message", () => {
    expect(versionFromMessage({ seq: 9 })).toBe(9);
    expect(versionFromMessage({ state: { stateVersion: 4 } })).toBe(4);
    expect(versionFromMessage({})).toBeNull();
  });

  it("measures ping RTT and flags a 5s dead socket", () => {
    const ping = makePing(1000);
    const pong = makePong(ping.t, 1100);
    expect(pingRttMs(pong, 1180)).toBe(180);
    expect(socketLooksDead(1000, 1000 + SYNC_DEAD_SOCKET_MS - 1)).toBe(false);
    expect(socketLooksDead(1000, 1000 + SYNC_DEAD_SOCKET_MS)).toBe(true);
    expect(SYNC_PING_MS).toBe(2_000);
    expect(SYNC_DEAD_SOCKET_MS).toBe(5_000);
  });

  it("queues messages while CONNECTING and drops the oldest when full", () => {
    let q: string[] = [];
    q = enqueueWhileConnecting(q, "a", 3);
    q = enqueueWhileConnecting(q, "b", 3);
    q = enqueueWhileConnecting(q, "c", 3);
    q = enqueueWhileConnecting(q, "d", 3);
    expect(q).toEqual(["b", "c", "d"]);
  });

  it("merge ignores a stale lower stateVersion", () => {
    const a = projectPublicState(emptyRoomState("SYNC"), "x");
    const older = { ...a, stateVersion: 2, notice: "old" };
    const newer = { ...a, stateVersion: 5, notice: "new" };
    expect(mergePublicState(newer, older).notice).toBe("new");
    expect(mergePublicState(older, newer).notice).toBe("new");
  });
});

describe("PartyServer seq / ping / resync", () => {
  it("increments stateVersion and seq on each broadcast", () => {
    const sent: Array<Record<string, unknown>> = [];
    const conn = {
      id: "A",
      send(payload: string) {
        sent.push(JSON.parse(payload) as Record<string, unknown>);
      },
    } as unknown as Connection;
    const { server } = createTestServer("SEQ1", { connections: [conn] });
    server.state.players = [
      {
        id: "A",
        name: "A",
        seat: 0,
        connected: true,
        isHost: true,
        role: "player",
        stones: 0,
        joinedAt: 1,
      },
    ];
    server.broadcastState();
    server.broadcastState();
    expect(server.state.stateVersion).toBe(2);
    expect(sent).toHaveLength(2);
    expect(sent[0]?.seq).toBe(1);
    expect(sent[1]?.seq).toBe(2);
    const s0 = sent[0]?.state as { stateVersion: number };
    expect(s0.stateVersion).toBe(1);
  });

  it("pong echoes the client timestamp without bumping version", async () => {
    const sent: Array<Record<string, unknown>> = [];
    const conn = {
      id: "A",
      send(payload: string) {
        sent.push(JSON.parse(payload) as Record<string, unknown>);
      },
    } as unknown as Connection;
    const { server } = createTestServer("PNG1", { connections: [conn] });
    server.state.players = [
      {
        id: "A",
        name: "A",
        seat: 0,
        connected: true,
        isHost: true,
        role: "player",
        stones: 0,
        joinedAt: 1,
      },
    ];
    const before = server.state.stateVersion;
    await server.onMessage(conn, JSON.stringify({ type: "ping", t: 42 }));
    expect(server.state.stateVersion).toBe(before);
    expect(sent[0]).toMatchObject({ type: "pong", t: 42 });
    expect(typeof sent[0]?.serverT).toBe("number");
  });

  it("resync returns a full snapshot without incrementing the room seq", async () => {
    const sent: Array<Record<string, unknown>> = [];
    const conn = {
      id: "A",
      send(payload: string) {
        sent.push(JSON.parse(payload) as Record<string, unknown>);
      },
    } as unknown as Connection;
    const { server } = createTestServer("RS1", { connections: [conn] });
    server.state.players = [
      {
        id: "A",
        name: "A",
        seat: 0,
        connected: true,
        isHost: true,
        role: "player",
        stones: 0,
        joinedAt: 1,
      },
    ];
    server.broadcastState();
    const v = server.state.stateVersion;
    sent.length = 0;
    await server.onMessage(conn, JSON.stringify({ type: "resync", lastVersion: 0 }));
    expect(server.state.stateVersion).toBe(v);
    assert.equal(sent[0]?.type, "state");
    expect(sent[0]?.seq).toBe(v);
    const state = sent[0]?.state as { phaseRevision: number; stateVersion: number };
    expect(state.phaseRevision).toBe(server.state.phaseRevision);
    expect(state.stateVersion).toBe(v);
  });
});

describe("client hook wires gap resync, queue, and heartbeat", () => {
  const hook = readFileSync(
    resolve(__dirname, "../../hooks/useGameRoom.ts"),
    "utf8",
  );

  it("requests resync on a version gap and on visibility/online/focus", () => {
    expect(hook).toMatch(/shouldRequestResync/);
    expect(hook).toMatch(/type: "resync"/);
    expect(hook).toMatch(/addEventListener\("visibilitychange"/);
    expect(hook).toMatch(/addEventListener\("online"/);
    expect(hook).toMatch(/addEventListener\("focus"/);
    expect(hook).toMatch(/makePing/);
    expect(hook).toMatch(/SYNC_DEAD_SOCKET_MS/);
  });

  it("queues outbound messages while the socket is not OPEN", () => {
    expect(hook).toMatch(/enqueueWhileConnecting/);
    expect(hook).toMatch(/readyState !== WebSocket\.CONNECTING/);
    expect(hook).toMatch(/outgoingQueueRef/);
  });
});
