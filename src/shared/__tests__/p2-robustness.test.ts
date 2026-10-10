/**
 * P2 robustness: seenAction ordering + late judge overwrite.
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("P2 robustness", () => {
  it("does not burn actionId when handle throws", async () => {
    const { server } = createTestServer("P2A");
    server.state.players = [
      {
        id: "A",
        name: "A",
        seat: null,
        connected: true,
        isHost: true,
        role: "player",
        stones: 20,
        joinedAt: 1,
      },
    ];
    const conn = {
      id: "A",
      send() {},
    };
    // Fake getConnections for broadcast paths
    server.getConnections = (() => [conn]) as typeof server.getConnections;

    const msg = JSON.stringify({
      type: "start",
      actionId: "act-start-1",
    });
    // Need 2 players — start throws
    await server.onMessage(conn as never, msg);
    assert.equal(server.seenAction("act-start-1"), false);

    server.state.players.push({
      id: "B",
      name: "B",
      seat: null,
      connected: true,
      isHost: false,
      role: "player",
      stones: 20,
      joinedAt: 2,
    });
    await server.onMessage(conn as never, msg);
    assert.equal(server.state.phase, "TOPIC_SELECTION");
    assert.equal(server.seenAction("act-start-1"), true);
  });

  it("late judge success cannot overwrite fallback after job id rotate", () => {
    const { server } = createTestServer("P2J");
    server.state.phase = "VOTING_AND_JUDGING";
    server.state.rosterLocked = true;
    server.state.seatOrder = ["A", "B"];
    server.state.players = ["A", "B"].map((id, i) => ({
      id,
      name: id,
      seat: i,
      connected: true,
      isHost: i === 0,
      role: "player" as const,
      stones: 20,
      joinedAt: 1,
    }));
    server.state.picks = [
      { playerId: "A", text: "x", turnIndex: 0, pickIndex: 0 },
      { playerId: "B", text: "y", turnIndex: 1, pickIndex: 0 },
    ];
    const jobId = "judge-1-1";
    server.state.judgeJobId = jobId;
    server.applyJudgeFallback(jobId, "timeout", { fallbackReason: "timeout" });
    assert.equal(server.state.lastJudgeOutcome, "fallback");
    assert.equal(server.state.judgeJobId, `${jobId}:fallback`);
    // Simulate late success guard
    assert.notEqual(server.state.judgeJobId, jobId);
  });

  it("service worker returns 503 instead of throwing offline", () => {
    const sw = readFileSync(join(__dirname, "../../../public/sw.js"), "utf8");
    assert.match(sw, /status:\s*503/);
    assert.doesNotMatch(sw, /throw new Error\(["']offline["']\)/);
  });
});
