import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  SHARE_CARD_H,
  SHARE_CARD_W,
  shareEndCard,
} from "@/lib/share-end-card";
import { emptyRoomState } from "../types";
import { projectPublicState } from "../engine/public-state";
import { createTestServer } from "../../../test/party-server-harness";

const panel = readFileSync(
  resolve(__dirname, "../../components/ResultsPanel.tsx"),
  "utf8",
);
const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);
const lib = readFileSync(
  resolve(__dirname, "../../lib/share-end-card.ts"),
  "utf8",
);

describe("shareable end card", () => {
  it("renders a quiet Share next to Rematch after reveal", () => {
    expect(panel).toMatch(/endgame-share-btn/);
    expect(panel).toMatch(/endgame-cta-row/);
    expect(panel).toMatch(/shareGameEndCard/);
    expect(panel).toMatch(/Rematch/);
    // Share only after revealDone on final standings.
    const gate = panel.indexOf('revealDone && final && you.role === "player"');
    const share = panel.indexOf("endgame-share-btn");
    expect(gate).toBeGreaterThan(-1);
    expect(share).toBeGreaterThan(gate);
    expect(css).toMatch(/\.endgame-share-btn/);
    expect(css).toMatch(/\.endgame-cta-row/);
    const shareCss =
      css.match(/\.endgame-share-btn\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(shareCss).not.toMatch(/blur\s*\(/);
    expect(shareCss).toMatch(/transform/);
  });

  it("builds a 1080×1350 portrait via canvas without heavy libs", () => {
    expect(SHARE_CARD_W).toBe(1080);
    expect(SHARE_CARD_H).toBe(1350);
    expect(lib).toMatch(/createElement\("canvas"\)/);
    expect(lib).toMatch(/navigator\.share/);
    expect(lib).toMatch(/files/);
    expect(lib).toMatch(/download/);
    expect(lib).toMatch(/Your Mount Rushmore of anything|RULES\.tagline/);
    expect(lib).toMatch(/beanAvatarSrc/);
    expect(lib).not.toMatch(/html-to-image|dom-to-image|html2canvas|canvas-confetti/i);
  });

  it("shares files when canShare allows, else downloads", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const share = vi.fn(async () => undefined);
    const download = vi.fn();
    const shared = await shareEndCard({
      blob,
      share,
      canShare: () => true,
      download,
    });
    expect(shared).toBe("shared");
    expect(share).toHaveBeenCalledOnce();
    expect(download).not.toHaveBeenCalled();

    const downloaded = await shareEndCard({
      blob,
      share: undefined,
      download,
    });
    expect(downloaded).toBe("downloaded");
    expect(download).toHaveBeenCalledOnce();
  });

  it("treats share cancel as cancelled (no download)", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const download = vi.fn();
    const result = await shareEndCard({
      blob,
      canShare: () => true,
      share: async () => {
        const err = new Error("cancelled");
        err.name = "AbortError";
        throw err;
      },
      download,
    });
    expect(result).toBe("cancelled");
    expect(download).not.toHaveBeenCalled();
  });

  it("archives round recaps and projects them on public state", async () => {
    const { server } = createTestServer("SHAR");
    server.state.players = [
      {
        id: "A",
        name: "Ada",
        stones: 40,
        connected: true,
        isHost: true,
        role: "player",
        seat: 0,
        joinedAt: 1,
        avatarId: "star",
      },
      {
        id: "B",
        name: "Bea",
        stones: 20,
        connected: true,
        isHost: false,
        role: "player",
        seat: 1,
        joinedAt: 1,
        avatarId: "beanie",
      },
    ];
    server.state.seatOrder = ["A", "B"];
    server.state.selectedTopic = {
      id: "greatest-nba-players",
      text: "Greatest NBA players of all time",
      scope: "sports",
      scopeBoundary: "Pros only",
    };
    server.state.picks = [
      { playerId: "A", text: "Jordan", pickIndex: 0, turnIndex: 0 },
      { playerId: "A", text: "LeBron", pickIndex: 1, turnIndex: 1 },
      { playerId: "A", text: "Kareem", pickIndex: 2, turnIndex: 2 },
      { playerId: "A", text: "Magic", pickIndex: 3, turnIndex: 3 },
      { playerId: "B", text: "Bird", pickIndex: 0, turnIndex: 4 },
      { playerId: "B", text: "Duncan", pickIndex: 1, turnIndex: 5 },
      { playerId: "B", text: "Kobe", pickIndex: 2, turnIndex: 6 },
      { playerId: "B", text: "Shaq", pickIndex: 3, turnIndex: 7 },
    ];
    server.state.phase = "DICE";
    await server.beginRoundResults();
    expect(server.state.roundRecaps).toHaveLength(1);
    expect(server.state.roundRecaps[0]?.topicText).toMatch(/NBA/);
    expect(server.state.roundRecaps[0]?.rosters[0]?.picks).toEqual([
      "Jordan",
      "LeBron",
      "Kareem",
      "Magic",
    ]);

    const pub = projectPublicState(server.state, "A");
    expect(pub.roundRecaps).toHaveLength(1);
    expect(pub.roundRecaps[0]?.rosters[1]?.playerName).toBe("Bea");
  });

  it("migrates rooms missing roundRecaps", () => {
    const state = emptyRoomState("OLD");
    // simulate projection with empty archive
    const pub = projectPublicState(state, "x");
    expect(pub.roundRecaps).toEqual([]);
  });
});
