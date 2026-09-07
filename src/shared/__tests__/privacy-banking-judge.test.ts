import { describe, expect, it } from "vitest";
import {
  applyDiceRoll,
  ALL_FACE_PAIRS,
} from "../engine/dice";
import {
  bankPotIntoProtected,
  classifyPullOut,
} from "../engine/banking";
import {
  animProgress,
  tumblePose,
} from "../engine/dice-sync";
import {
  applyVoteCounts,
  buildAnonymousRosters,
  heuristicJudgeUniform,
  judgeRequestPayload,
  neutralJudgments,
  validateAndMapJudgments,
} from "../engine/judge";
import {
  projectPublicState,
  publicStateLeaksBallots,
} from "../engine/public-state";
import { emptyRoomState } from "../types";
import {
  RULES,
  topicRoundsForPlayerCount,
  topicShortlistCount,
} from "../rules";

describe("pull out classification (waiting vs current)", () => {
  const base = {
    phase: "DICE",
    diceActiveIds: ["a", "b", "c"],
    pot: 40,
  };

  it("allows waiting player during another COOLDOWN", () => {
    const r = classifyPullOut({
      ...base,
      diceSubphase: "COOLDOWN",
      playerId: "b",
      currentRollerId: "a",
    });
    expect(r).toEqual({ ok: true, kind: "waiting_player" });
  });

  it("allows waiting player while another rolls (COMMITTED)", () => {
    const r = classifyPullOut({
      ...base,
      diceSubphase: "COMMITTED",
      playerId: "c",
      currentRollerId: "a",
    });
    expect(r).toEqual({ ok: true, kind: "waiting_player" });
  });

  it("allows current roller during READY and COOLDOWN", () => {
    expect(
      classifyPullOut({
        ...base,
        diceSubphase: "READY",
        playerId: "a",
        currentRollerId: "a",
      }).ok,
    ).toBe(true);
    expect(
      classifyPullOut({
        ...base,
        diceSubphase: "COOLDOWN",
        playerId: "a",
        currentRollerId: "a",
      }),
    ).toMatchObject({ ok: true, kind: "current_roller" });
  });

  it("blocks current roller after own roll is committed", () => {
    const r = classifyPullOut({
      ...base,
      diceSubphase: "COMMITTED",
      playerId: "a",
      currentRollerId: "a",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/committed/i);
  });

  it("rejects inactive; allows zero pot sit-out", () => {
    expect(
      classifyPullOut({
        ...base,
        diceSubphase: "READY",
        playerId: "z",
        currentRollerId: "a",
        diceActiveIds: ["a"],
      }).ok,
    ).toBe(false);
    expect(
      classifyPullOut({
        ...base,
        diceSubphase: "READY",
        playerId: "b",
        currentRollerId: "a",
        pot: 0,
      }).ok,
    ).toBe(true);
  });
});

describe("banking math + 469 worked example", () => {
  it("protected 95 + pot 374 banks to 469 total Stones (not next pot)", () => {
    let pot = 105;
    pot = applyDiceRoll(pot, { d1: 3, d2: 4 }, 1).potAfter; // 175
    pot = applyDiceRoll(pot, { d1: 6, d2: 6 }, 2).potAfter; // 187
    pot = applyDiceRoll(pot, { d1: 2, d2: 2 }, 3).potAfter; // 374
    expect(pot).toBe(374);
    const banked = bankPotIntoProtected({ protectedStones: 95, pot });
    expect(banked.stonesAfter).toBe(469);
    expect(banked.potBanked).toBe(374);
  });

  it("duplicate bank credits once conceptually (pot cleared)", () => {
    const first = bankPotIntoProtected({ protectedStones: 10, pot: 50 });
    const second = bankPotIntoProtected({
      protectedStones: first.stonesAfter,
      pot: 0,
    });
    expect(first.stonesAfter).toBe(60);
    expect(second.stonesAfter).toBe(60);
    expect(second.potBanked).toBe(0);
  });
});

describe("ballot privacy projection", () => {
  it("never exposes voter→choice maps or judgeJobId", () => {
    const state = emptyRoomState("ABCD");
    state.phase = "VOTING_AND_JUDGING";
    state.seatOrder = ["p1", "p2", "p3"];
    state.players = [
      {
        id: "p1",
        name: "Luke",
        stones: 0,
        connected: true,
        isHost: true,
        role: "player",
        seat: 0,
        joinedAt: 1,
      },
      {
        id: "p2",
        name: "Brynna",
        stones: 0,
        connected: true,
        isHost: false,
        role: "player",
        seat: 1,
        joinedAt: 1,
      },
      {
        id: "p3",
        name: "Friend",
        stones: 0,
        connected: true,
        isHost: false,
        role: "player",
        seat: 2,
        joinedAt: 1,
      },
    ];
    state.topicVotes = { p1: "t1", p2: "t2", p3: "t1" };
    state.humanVotes = { p1: "p2", p2: "p3" };
    state.topicOptions = [
      {
        id: "t1",
        text: "A",
        scope: "everyday",
        scopeBoundary: "x",
      },
      {
        id: "t2",
        text: "B",
        scope: "food",
        scopeBoundary: "y",
      },
    ];
    state.judgeJobId = "secret-job";
    state.processedActionIds = ["a1", "a2"];

    const forP1 = projectPublicState(state, "p1");
    const forSpectator = projectPublicState(state, "spectator-x");

    expect(publicStateLeaksBallots(forP1)).toBe(false);
    expect(publicStateLeaksBallots(forSpectator)).toBe(false);
    expect(forP1.myHumanVote).toBe("p2");
    expect(forP1.humanVotesCast).toBe(2);
    expect(forP1.topicVoteCounts.t1).toBe(2);
    expect(forSpectator.myHumanVote).toBeNull();
    expect(JSON.stringify(forP1)).not.toContain("secret-job");
    expect(JSON.stringify(forP1)).not.toMatch(/"topicVotes"/);
    expect(JSON.stringify(forP1)).not.toMatch(/"humanVotes"/);
  });

  it("hides dice faces until settle / reveal", () => {
    const state = emptyRoomState("ABCD");
    state.phase = "DICE";
    state.diceSubphase = "COMMITTED";
    state.lastDice = {
      rollId: "roll-1",
      rollerId: "p1",
      d1: 6,
      d2: 6,
      personalRollNumber: 3,
      potBefore: 100,
      potAfter: 200,
      busted: false,
      note: "Doubled!",
      animStartedAt: Date.now() - 100,
      animSettleAt: Date.now() + 5000,
      animSeed: 42,
      outcomeKind: "danger_doubles",
      revealed: false,
    };
    const pub = projectPublicState(state, "p2", Date.now());
    expect(pub.lastDice?.revealed).toBe(false);
    expect(pub.lastDice?.d1).toBeUndefined();
    expect(pub.lastDice?.note).toBeUndefined();
    expect(pub.lastDice?.potAfter).toBeUndefined();
  });
});

describe("server-authoritative judging helpers", () => {
  const rosters = buildAnonymousRosters(["a", "b", "c"], {
    a: ["One", "Two", "Three", "Four"],
    b: ["A", "B", "C", "D"],
    c: ["W", "X", "Y", "Z"],
  });

  it("judge payload has no names/votes/balances", () => {
    const payload = judgeRequestPayload("Best pets", "Animals only", rosters);
    const raw = JSON.stringify(payload);
    expect(raw).not.toMatch(/Luke|Brynna|host|stones|votes/i);
    expect(payload.rosters.every((r) => "anonId" in r)).toBe(true);
    expect(payload.rosters[0]).not.toHaveProperty("playerId");
  });

  it("rejects missing/duplicate/non-finite judgments", () => {
    expect(validateAndMapJudgments(rosters, [])).toBeNull();
    expect(
      validateAndMapJudgments(rosters, [
        {
          anonId: "R1",
          topicFit: 5,
          pickStrength: 10,
          rosterQuality: 5,
          explanation: "ok",
        },
      ]),
    ).toBeNull();
    expect(
      validateAndMapJudgments(rosters, [
        {
          anonId: "R1",
          topicFit: Number.NaN,
          pickStrength: 10,
          rosterQuality: 5,
          explanation: "bad",
        },
        {
          anonId: "R2",
          topicFit: 5,
          pickStrength: 10,
          rosterQuality: 5,
          explanation: "ok",
        },
        {
          anonId: "R3",
          topicFit: 5,
          pickStrength: 10,
          rosterQuality: 5,
          explanation: "ok",
        },
      ]),
    ).toBeNull();
  });

  it("maps valid anon judgments and applies vote counts", () => {
    const mapped = validateAndMapJudgments(
      rosters,
      rosters.map((r) => ({
        anonId: r.anonId,
        topicFit: 8,
        pickStrength: 12,
        rosterQuality: 6,
        explanation: "Solid roster for the topic.",
      })),
    );
    expect(mapped).not.toBeNull();
    const withVotes = applyVoteCounts(mapped!, { a: "b", c: "b" });
    const b = withVotes.find((s) => s.playerId === "b")!;
    expect(b.votes).toBe(2);
    expect(b.earned).toBe(20 + 26 + 10);
  });

  it("neutral fallback is identical for all roster positions", () => {
    const n = neutralJudgments(rosters);
    expect(new Set(n.map((x) => x.aiAward)).size).toBe(1);
    expect(n.every((x) => x.aiAward === RULES.aiFallbackAward)).toBe(true);
    expect(n.every((x) => x.aiFallback)).toBe(true);
  });

  it("API heuristic no longer varies by roster index", () => {
    const samePicks = ["a", "b", "c", "d"];
    const h = heuristicJudgeUniform([
      { anonId: "R1", picks: samePicks },
      { anonId: "R2", picks: samePicks },
      { anonId: "R3", picks: samePicks },
    ]);
    expect(h[0]!.pickStrength).toBe(h[1]!.pickStrength);
    expect(h[1]!.pickStrength).toBe(h[2]!.pickStrength);
  });
});

describe("synchronized dice animation", () => {
  it("tumblePose is time-based (same t ⇒ same pose across frame rates)", () => {
    const a = tumblePose(0.4, 12345, 0);
    const b = tumblePose(0.4, 12345, 0);
    expect(a).toEqual(b);
    const later = tumblePose(0.8, 12345, 0);
    expect(later.rx).not.toBe(a.rx);
  });

  it("animProgress clamps using shared timestamps", () => {
    expect(animProgress(1000, 0, 2000)).toBe(0.5);
    expect(animProgress(5000, 0, 2000)).toBe(1);
    expect(animProgress(-10, 0, 2000)).toBe(0);
  });

  it("covers all 36 face pairs vs applyDiceRoll", () => {
    expect(ALL_FACE_PAIRS).toHaveLength(36);
    for (const [d1, d2] of ALL_FACE_PAIRS) {
      const faces = { d1, d2 };
      const safe = applyDiceRoll(100, faces, 1);
      expect(safe.potAfter).toBeGreaterThanOrEqual(100);
      const danger = applyDiceRoll(100, faces, 3);
      expect(Number.isFinite(danger.potAfter)).toBe(true);
    }
  });
});

describe("session length: choices vs rounds", () => {
  it("always offers 4 topic choices; rounds still scale with player count", () => {
    expect(topicShortlistCount(2)).toBe(4);
    expect(topicShortlistCount(4)).toBe(4);
    expect(topicShortlistCount(8)).toBe(4);
    expect(topicShortlistCount(10)).toBe(4);
    expect(RULES.topicShortlistSize).toBe(4);
    expect(topicRoundsForPlayerCount(4)).toBe(3);
    expect(topicRoundsForPlayerCount(8)).toBe(2);
    expect(topicShortlistCount(8)).not.toBe(topicRoundsForPlayerCount(8));
  });

  it("does not silently shorten draft timer", () => {
    expect(RULES.pickClockSeconds).toBe(30);
  });

  it("dice is round-robin with two safe rolls", () => {
    expect(RULES.safePersonalRolls).toBe(2);
    expect(RULES.diceAnimMs).toBe(2400);
  });
});
