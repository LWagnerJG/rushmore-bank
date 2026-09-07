/**
 * Simulated multi-player dice / privacy / judging flows for N = 3, 6, 10.
 * Exercises dangerous rolls and waiting-player banks without PartyKit runtime.
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
    state.personalRollCounts[id] = 2; // next roll is dangerous
  }
  return state;
}

function bankWaiting(state: RoomState, id: string) {
  const current = state.seatOrder[state.diceTurnSeat] ?? null;
  const c = classifyPullOut({
    phase: state.phase,
    diceSubphase: state.diceSubphase,
    playerId: id,
    currentRollerId: current,
    diceActiveIds: state.diceActiveIds,
    pot: state.pots[id] ?? 0,
  });
  expect(c.ok).toBe(true);
  if (!c.ok || c.kind !== "waiting_player") throw new Error("expected waiting");
  const seatBefore = state.diceTurnSeat;
  const subBefore = state.diceSubphase;
  const alarmProxy = state.diceDecisionDeadlineAt;
  const result = bankPotIntoProtected({
    protectedStones: state.protectedStones[id] ?? 0,
    pot: state.pots[id] ?? 0,
  });
  const p = state.players.find((x) => x.id === id)!;
  p.stones = result.stonesAfter;
  state.pots[id] = 0;
  state.diceActiveIds = state.diceActiveIds.filter((x) => x !== id);
  // Waiting bank must not advance seat / clear cooldown markers
  expect(state.diceTurnSeat).toBe(seatBefore);
  expect(state.diceSubphase).toBe(subBefore);
  expect(state.diceDecisionDeadlineAt).toBe(alarmProxy);
}

function commitDangerousRoll(state: RoomState, faces: { d1: number; d2: number }) {
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
  // pots unchanged until reveal
  expect(state.pots[id]).toBe(potBefore);
  return outcome;
}

function reveal(state: RoomState) {
  const dice = state.lastDice!;
  expect(dice.revealed).toBe(false);
  state.pots[dice.rollerId] = dice.potAfter;
  dice.revealed = true;
  if (dice.busted) {
    state.diceActiveIds = state.diceActiveIds.filter((x) => x !== dice.rollerId);
    const p = state.players.find((x) => x.id === dice.rollerId)!;
    p.stones = state.protectedStones[dice.rollerId] ?? 0;
  }
  state.diceSubphase = "SETTLED";
}

describe.each([2, 3, 6, 10])("full-ish flow N=%i", (n) => {
  it("waiting banks during cooldown + dangerous roll + privacy", () => {
    const state = seedDiceRoom(n);
    state.diceSubphase = "COOLDOWN";
    state.diceDecisionDeadlineAt = Date.now() + 5000;

    // Everyone except current roller banks out while cooldown runs
    for (let i = 1; i < n; i++) {
      bankWaiting(state, `p${i}`);
    }
    expect(state.diceActiveIds).toEqual(["p0"]);
    expect(state.diceTurnSeat).toBe(0);
    expect(state.diceSubphase).toBe("COOLDOWN");

    // Unlock + dangerous seven bust
    state.diceSubphase = "READY";
    const outcome = commitDangerousRoll(state, { d1: 3, d2: 4 });
    expect(outcome.busted).toBe(true);

    // Late bank blocked for committed roller
    const late = classifyPullOut({
      phase: state.phase,
      diceSubphase: state.diceSubphase,
      playerId: "p0",
      currentRollerId: "p0",
      diceActiveIds: state.diceActiveIds,
      pot: state.pots.p0 ?? 0,
    });
    expect(late.ok).toBe(false);

    // Privacy: no faces in public snapshot mid-air
    const pub = projectPublicState(state, "p1");
    expect(publicStateLeaksBallots(pub)).toBe(false);
    expect(pub.lastDice?.d1).toBeUndefined();
    expect(pub.configuredTopicRounds).toBe(topicRoundsForPlayerCount(n));

    reveal(state);
    expect(state.pots.p0).toBe(0);
    expect(state.diceActiveIds).toEqual([]);
    const p0 = state.players.find((p) => p.id === "p0")!;
    expect(p0.stones).toBe(20); // protected only after bust

    // Banked waiters kept protected+pot
    for (let i = 1; i < n; i++) {
      expect(state.players[i]!.stones).toBe(70);
    }
  });

  it("vote/judge privacy + reject bad client scores path", () => {
    const state = seedDiceRoom(n);
    state.phase = "VOTING_AND_JUDGING";
    state.humanVotes = { p0: "p1" };
    state.topicVotes = { p0: "t1", p1: "t1" };
    const viewerId = n >= 3 ? "p2" : "p1";
    const pub = projectPublicState(state, viewerId);
    expect(pub.humanVotesCast).toBe(1);
    expect(pub.myHumanVote).toBeNull();
    expect(JSON.stringify(pub)).not.toContain('"p0":"p1"');

    const rosters = buildAnonymousRosters(
      state.seatOrder,
      Object.fromEntries(state.seatOrder.map((id) => [id, ["a", "b", "c", "d"]])),
    );
    // Fabricated partial client scores must fail validation
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

    const neutral = applyVoteCounts(neutralJudgments(rosters), state.humanVotes);
    expect(neutral.every((s) => s.aiAward === 20)).toBe(true);
    expect(neutral.find((s) => s.playerId === "p1")!.votes).toBe(1);
  });
});
