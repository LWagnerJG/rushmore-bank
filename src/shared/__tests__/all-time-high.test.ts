import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyRoomState } from "../types";
import { projectPublicState } from "../engine/public-state";
import { RULES } from "../rules";
import { createTestServer } from "../../../test/party-server-harness";

const panel = readFileSync(
  resolve(__dirname, "../../components/ResultsPanel.tsx"),
  "utf8",
);
const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

function seatPlayers(
  rows: Array<{ id: string; name: string; stones: number; host?: boolean }>,
) {
  return rows.map((r, seat) => ({
    id: r.id,
    name: r.name,
    stones: r.stones,
    connected: true,
    isHost: Boolean(r.host),
    role: "player" as const,
    seat,
    joinedAt: 1,
  }));
}

describe("room all-time high", () => {
  it("projects ATH onto public state", () => {
    const state = emptyRoomState("ATH1");
    state.phase = "GAME_RESULTS";
    state.gameOver = true;
    state.players = seatPlayers([
      { id: "a", name: "Luke", stones: 120, host: true },
      { id: "b", name: "Sam", stones: 80 },
    ]);
    state.allTimeHigh = { score: 120, name: "Luke", at: 99 };
    state.newAllTimeHigh = true;
    const pub = projectPublicState(state, "a");
    expect(pub.allTimeHigh).toEqual({ score: 120, name: "Luke", at: 99 });
    expect(pub.newAllTimeHigh).toBe(true);
  });

  it("records a new ATH when standings beat the previous mark", () => {
    const { server } = createTestServer("ATHN");
    server.state.players = seatPlayers([
      { id: "A", name: "Luke", stones: 142, host: true },
      { id: "B", name: "Sam", stones: 90 },
    ]);
    server.state.allTimeHigh = { score: 100, name: "Sam", at: 1 };
    server.enterGameResults();
    expect(server.state.phase).toBe("GAME_RESULTS");
    expect(server.state.allTimeHigh).toEqual({
      score: 142,
      name: "Luke",
      at: expect.any(Number),
    });
    expect(server.state.newAllTimeHigh).toBe(true);
  });

  it("keeps the prior ATH when nobody beats it", () => {
    const { server } = createTestServer("ATHK");
    server.state.players = seatPlayers([
      { id: "A", name: "Luke", stones: 80, host: true },
      { id: "B", name: "Sam", stones: 70 },
    ]);
    server.state.allTimeHigh = { score: 160, name: "Sam", at: 5 };
    server.enterGameResults();
    expect(server.state.allTimeHigh).toEqual({
      score: 160,
      name: "Sam",
      at: 5,
    });
    expect(server.state.newAllTimeHigh).toBe(false);
  });

  it("preserves ATH across rematch and clears the new-record flag", async () => {
    const { server } = createTestServer("ATHR");
    server.state.phase = "GAME_RESULTS";
    server.state.gameOver = true;
    server.state.code = "ATHR";
    server.state.players = seatPlayers([
      { id: "A", name: "Luke", stones: 120, host: true },
      { id: "B", name: "Sam", stones: 80 },
    ]);
    server.state.allTimeHigh = { score: 120, name: "Luke", at: 9 };
    server.state.newAllTimeHigh = true;
    await server.handlePlayAgain("A");
    await server.handlePlayAgain("B");
    expect(server.state.phase).toBe("LOBBY");
    expect(server.state.allTimeHigh).toEqual({
      score: 120,
      name: "Luke",
      at: 9,
    });
    expect(server.state.newAllTimeHigh).toBe(false);
    expect(
      server.state.players.every((p) => p.stones === RULES.startBalance),
    ).toBe(true);
  });

  it("renders ATH + new-record cue on final standings", () => {
    expect(panel).toMatch(/endgame-ath/);
    expect(panel).toMatch(/New all-time high!/);
    expect(panel).toMatch(/All-time high:/);
    expect(panel).toMatch(/state\.allTimeHigh/);
    expect(panel).toMatch(/state\.newAllTimeHigh/);
    expect(css).toMatch(/\.endgame-ath-badge/);
    expect(css).toMatch(/var\(--coral\)/);
  });
});
