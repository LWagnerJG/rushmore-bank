/**
 * 9-player AI judging: output budget must scale, and the host AI indicator
 * must reflect the server's effective state (not a client probe).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildAnonymousRosters,
  judgeMaxOutputTokens,
  validateAndMapJudgments,
} from "../engine/judge";
import { hostAiJudgeHealth, projectPublicState } from "../engine/public-state";
import { hostAiPreGameLine } from "../host-ai-pregame";
import { RULES } from "../rules";
import { emptyRoomState } from "../types";

const pregameSrc = readFileSync(
  resolve(__dirname, "../../components/HostAiPreGameStatus.tsx"),
  "utf8",
);
const lobbySrc = readFileSync(
  resolve(__dirname, "../../components/LobbyPanel.tsx"),
  "utf8",
);
const reviewSrc = readFileSync(
  resolve(__dirname, "../../components/ReviewPanel.tsx"),
  "utf8",
);

describe("9-player AI judge + host indicator", () => {
  it("scales max output tokens so 9 rosters are not truncated at 320", () => {
    expect(judgeMaxOutputTokens(2)).toBe(320);
    expect(judgeMaxOutputTokens(4)).toBeGreaterThanOrEqual(560);
    const nine = judgeMaxOutputTokens(9);
    expect(nine).toBe(140 * 9);
    expect(nine).toBeGreaterThan(320);
    expect(nine).toBeLessThanOrEqual(2048);
    expect(judgeMaxOutputTokens(RULES.maxPlayers)).toBe(
      140 * RULES.maxPlayers,
    );
  });

  it("accepts a full 9-roster AI judgment payload", () => {
    const seatOrder = Array.from({ length: 9 }, (_, i) => `p${i + 1}`);
    const picksByPlayer = Object.fromEntries(
      seatOrder.map((id) => [id, ["a", "b", "c", "d"]]),
    );
    const rosters = buildAnonymousRosters(seatOrder, picksByPlayer);
    expect(rosters).toHaveLength(9);
    const raw = rosters.map((r, i) => ({
      anonId: r.anonId,
      topicFit: 5 + (i % 3),
      pickStrength: 10 + (i % 5),
      rosterQuality: 5 + (i % 4),
      explanation: `Solid Mount Rushmore for seat ${i + 1}.`,
    }));
    const mapped = validateAndMapJudgments(rosters, raw);
    expect(mapped).not.toBeNull();
    expect(mapped!).toHaveLength(9);
    expect(mapped!.every((s) => !s.aiFallback)).toBe(true);
  });

  it("projects AI off to the host after fallback in a 9-player room", () => {
    const state = emptyRoomState("NINE");
    state.players = Array.from({ length: 9 }, (_, i) => ({
      id: `p${i + 1}`,
      name: `P${i + 1}`,
      stones: 0,
      connected: true,
      isHost: i === 0,
      role: "player" as const,
      seat: i,
      joinedAt: i + 1,
    }));
    state.seatOrder = state.players.map((p) => p.id);
    state.rosterLocked = true;
    state.lastJudgeOutcome = "fallback";
    state.lastJudgeFallbackReason = "invalid_output";

    const forHost = projectPublicState(state, "p1", {
      judgeConfigured: true,
    });
    const forGuest = projectPublicState(state, "p2", {
      judgeConfigured: true,
    });
    expect(forHost.hostAiJudge?.status).toBe("fallback");
    expect(forHost.hostAiJudge?.available).toBe(true);
    expect(hostAiPreGameLine(forHost.hostAiJudge)).toMatch(/AI judge off/i);
    expect(forGuest.hostAiJudge).toBeUndefined();
    expect(JSON.stringify(forGuest)).not.toMatch(/hostAiJudge/);
  });

  it("does not claim AI on when the room is unconfigured", () => {
    const state = emptyRoomState("NOAI");
    state.players = [
      {
        id: "host",
        name: "Host",
        stones: 0,
        connected: true,
        isHost: true,
        role: "player",
        seat: 0,
        joinedAt: 1,
      },
    ];
    const health = hostAiJudgeHealth(state, { judgeConfigured: false });
    expect(health.available).toBe(false);
    expect(hostAiPreGameLine(health)).toMatch(/AI judge off/i);
  });

  it("uses server hostAiJudge in lobby — never a client /api/judge probe", () => {
    expect(pregameSrc).toMatch(/hostAiPreGameLine\(health\)/);
    expect(pregameSrc).not.toMatch(/fetch\s*\(\s*["']\/api\/judge/);
    expect(lobbySrc).toMatch(/HostAiPreGameStatus health=\{state\.hostAiJudge\}/);
    expect(lobbySrc).toMatch(/you\.isHost/);
    expect(reviewSrc).toMatch(/you\.isHost \? "Vote \+ AI judge/);
    expect(reviewSrc).toMatch(/Voting next/);
  });
});
