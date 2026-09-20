import { describe, expect, it } from "vitest";
import type * as Party from "partykit/server";
import QuarryServer from "../../../party/server";

function lobbyServer() {
  const room = {
    id: "LOBBY",
    storage: {
      async get() {
        return undefined;
      },
      async put() {},
      async delete() {
        return true;
      },
      async getAlarm() {
        return null;
      },
      async setAlarm() {},
      async deleteAlarm() {},
    },
    getConnections: () => [],
  } as unknown as Party.Room;
  const server = new QuarryServer(room);
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
});
