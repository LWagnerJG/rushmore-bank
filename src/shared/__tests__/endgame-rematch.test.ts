import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyRoomState } from "../types";
import { projectPublicState } from "../engine/public-state";
import { RULES } from "../rules";
import { createTestServer } from "../../../test/party-server-harness";

const panel = readFileSync(
  resolve(__dirname, "../../components/ResultsPanel.tsx"),
  "utf8",
);
const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);

describe("endgame winner + rematch", () => {
  it("projects rematch ready counts without leaking maps", () => {
    const state = emptyRoomState("END");
    state.phase = "GAME_RESULTS";
    state.gameOver = true;
    state.players = [
      {
        id: "a",
        name: "Ada",
        stones: 90,
        connected: true,
        isHost: true,
        role: "player",
        seat: 0,
        joinedAt: 1,
      },
      {
        id: "b",
        name: "Bea",
        stones: 40,
        connected: true,
        isHost: false,
        role: "player",
        seat: 1,
        joinedAt: 1,
      },
    ];
    state.rematchReady = { a: true };
    const pub = projectPublicState(state, "a");
    expect(pub.rematchReadyCast).toBe(1);
    expect(pub.rematchReadyNeeded).toBe(2);
    expect(pub.rematchReadyIds).toEqual(["a"]);
    expect(pub.myRematchReady).toBe(true);
    expect(JSON.stringify(pub)).not.toMatch(/"rematchReady":\{/);
  });

  it("resets same room/players when everyone taps rematch", async () => {
    const { server } = createTestServer("ABCD");
    server.state.phase = "GAME_RESULTS";
    server.state.gameOver = true;
    server.state.code = "ABCD";
    server.state.players = [
      {
        id: "A",
        name: "Ada",
        stones: 80,
        connected: true,
        isHost: true,
        role: "player",
        seat: 0,
        joinedAt: 1,
      },
      {
        id: "B",
        name: "Bea",
        stones: 50,
        connected: true,
        isHost: false,
        role: "player",
        seat: 1,
        joinedAt: 1,
      },
    ];
    await server.handlePlayAgain("A");
    expect(server.state.phase).toBe("GAME_RESULTS");
    expect(server.state.rematchReady.A).toBe(true);
    await server.handlePlayAgain("B");
    expect(server.state.phase).toBe("LOBBY");
    expect(server.state.code).toBe("ABCD");
    expect(server.state.players.map((p) => p.id).sort()).toEqual(["A", "B"]);
    expect(
      server.state.players.every((p) => p.stones === RULES.startBalance),
    ).toBe(true);
    expect(server.state.gameOver).toBe(false);
  });

  it("shows winner sweep + big Rematch with X ready (no confetti)", () => {
    expect(panel).toMatch(/endgame-winner/);
    expect(panel).toMatch(/endgame-winner-sweep/);
    expect(panel).toMatch(/Rematch/);
    expect(panel).toMatch(/rematchReadyCast/);
    expect(panel).toMatch(/play_again/);
    expect(panel).not.toMatch(/confetti|canvas-confetti|particle/i);
    expect(css).toMatch(/@keyframes\s+endgame-green-sweep/);
    const sweep =
      css.match(/@keyframes\s+endgame-green-sweep\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(sweep).toMatch(/transform:\s*translateX/);
    expect(sweep).toMatch(/opacity/);
    expect(sweep).not.toMatch(/filter|blur/);
    expect(css).toMatch(/animation:\s*endgame-green-sweep\s+280ms/);
  });
});
