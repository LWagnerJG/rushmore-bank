/**
 * Simulated multi-player dice / privacy / judging flows for N = 3, 6, 10.
 * Personal BANK: continuous turn until Bank/bust; waiting players watch.
 */
import { describe, expect, it } from "vitest";
import {
  applyDiceRoll,
  bankPotIntoProtected,
  classifyPullOut,
  projectPublicState,
  publicStateLeaksBallots,
  validateAndMapJudgments,
  buildAnonymousRosters,
  neutralJudgments,
  applyVoteCounts,
} from "../engine";
import { emptyRoomState, type RoomState, type Player } from "../types";
import { topicRoundsForPlayerCount } from "../rules";

function makePlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    stones: 0,
    connected: true,
    isHost: i === 0,
    role: "player" as const,
    seat: i,
    joinedAt: 1,
  }));
}

function seedDiceRoom(n: number): RoomState {
  const state = emptyRoomState("TEST");
  state.players = makePlayers(n);
  state.seatOrder = state.players.map((p) => p.id);
  state.rosterLocked = true;
  state.configuredTopicRounds = topicRoundsForPlayerCount(n);
  state.phase = "DICE";
  state.diceSubphase = "READY";
  state.diceTurnSeat = 0;
  state.diceActiveIds = [...state.seatOrder];
  state.diceRoundStartedAt = Date.now();
  for (const id of state.seatOrder) {
    state.pots[id] = 50;
    state.protectedStones[id] = 20;
    state.personalRollCounts[id] = 0;
  }
  return state;
}

function bankCurrent(state: RoomState) {
  const id = state.seatOrder[state.diceTurnSeat]!;
  const c = classifyPullOut({
    phase: state.phase,
    diceSubphase: state.diceSubphase,
    playerId: id,
    currentRollerId: id,
    diceActiveIds: state.diceActiveIds,
    pot: state.pots[id] ?? 0,
  });
  expect(c.ok).toBe(true);
  const result = bankPotIntoProtected({
    protectedStones: state.protectedStones[id] ?? 0,
    pot: state.pots[id] ?? 0,
  });
  const p = state.players.find((x) => x.id === id)!;
  p.stones = result.stonesAfter;
  state.pots[id] = 0;
  state.diceActiveIds = state.diceActiveIds.filter((x) => x !== id);
  // Advance seat after bank
  state.diceTurnSeat = (state.diceTurnSeat + 1) % state.seatOrder.length;
}

function commitDangerousRoll(
  state: RoomState,
  faces: { d1: number; d2: number },
) {
  const id = state.seatOrder[state.diceTurnSeat]!;
  expect(state.diceSubphase).toBe("READY");
  state.diceSubphase = "COMMITTED";
  const rollNum = (state.personalRollCounts[id] ?? 0) + 1;
  state.personalRollCounts[id] = rollNum;
  const potBefore = state.pots[id] ?? 0;
  const outcome = applyDiceRoll(potBefore, faces, rollNum);
  state.lastDice = {
    rollId: `r-${id}-${rollNum}`,
    rollerId: id,
    d1: faces.d1,
    d2: faces.d2,
    personalRollNumber: rollNum,
    potBefore,
    potAfter: outcome.potAfter,
    busted: outcome.busted,
    note: outcome.note,
    animStartedAt: Date.now(),
    animSettleAt: Date.now() + 2200,
    animSeed: 99,
    outcomeKind: outcome.kind,
    revealed: false,
  };
  expect(state.pots[id]).toBe(potBefore);
  return outcome;
}

function reveal(state: RoomState) {
  const dice = state.lastDice!;
  expect(dice.revealed).toBe(false);
  state.pots[dice.rollerId] = dice.potAfter;
  dice.revealed = true;
  if (dice.busted) {
    state.diceActiveIds = state.diceActiveIds.filter(
      (x) => x !== dice.rollerId,
    );
    const p = state.players.find((x) => x.id === dice.rollerId)!;
    p.stones = state.protectedStones[dice.rollerId] ?? 0;
  }
  state.diceSubphase = "SETTLED";
}

describe.each([2, 3, 6, 10])("full-ish flow N=%i", (n) => {
  it("personal bank + dangerous bust + privacy", () => {
    const state = seedDiceRoom(n);
    state.diceSubphase = "READY";

    // Waiting players cannot bank early
    if (n > 1) {
      const blocked = classifyPullOut({
        phase: state.phase,
        diceSubphase: state.diceSubphase,
        playerId: "p1",
        currentRollerId: "p0",
        diceActiveIds: state.diceActiveIds,
        pot: state.pots.p1 ?? 0,
      });
      expect(blocked.ok).toBe(false);
    }

    // Current roller banks → seat advances (protected 20 + pot 50)
    bankCurrent(state);
    expect(state.diceActiveIds).not.toContain("p0");
    expect(state.players[0]!.stones).toBe(70);
    expect(state.diceTurnSeat).toBe(1 % n);

    // Next player (or only remaining) seven bust on their first roll
    // Skip ahead if needed so a still-active player is up
    let guard = 0;
    while (
      guard++ < 20 &&
      !state.diceActiveIds.includes(state.seatOrder[state.diceTurnSeat]!)
    ) {
      state.diceTurnSeat = (state.diceTurnSeat + 1) % n;
    }
    const roller = state.seatOrder[state.diceTurnSeat]!;
    state.diceSubphase = "READY";
    const outcome = commitDangerousRoll(state, { d1: 3, d2: 4 });
    expect(outcome.busted).toBe(true);

    const late = classifyPullOut({
      phase: state.phase,
      diceSubphase: state.diceSubphase,
      playerId: roller,
      currentRollerId: roller,
      diceActiveIds: state.diceActiveIds,
      pot: state.pots[roller] ?? 0,
    });
    expect(late.ok).toBe(false);

    const watcher = state.seatOrder.find((id) => id !== roller) ?? roller;
    const pub = projectPublicState(state, watcher);
    expect(publicStateLeaksBallots(pub)).toBe(false);
    expect(pub.lastDice?.d1).toBeUndefined();
    expect(pub.configuredTopicRounds).toBe(topicRoundsForPlayerCount(n));

    reveal(state);
    expect(state.pots[roller]).toBe(0);
    expect(state.diceActiveIds).not.toContain(roller);
    const rolled = state.players.find((p) => p.id === roller)!;
    expect(rolled.stones).toBe(20);
  });

  it("vote/judge privacy + reject bad client scores path", () => {
    const state = seedDiceRoom(n);
    state.phase = "VOTING_AND_JUDGING";
    state.humanVotes = { p0: "p1" };
    state.topicVotes = { p0: "t1", p1: "t1" };
    const pub = projectPublicState(state, "p2");
    expect(pub.humanVotesCast).toBe(1);
    expect(pub.myHumanVote).toBeNull();
    expect(JSON.stringify(pub)).not.toContain('"p0":"p1"');

    const rosters = buildAnonymousRosters(
      state.seatOrder,
      Object.fromEntries(
        state.seatOrder.map((id) => [id, ["a", "b", "c", "d"]]),
      ),
    );
    expect(
      validateAndMapJudgments(rosters, [
        {
          anonId: "R1",
          topicFit: 40,
          pickStrength: 40,
          rosterQuality: 40,
          explanation: "cheat",
        },
      ]),
    ).toBeNull();

    const neutral = applyVoteCounts(
      neutralJudgments(rosters),
      state.humanVotes,
    );
    expect(neutral.every((s) => s.aiAward === 20)).toBe(true);
    expect(neutral.find((s) => s.playerId === "p1")!.votes).toBe(1);
  });
});
