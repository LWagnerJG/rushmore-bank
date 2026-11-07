import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RULES } from "../rules";
import { createTestServer } from "../../../test/party-server-harness";

const reviewPanel = readFileSync(
  resolve(__dirname, "../../components/ReviewPanel.tsx"),
  "utf8",
);
const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");
const rulesSrc = readFileSync(resolve(__dirname, "../rules.ts"), "utf8");

const START = 1_900_000_000_000;

function draftGame() {
  const harness = createTestServer("HOLD");
  const { server } = harness;
  server.state.players = ["A", "B"].map((id, seat) => ({
    id,
    name: id,
    seat,
    connected: true,
    isHost: seat === 0,
    role: "player" as const,
    stones: 20,
    joinedAt: START,
  }));
  server.state.seatOrder = ["A", "B"];
  server.state.rosterLocked = true;
  server.state.selectedTopic = {
    id: "t1",
    text: "Best snacks",
    scope: "everyday",
    scopeBoundary: "food",
  };
  return { server, harness };
}

describe("draft-complete hold before voting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => vi.useRealTimers());

  it("uses a 1–1.5s server hold when reviewSeconds is 0", () => {
    expect(RULES.reviewSeconds).toBe(0);
    expect(RULES.draftCompleteHoldMs).toBeGreaterThanOrEqual(1000);
    expect(RULES.draftCompleteHoldMs).toBeLessThanOrEqual(1500);
    expect(rulesSrc).toMatch(/draftCompleteHoldMs:\s*1300/);
  });

  it("enters REVIEW with a deadline after the last lock-in", async () => {
    const { server, harness } = draftGame();
    await server.beginDraft();
    // Two seats × four picks = 8 turns.
    const texts = ["a", "b", "c", "d", "e", "f", "g", "h"];
    for (let i = 0; i < texts.length; i++) {
      const turnId = server.currentDraftPlayerId();
      assert.ok(turnId);
      await server.handleLockIn(turnId, texts[i]!);
    }
    expect(server.state.phase).toBe("REVIEW");
    expect(server.state.phaseDeadlineAt).toBe(
      START + RULES.draftCompleteHoldMs,
    );
    expect(harness.deadline()).toBe(START + RULES.draftCompleteHoldMs);
  });

  it("advances to voting together when the hold alarm fires", async () => {
    const { server } = draftGame();
    await server.beginDraft();
    const texts = ["a", "b", "c", "d", "e", "f", "g", "h"];
    for (let i = 0; i < texts.length; i++) {
      const turnId = server.currentDraftPlayerId();
      assert.ok(turnId);
      await server.handleLockIn(turnId, texts[i]!);
    }
    expect(server.state.phase).toBe("REVIEW");
    vi.setSystemTime(START + RULES.draftCompleteHoldMs + 1);
    await server.onPhaseTimeout();
    expect(server.state.phase).toBe("VOTING_AND_JUDGING");
  });

  it("is idempotent if beginReview is called twice", async () => {
    const { server, harness } = draftGame();
    server.state.phase = "DRAFT";
    server.state.draftOrder = [0, 1];
    server.state.draftCursor = 2;
    await server.beginReview();
    const firstDeadline = server.state.phaseDeadlineAt;
    const firstAlarm = harness.deadline();
    await server.beginReview();
    expect(server.state.phase).toBe("REVIEW");
    expect(server.state.phaseDeadlineAt).toBe(firstDeadline);
    expect(harness.deadline()).toBe(firstAlarm);
  });

  it("does not double-start voting if skip + beginVoting both fire", async () => {
    const { server } = draftGame();
    server.state.phase = "REVIEW";
    server.state.phaseDeadlineAt = START + RULES.draftCompleteHoldMs;
    server.state.selectedTopic = {
      id: "t1",
      text: "Best snacks",
      scope: "everyday",
      scopeBoundary: "food",
    };
    server.state.seatOrder = ["A", "B"];
    server.state.picks = [];
    await server.handleSkipReview("A");
    expect(server.state.phase).toBe("VOTING_AND_JUDGING");
    const jobId = server.state.judgeJobId;
    const deadline = server.state.phaseDeadlineAt;
    // Stale REVIEW wake that somehow calls beginVoting again must no-op.
    await server.beginVoting();
    expect(server.state.phase).toBe("VOTING_AND_JUDGING");
    expect(server.state.judgeJobId).toBe(jobId);
    expect(server.state.phaseDeadlineAt).toBe(deadline);
  });

  it("still advances if the last picker disconnects during the hold", async () => {
    const { server } = draftGame();
    await server.beginDraft();
    const texts = ["a", "b", "c", "d", "e", "f", "g", "h"];
    for (let i = 0; i < texts.length; i++) {
      const turnId = server.currentDraftPlayerId();
      assert.ok(turnId);
      await server.handleLockIn(turnId, texts[i]!);
    }
    expect(server.state.phase).toBe("REVIEW");
    // Last seat drops mid-hold — phase alarm is room-owned, not client-owned.
    const last = server.state.players.find((p) => p.id === "B")!;
    last.connected = false;
    vi.setSystemTime(START + RULES.draftCompleteHoldMs + 5);
    await server.onPhaseTimeout();
    expect(server.state.phase).toBe("VOTING_AND_JUDGING");
  });

  it("shows Everyone’s in! on the short REVIEW beat", () => {
    expect(reviewPanel).toMatch(/Everyone&apos;s in!|Everyone's in!/);
    expect(reviewPanel).toMatch(/draft-all-in/);
    expect(reviewPanel).toMatch(/draftCompleteHoldMs|reviewSeconds/);
    expect(css).toMatch(/\.draft-all-in-title/);
    expect(css).toMatch(/draft-all-in-pop/);
  });
});
