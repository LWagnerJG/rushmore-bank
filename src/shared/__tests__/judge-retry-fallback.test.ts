/**
 * PartyServer judge path: timeout → one retry → fallback → neutral.
 * Guarantees a bounded budget and no double awards.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestServer } from "../../../test/party-server-harness";
import { RULES } from "../rules";

function seedVotingRoom(server: ReturnType<typeof createTestServer>["server"]) {
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
    { playerId: "A", text: "cat", turnIndex: 0, pickIndex: 1 },
    { playerId: "A", text: "bird", turnIndex: 0, pickIndex: 2 },
    { playerId: "A", text: "fish", turnIndex: 0, pickIndex: 3 },
    { playerId: "B", text: "hamster", turnIndex: 1, pickIndex: 0 },
    { playerId: "B", text: "rabbit", turnIndex: 1, pickIndex: 1 },
    { playerId: "B", text: "turtle", turnIndex: 1, pickIndex: 2 },
    { playerId: "B", text: "ferret", turnIndex: 1, pickIndex: 3 },
  ];
  server.state.judgeStatus = "pending";
  server.state.judgeJobId = "judge-1-1";
  server.state.scores = [];
}

function okJudgmentsBody(provider: "gemini" | "groq" = "gemini") {
  return {
    fallback: false,
    model: provider === "gemini" ? "gemini-3.5-flash-lite" : "openai/gpt-oss-20b",
    provider,
    latencyMs: 120,
    judgments: [
      {
        anonId: "R1",
        topicFit: 8,
        pickStrength: 16,
        rosterQuality: 7,
        explanation: "Solid animal Mount Rushmore.",
      },
      {
        anonId: "R2",
        topicFit: 7,
        pickStrength: 14,
        rosterQuality: 6,
        explanation: "Good variety of pets.",
      },
    ],
  };
}

describe("judge timeout → retry → fallback → neutral", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("exposes a ~25s total budget with exactly one retry slot", () => {
    expect(RULES.judgeTimeoutMs).toBe(25_000);
    expect(RULES.judgeMaxAttempts).toBe(2);
  });

  it("retries once after a client-side abort, then succeeds (no double award)", async () => {
    const { server } = createTestServer("JR1");
    seedVotingRoom(server);

    let calls = 0;
    fetchMock.mockImplementation(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        calls += 1;
        if (calls === 1) {
          return new Promise((_resolve, reject) => {
            const signal = init?.signal;
            if (!signal) return;
            signal.addEventListener("abort", () => {
              const err = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            });
          });
        }
        return new Response(JSON.stringify(okJudgmentsBody("gemini")), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );

    vi.useFakeTimers();
    const pending = server.runJudgingJob("judge-1-1");
    // Drain microtasks + advance past first-attempt abort (~55% of 25s).
    for (let i = 0; i < 80; i++) {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(500);
    }
    await pending;

    expect(calls).toBe(2);
    expect(server.state.judgeStatus).toBe("ready");
    expect(server.state.lastJudgeOutcome).toBe("ok");
    expect(server.state.scores).toHaveLength(2);
    expect(server.state.scores.every((s) => !s.aiFallback)).toBe(true);
    expect(server.state.lastJudgeProvider).toBe("gemini");
    // Job id not rotated on success — proves we did not apply fallback first.
    expect(server.state.judgeJobId).toBe("judge-1-1");
  });

  it("retries a timeout fallback from /api/judge, then applies neutral once", async () => {
    const { server } = createTestServer("JR2");
    seedVotingRoom(server);

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            fallback: true,
            fallbackReason: "timeout",
            model: null,
            provider: null,
            judgments: [
              {
                anonId: "R1",
                topicFit: 5,
                pickStrength: 10,
                rosterQuality: 5,
                explanation: RULES.aiFallbackLabel,
              },
              {
                anonId: "R2",
                topicFit: 5,
                pickStrength: 10,
                rosterQuality: 5,
                explanation: RULES.aiFallbackLabel,
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            fallback: true,
            fallbackReason: "timeout",
            model: null,
            provider: null,
            judgments: [
              {
                anonId: "R1",
                topicFit: 5,
                pickStrength: 10,
                rosterQuality: 5,
                explanation: RULES.aiFallbackLabel,
              },
              {
                anonId: "R2",
                topicFit: 5,
                pickStrength: 10,
                rosterQuality: 5,
                explanation: RULES.aiFallbackLabel,
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    await server.runJudgingJob("judge-1-1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(server.state.judgeStatus).toBe("failed");
    expect(server.state.lastJudgeOutcome).toBe("fallback");
    expect(server.state.lastJudgeFallbackReason).toBe("timeout");
    expect(server.state.scores).toHaveLength(2);
    expect(server.state.scores.every((s) => s.aiFallback)).toBe(true);
    // Rotated once — late success cannot double-award.
    expect(server.state.judgeJobId).toBe("judge-1-1:fallback");
  });

  it("does not retry no_key fallback (avoids burning the budget)", async () => {
    const { server } = createTestServer("JR3");
    seedVotingRoom(server);

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          fallback: true,
          fallbackReason: "no_key",
          model: null,
          provider: null,
          judgments: [
            {
              anonId: "R1",
              topicFit: 5,
              pickStrength: 10,
              rosterQuality: 5,
              explanation: RULES.aiFallbackLabel,
            },
            {
              anonId: "R2",
              topicFit: 5,
              pickStrength: 10,
              rosterQuality: 5,
              explanation: RULES.aiFallbackLabel,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await server.runJudgingJob("judge-1-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(server.state.lastJudgeFallbackReason).toBe("no_key");
    expect(server.state.scores.every((s) => s.aiFallback)).toBe(true);
  });

  it("ignores a late success after fallback rotated the job id", async () => {
    const { server } = createTestServer("JR4");
    seedVotingRoom(server);

    let resolveFirst: ((r: Response) => void) | null = null;
    fetchMock.mockImplementation(async () => {
      if (!resolveFirst) {
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return new Response(JSON.stringify(okJudgmentsBody("groq")), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const pending = server.runJudgingJob("judge-1-1");
    // Force fallback while first fetch is in flight.
    server.applyJudgeFallback("judge-1-1", RULES.aiFallbackLabel, {
      fallbackReason: "timeout",
    });
    expect(server.state.judgeJobId).toBe("judge-1-1:fallback");
    const neutralScores = server.state.scores.map((s) => s.aiAward);

    resolveFirst!(
      new Response(JSON.stringify(okJudgmentsBody("gemini")), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await pending;

    expect(server.state.judgeStatus).toBe("failed");
    expect(server.state.scores.map((s) => s.aiAward)).toEqual(neutralScores);
  });
});
