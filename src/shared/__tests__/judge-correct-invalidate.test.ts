/**
 * Host correct mid-vote must invalidate an in-flight AI judge so a late
 * success cannot apply scores / finalize into SCORE_REVEAL during CORRECTION.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";

function seedVotingTwoPlayer(
  server: ReturnType<typeof createTestServer>["server"],
) {
  server.state.phase = "VOTING_AND_JUDGING";
  server.state.rosterLocked = true;
  server.state.scoresLocked = false;
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
  server.state.selectedTopic = {
    id: "t1",
    text: "Best pets",
    scope: "everyday",
    scopeBoundary: "Animals only",
  };
  server.state.picks = [
    { playerId: "A", text: "dog", turnIndex: 0, pickIndex: 0 },
    { playerId: "A", text: "cat", turnIndex: 1, pickIndex: 1 },
    { playerId: "A", text: "bird", turnIndex: 2, pickIndex: 2 },
    { playerId: "A", text: "fish", turnIndex: 3, pickIndex: 3 },
    { playerId: "B", text: "hamster", turnIndex: 4, pickIndex: 0 },
    { playerId: "B", text: "rabbit", turnIndex: 5, pickIndex: 1 },
    { playerId: "B", text: "turtle", turnIndex: 6, pickIndex: 2 },
    { playerId: "B", text: "ferret", turnIndex: 7, pickIndex: 3 },
  ];
  server.state.draftOrder = [0, 1, 0, 1, 0, 1, 0, 1];
  server.state.draftCursor = 8;
  server.state.judgeStatus = "pending";
  server.state.judgeJobId = "judge-1-1";
  server.state.scores = [];
  server.state.phaseDeadlineAt = Date.now() + 45_000;
}

const okBody = {
  fallback: false,
  model: "gemini-3.1-flash-lite-preview",
  provider: "gemini" as const,
  latencyMs: 120,
  judgments: [
    {
      anonId: "R1",
      topicFit: 8,
      pickStrength: 16,
      rosterQuality: 7,
      explanation: "Solid.",
    },
    {
      anonId: "R2",
      topicFit: 7,
      pickStrength: 14,
      rosterQuality: 6,
      explanation: "Good.",
    },
  ],
};

describe("judge × host_correct invalidate", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("rotates judgeJobId when host corrects during voting", async () => {
    const { server } = createTestServer("JC1");
    seedVotingTwoPlayer(server);
    await server.handleCorrect("A", 0, "invalid");
    assert.equal(server.state.phase, "CORRECTION");
    assert.equal(server.state.judgeJobId, "judge-1-1:corrected");
    assert.equal(server.state.judgeStatus, "idle");
    assert.equal(server.state.phaseDeadlineAt, null);
    assert.deepEqual(server.state.scores, []);
  });

  it("late judge success after host_correct does not leave CORRECTION", async () => {
    const { server } = createTestServer("JC2");
    seedVotingTwoPlayer(server);

    let release!: (value: Response) => void;
    const held = new Promise<Response>((r) => {
      release = r;
    });
    fetchMock.mockImplementation(() => held);

    const pending = server.runJudgingJob("judge-1-1");
    await Promise.resolve();
    await server.handleCorrect("A", 0, "duplicate");
    assert.equal(server.state.phase, "CORRECTION");
    assert.equal(server.state.judgeJobId, "judge-1-1:corrected");

    release(
      new Response(JSON.stringify(okBody), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await pending;

    assert.equal(server.state.phase, "CORRECTION");
    assert.notEqual(server.state.phase, "SCORE_REVEAL");
    assert.equal(server.state.scoresLocked, false);
    // Scores cleared on correct; late job must not re-apply.
    assert.equal(server.state.scores.length, 0);
  });

  it("finalizeScores is a no-op outside VOTING_AND_JUDGING", async () => {
    const { server } = createTestServer("JC3");
    seedVotingTwoPlayer(server);
    server.state.phase = "CORRECTION";
    server.state.scores = [
      {
        playerId: "A",
        topicFit: 8,
        pickStrength: 16,
        rosterQuality: 7,
        explanation: "x",
        votes: 0,
        earned: 20,
        aiFallback: false,
      },
    ];
    await server.finalizeScores();
    assert.equal(server.state.phase, "CORRECTION");
    assert.equal(server.state.scoresLocked, false);
  });
});
