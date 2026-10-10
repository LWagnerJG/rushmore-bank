import { describe, expect, it } from "vitest";
import { emptyRoomState } from "../types";
import { projectPublicState } from "../engine/public-state";
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
  state.selectedTopic = { id: "t1", text: "Best movies", scope: "entertainment" };
  state.picks = [
    { id: "p1", playerId: "a", text: "Heat", turnIndex: 0 },
    { id: "p2", playerId: "b", text: "Joker", turnIndex: 1 },
  ];
  state.takenNormalized = ["heat", "joker"];
  state.topicOptions = [
    { id: "t1", text: "Best movies", scope: "entertainment" },
    { id: "t2", text: "Best snacks", scope: "food" },
  ];
  state.scoresLocked = true;
  state.scores = [
    {
      playerId: "a",
      text: "Heat",
      base: 20,
      ai: 5,
      votes: 1,
      earned: 30,
      explanation: "A classic.",
    },
  ];
  state.rushmoreWhy = { a: "A classic." };
  state.earnedThisRound = { a: 30, b: 22 };
  state.wagers = { a: 10, b: 5 };
  state.pots = { a: 10, b: 5 };
  state.protectedStones = { a: 30, b: 25 };
  state.diceActiveIds = ["a", "b"];
  state.diceTurnSeat = 0;
  state.diceSubphase = "READY";
  return state;
}

describe("dice slim broadcast", () => {
  it("omits heavy draft/judge fields while phase is DICE", () => {
    const state = baseRoom();
    state.phase = "DICE";
    const pub = projectPublicState(state, "a");
    expect(pub.picks).toEqual([]);
    expect(pub.topicOptions).toEqual([]);
    expect(pub.scores).toEqual([]);
    expect(pub.rushmoreWhy).toEqual({});
    expect(pub.takenNormalized).toEqual([]);
    // Dice fields still present.
    expect(pub.diceSubphase).toBe("READY");
    expect(pub.pots.a).toBe(10);
    expect(pub.wagers.a).toBe(10);
    expect(pub.players).toHaveLength(2);
  });

  it("keeps full picks outside DICE", () => {
    const state = baseRoom();
    state.phase = "WAGER_SELECTION";
    const pub = projectPublicState(state, "a");
    expect(pub.picks).toHaveLength(2);
    expect(pub.topicOptions).toHaveLength(2);
  });

  it("client merge restores omitted fields across dice ticks", () => {
    const state = baseRoom();
    state.phase = "WAGER_SELECTION";
    const rich = projectPublicState(state, "a");
    state.phase = "DICE";
    const slim = projectPublicState(state, "a");
    expect(slim.picks).toEqual([]);
    const merged = mergePublicState(rich, slim);
    expect(merged.picks).toHaveLength(2);
    expect(merged.rushmoreWhy.a).toBe("A classic.");
    expect(merged.topicOptions).toHaveLength(2);
    expect(merged.diceSubphase).toBe("READY");
    // Slim dice tick omits the heavy arrays that dominate WS bytes.
    const fatDice = {
      ...slim,
      picks: rich.picks,
      topicOptions: rich.topicOptions,
      scores: rich.scores,
      rushmoreWhy: rich.rushmoreWhy,
      takenNormalized: rich.takenNormalized,
    };
    expect(JSON.stringify(slim).length).toBeLessThan(
      JSON.stringify(fatDice).length,
    );
  });
});
