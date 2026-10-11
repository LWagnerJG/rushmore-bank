import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach, vi, expect } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";

const lobby = readFileSync(
  resolve(__dirname, "../../components/LobbyPanel.tsx"),
  "utf8",
);
const room = readFileSync(
  resolve(__dirname, "../../components/RoomClient.tsx"),
  "utf8",
);
const hook = readFileSync(
  resolve(__dirname, "../../hooks/useGameRoom.ts"),
  "utf8",
);
const types = readFileSync(resolve(__dirname, "../types.ts"), "utf8");
const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

const START = 1_910_000_000_000;

function lobbyTwo() {
  const { server } = createTestServer("RN1");
  server.state.phase = "LOBBY";
  server.state.rosterLocked = false;
  server.state.players = [
    {
      id: "A",
      name: "Luke",
      seat: null,
      connected: true,
      isHost: true,
      role: "player",
      stones: 0,
      joinedAt: START,
    },
    {
      id: "B",
      name: "Sam",
      seat: null,
      connected: true,
      isHost: false,
      role: "player",
      stones: 0,
      joinedAt: START,
    },
  ];
  return { server };
}

describe("lobby rename UI", () => {
  it("wires rename through RoomClient → LobbyPanel with a 44px tap target", () => {
    expect(types).toMatch(/type:\s*"rename"/);
    expect(hook).toMatch(/const rename = useCallback/);
    expect(hook).toMatch(/type: "rename"/);
    expect(hook).toMatch(/rememberDisplayName\(clean\)/);
    expect(hook).toMatch(/rememberRoomSession/);
    expect(room).toMatch(/rename=\{rename\}/);
    expect(lobby).toMatch(/LobbyOwnName/);
    expect(lobby).toMatch(/lobby-rename-btn/);
    expect(lobby).toMatch(/lobby-rename-pencil/);
    expect(lobby).toMatch(/onBlur/);
    expect(lobby).toMatch(/Enter/);
    expect(css).toMatch(/\.lobby-rename-btn/);
    expect(css).toMatch(/min-height:\s*var\(--tap-min\)/);
  });

  it("does not add a separate Rename CTA in the lobby chrome", () => {
    expect(lobby).not.toMatch(/>Rename</);
    expect(lobby).not.toMatch(/Change name/);
  });
});

describe("lobby rename server", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renames in lobby, keeps id/host, rejects empty and duplicates", () => {
    const { server } = lobbyTwo();
    server.handleRename("A", "  Brynna  ");
    assert.equal(server.state.players.find((p) => p.id === "A")?.name, "Brynna");
    assert.equal(server.state.players.find((p) => p.id === "A")?.isHost, true);

    assert.throws(() => server.handleRename("B", "Brynna"), /Name taken/);
    assert.throws(() => server.handleRename("B", "   "), /Enter a nickname/);
    assert.throws(() => server.handleRename("B", ""), /Enter a nickname/);

    // Same name (case-insensitive self) is ok when it is already yours
    server.handleRename("A", "brynna");
    assert.equal(server.state.players.find((p) => p.id === "A")?.name, "brynna");

    // Max length 18
    server.handleRename("B", "abcdefghijklmnopqrstuvwxyz");
    assert.equal(
      server.state.players.find((p) => p.id === "B")?.name,
      "abcdefghijklmnopqr",
    );
  });

  it("locks renaming once the game has started", () => {
    const { server } = lobbyTwo();
    server.state.rosterLocked = true;
    server.state.phase = "TOPIC_SELECTION";
    assert.throws(
      () => server.handleRename("A", "NewName"),
      /Can't rename after the game starts/,
    );
    assert.equal(server.state.players.find((p) => p.id === "A")?.name, "Luke");
  });

  it("allows rename again on the rematch lobby", () => {
    const { server } = lobbyTwo();
    server.state.rosterLocked = true;
    server.state.phase = "GAME_RESULTS";
    server.state.rosterLocked = false;
    server.state.phase = "LOBBY";
    server.handleRename("B", "Ava");
    assert.equal(server.state.players.find((p) => p.id === "B")?.name, "Ava");
  });
});
