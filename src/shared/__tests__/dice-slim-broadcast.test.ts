import { describe, expect, it } from "vitest";
import { emptyRoomState } from "../types";
import {
  phaseOmitsDraftJudgePayload,
  projectPublicState,
} from "../engine/public-state";
import { mergePublicState } from "../engine/merge-public-state";

function baseRoom() {
  const state = emptyRoomState("DICE");
  state.players = [
    {
      id: "a",
      name: "Ada",
      stones: 40,
      connected: true,
      isHost: true,
      role: "player",
      seat: 0,
      joinedAt: 1,
    },
    {
      id: "b",
      name: "Bea",
      stones: 30,
      connected: true,
      isHost: false,
      role: "player",
      seat: 1,
      joinedAt: 1,
    },
  ];
  state.seatOrder = ["a", "b"];
  state.selectedTopic = {
    id: "t1",
    text: "Best movies",
    scope: "entertainment",
    scopeBoundary: "movies",
  };
  state.picks = [
    { playerId: "a", text: "Heat", pickIndex: 0, turnIndex: 0 },
    { playerId: "b", text: "Joker", pickIndex: 0, turnIndex: 1 },
  ];
  state.takenNormalized = ["heat", "joker"];
  state.topicOptions = [
    {
      id: "t1",
      text: "Best movies",
      scope: "entertainment",
      scopeBoundary: "movies",
    },
    {
      id: "t2",
      text: "Best snacks",
      scope: "food",
      scopeBoundary: "snacks",
    },
  ];
  state.scoresLocked = true;
  state.scores = [
    {
      playerId: "a",
      votes: 1,
      aiAward: 5,
      topicFit: 4,
      pickStrength: 4,
      rosterQuality: 4,
      explanation: "A classic.",
      earned: 30,
      aiFallback: false,
    },
  ];
  state.earnedThisRound = { a: 30, b: 22 };
  state.wagers = { a: 10, b: 5 };
  state.pots = { a: 10, b: 5 };
  state.protectedStones = { a: 30, b: 25 };
  state.diceActiveIds = ["a", "b"];
  state.diceTurnSeat = 0;
  state.diceSubphase = "READY";
  return state;
}

describe("phase slim broadcast", () => {
  it("marks wager/dice/results as draft-judge omit phases", () => {
    expect(phaseOmitsDraftJudgePayload("DICE")).toBe(true);
    expect(phaseOmitsDraftJudgePayload("WAGER_SELECTION")).toBe(true);
    expect(phaseOmitsDraftJudgePayload("ROUND_RESULTS")).toBe(true);
    expect(phaseOmitsDraftJudgePayload("GAME_RESULTS")).toBe(true);
    expect(phaseOmitsDraftJudgePayload("VOTING_AND_JUDGING")).toBe(false);
    expect(phaseOmitsDraftJudgePayload("SCORE_REVEAL")).toBe(false);
    expect(phaseOmitsDraftJudgePayload("DRAFT")).toBe(false);
  });

  it("omits heavy draft/judge fields while phase is DICE", () => {
    const state = baseRoom();
    state.phase = "DICE";
    const pub = projectPublicState(state, "a");
    expect(pub.picks).toEqual([]);
    expect(pub.topicOptions).toEqual([]);
    expect(pub.scores).toEqual([]);
    expect(pub.rushmoreWhy).toEqual({});
    expect(pub.takenNormalized).toEqual([]);
    expect(pub.diceSubphase).toBe("READY");
    expect(pub.pots.a).toBe(10);
    expect(pub.wagers.a).toBe(10);
    expect(pub.players).toHaveLength(2);
  });

  it("omits heavy fields during WAGER and RESULTS", () => {
    for (const phase of [
      "WAGER_SELECTION",
      "ROUND_RESULTS",
      "GAME_RESULTS",
    ] as const) {
      const state = baseRoom();
      state.phase = phase;
      const pub = projectPublicState(state, "a");
      expect(pub.picks).toEqual([]);
      expect(pub.topicOptions).toEqual([]);
      expect(pub.scores).toEqual([]);
      expect(pub.rushmoreWhy).toEqual({});
    }
  });

  it("keeps picks during vote/score but drops topic cards", () => {
    const state = baseRoom();
    state.phase = "VOTING_AND_JUDGING";
    state.scoresLocked = false;
    const pub = projectPublicState(state, "a");
    expect(pub.picks).toHaveLength(2);
    expect(pub.topicOptions).toEqual([]);
    expect(pub.topicVoteCounts).toEqual({});
  });

  it("keeps topic options only during TOPIC_SELECTION", () => {
    const state = baseRoom();
    state.phase = "TOPIC_SELECTION";
    const pub = projectPublicState(state, "a");
    expect(pub.topicOptions).toHaveLength(2);
  });

  it("client merge restores omitted fields across slim-phase ticks", () => {
    const state = baseRoom();
    state.phase = "SCORE_REVEAL";
    const rich = projectPublicState(state, "a");
    expect(rich.picks).toHaveLength(2);
    expect(rich.scores).toHaveLength(1);

    state.phase = "WAGER_SELECTION";
    const slimWager = projectPublicState(state, "a");
    expect(slimWager.picks).toEqual([]);
    const afterWager = mergePublicState(rich, slimWager);
    expect(afterWager.picks).toHaveLength(2);
    expect(afterWager.scores).toHaveLength(1);
    expect(afterWager.rushmoreWhy.a).toBe("A classic.");

    state.phase = "DICE";
    const slimDice = projectPublicState(state, "a");
    const merged = mergePublicState(afterWager, slimDice);
    expect(merged.picks).toHaveLength(2);
    expect(merged.scores).toHaveLength(1);
    expect(merged.diceSubphase).toBe("READY");

    const fatWager = {
      ...slimWager,
      picks: rich.picks,
      scores: rich.scores,
      rushmoreWhy: rich.rushmoreWhy,
      takenNormalized: rich.takenNormalized,
    };
    expect(JSON.stringify(slimWager).length).toBeLessThan(
      JSON.stringify(fatWager).length,
    );
    expect(JSON.stringify(slimDice).length).toBeLessThan(
      JSON.stringify(fatWager).length,
    );
  });
});
