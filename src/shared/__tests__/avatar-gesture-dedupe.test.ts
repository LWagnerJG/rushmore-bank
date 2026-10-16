/**
 * Avatar / remove / correct taps must not share one actionId per revision.
 * set_avatar no-ops without bumping phaseRevision when unchanged, so a bare
 * `set_avatar:${rev}` key would burn the id and eat the next distinct tap.
 */
import assert from "node:assert/strict";
import type { Connection } from "partyserver";
import { describe, expect, it } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";
import { gestureKeyFor } from "../../hooks/useGameRoom";
import { BEAN_AVATAR_IDS } from "../bean-avatars";

function hostConn(sent: unknown[] = []) {
  return {
    id: "A",
    send(payload: string) {
      sent.push(JSON.parse(payload));
    },
  } as unknown as Connection;
}

function lobbyRoom() {
  const sent: unknown[] = [];
  const conn = hostConn(sent);
  const { server } = createTestServer("AVTR", { connections: [conn] });
  const a = BEAN_AVATAR_IDS[0]!;
  const b = BEAN_AVATAR_IDS[1]!;
  server.state.players = [
    {
      id: "A",
      name: "Ada",
      seat: 0,
      connected: true,
      isHost: true,
      role: "player" as const,
      stones: 0,
      joinedAt: 1,
      avatarId: a,
    },
    {
      id: "B",
      name: "Bea",
      seat: 1,
      connected: true,
      isHost: false,
      role: "player" as const,
      stones: 0,
      joinedAt: 2,
      avatarId: b,
    },
  ];
  server.state.seatOrder = ["A", "B"];
  server.state.phase = "LOBBY";
  return { server, conn, sent, a, b };
}

describe("avatar / multi-target gesture dedupe", () => {
  it("gesture keys discriminate avatar, remove, correct, rename, custom_topic", () => {
    expect(
      gestureKeyFor({ type: "set_avatar", avatarId: "aviator" }, 1),
    ).not.toBe(
      gestureKeyFor({ type: "set_avatar", avatarId: "grill" }, 1),
    );
    expect(
      gestureKeyFor({ type: "remove_player", playerId: "B" }, 1),
    ).not.toBe(
      gestureKeyFor({ type: "remove_player", playerId: "C" }, 1),
    );
    expect(
      gestureKeyFor(
        { type: "host_correct", turnIndex: 0, reason: "duplicate" },
        1,
      ),
    ).not.toBe(
      gestureKeyFor(
        { type: "host_correct", turnIndex: 1, reason: "duplicate" },
        1,
      ),
    );
  });

  it("noop set_avatar still burns actionId; next distinct avatar must use a new id", async () => {
    const { server, conn, a, b } = lobbyRoom();
    const noopId = gestureKeyFor({ type: "set_avatar", avatarId: a }, 0);
    await server.onMessage(
      conn,
      JSON.stringify({ type: "set_avatar", avatarId: a, actionId: noopId }),
    );
    assert.equal(server.state.players[0]!.avatarId, a);
    assert.equal(server.seenAction(noopId), true);
    // Same key would be eaten — prove the old bare key would stuck us:
    const bareKey = `set_avatar:0`;
    assert.equal(noopId, `set_avatar:0:${a}`);
    assert.notEqual(noopId, bareKey);

    const nextId = gestureKeyFor({ type: "set_avatar", avatarId: b }, 0);
    assert.notEqual(nextId, noopId);
    await server.onMessage(
      conn,
      JSON.stringify({ type: "set_avatar", avatarId: b, actionId: nextId }),
    );
    assert.equal(server.state.players[0]!.avatarId, b);

    // Reusing the noop id must not flip back
    await server.onMessage(
      conn,
      JSON.stringify({ type: "set_avatar", avatarId: a, actionId: noopId }),
    );
    assert.equal(server.state.players[0]!.avatarId, b);
  });

  it("remove_player accepts distinct targets; reused actionId is ignored", async () => {
    const { server, conn } = lobbyRoom();
    // Add a third seat so we can remove two
    server.state.players.push({
      id: "C",
      name: "Cee",
      seat: 2,
      connected: true,
      isHost: false,
      role: "player" as const,
      stones: 0,
      joinedAt: 3,
    });
    server.state.seatOrder = ["A", "B", "C"];

    const idB = gestureKeyFor({ type: "remove_player", playerId: "B" }, 0);
    const idC = gestureKeyFor({ type: "remove_player", playerId: "C" }, 0);
    assert.notEqual(idB, idC);

    await server.onMessage(
      conn,
      JSON.stringify({ type: "remove_player", playerId: "B", actionId: idB }),
    );
    assert.equal(
      server.state.players.some((p) => p.id === "B"),
      false,
    );

    await server.onMessage(
      conn,
      JSON.stringify({ type: "remove_player", playerId: "C", actionId: idC }),
    );
    assert.equal(
      server.state.players.some((p) => p.id === "C"),
      false,
    );

    // Re-add C and try with burned idB — must not remove
    server.state.players.push({
      id: "C",
      name: "Cee",
      seat: 1,
      connected: true,
      isHost: false,
      role: "player" as const,
      stones: 0,
      joinedAt: 4,
    });
    server.state.seatOrder = ["A", "C"];
    await server.onMessage(
      conn,
      JSON.stringify({ type: "remove_player", playerId: "C", actionId: idB }),
    );
    assert.equal(
      server.state.players.some((p) => p.id === "C"),
      true,
      "reused actionId must not remove a different player",
    );
  });
});
