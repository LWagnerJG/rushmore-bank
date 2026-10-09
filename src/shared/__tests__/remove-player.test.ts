import { describe, expect, it } from "vitest";
import type { Connection } from "partyserver";
import { createTestServer } from "../../../test/party-server-harness";

function lobbyServer(connections: Connection[] = []) {
  const { server } = createTestServer("LOBBY", { connections });
  server.state.players = [
    {
      id: "host",
      name: "Host",
      stones: 0,
      connected: true,
      isHost: true,
      role: "player",
      seat: null,
      joinedAt: 1,
    },
    {
      id: "dup",
      name: "Luke",
      stones: 0,
      connected: true,
      isHost: false,
      role: "player",
      seat: null,
      joinedAt: 2,
    },
  ];
  return server;
}

describe("host remove_player (duplicates only)", () => {
  it("drops the seat from the lobby list without banning rejoin", () => {
    const server = lobbyServer();
    server.handleRemovePlayer("host", "dup");
    expect(server.state.players.map((p) => p.id)).toEqual(["host"]);
    expect(server.state.notice).toMatch(/removed from the lobby/);

    // Same display name may join again — no membership blacklist.
    server.handleJoin("fresh", "Luke", "player");
    expect(server.state.players.some((p) => p.name === "Luke")).toBe(true);
    expect(server.state.players.find((p) => p.name === "Luke")?.id).toBe("fresh");
  });

  it("rejects remove after roster lock", () => {
    const server = lobbyServer();
    server.state.rosterLocked = true;
    expect(() => server.handleRemovePlayer("host", "dup")).toThrow(
      /already started/i,
    );
    expect(server.state.players).toHaveLength(2);
  });

  it("tells only the removed client to clear its membership", () => {
    const sent: Record<string, unknown[]> = { host: [], dup: [] };
    const connections = ["host", "dup"].map((id) => ({
      id, send: (message: string) => sent[id].push(JSON.parse(message)),
    })) as unknown as Connection[];
    const server = lobbyServer(connections);
    server.handleRemovePlayer("host", "dup");
    expect(sent.host).toEqual([]);
    expect(sent.dup).toEqual([{
      type: "error", code: "REMOVED_FROM_LOBBY",
      message: "You were removed from the lobby. Tap Join game to return.",
    }]);
    server.handleJoin("dup", "Luke", "player");
    expect(server.state.players.map((p) => p.id)).toEqual(["host", "dup"]);
  });
});
