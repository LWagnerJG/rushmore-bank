/**
 * Explicit public-state projection — never broadcast internal ballot maps.
 */
import type {
  DiceBroadcast,
  PublicDiceBroadcast,
  PublicRoomState,
  RoomState,
} from "../types";

function stripDiceForPublic(
  dice: DiceBroadcast | null,
  now: number,
): PublicDiceBroadcast | null {
  if (!dice) return null;
  const settled = dice.revealed || now >= dice.animSettleAt;
  if (!settled) {
    return {
      rollId: dice.rollId,
      rollerId: dice.rollerId,
      personalRollNumber: dice.personalRollNumber,
      animStartedAt: dice.animStartedAt,
      animSettleAt: dice.animSettleAt,
      animSeed: dice.animSeed,
      revealed: false,
      potBefore: dice.potBefore,
    };
  }
  return {
    rollId: dice.rollId,
    rollerId: dice.rollerId,
    personalRollNumber: dice.personalRollNumber,
    animStartedAt: dice.animStartedAt,
    animSettleAt: dice.animSettleAt,
    animSeed: dice.animSeed,
    revealed: true,
    potBefore: dice.potBefore,
    d1: dice.d1,
    d2: dice.d2,
    potAfter: dice.potAfter,
    busted: dice.busted,
    note: dice.note,
    outcomeKind: dice.outcomeKind,
  };
}

/**
 * Project authoritative RoomState to a recipient-safe PublicRoomState.
 * - Ballots: progress + own vote only (never voter→choice maps)
 * - Dice: hide faces / outcome text until settle (pots applied server-side only after settle)
 * - My Ideas never live on RoomState
 */
export function projectPublicState(
  state: RoomState,
  recipientId: string,
  now = Date.now(),
): PublicRoomState {
  const topicVoteCounts: Record<string, number> = {};
  for (const tid of Object.values(state.topicVotes)) {
    topicVoteCounts[tid] = (topicVoteCounts[tid] ?? 0) + 1;
  }

  const humanVotesCast = Object.keys(state.humanVotes).length;
  const humanVotesNeeded = state.seatOrder.filter((pid) => {
    const p = state.players.find((x) => x.id === pid);
    return p && p.role === "player" && p.connected;
  }).length;

  const scores = state.scoresLocked
    ? state.scores.map((s) => ({ ...s }))
    : [];

  return {
    code: state.code,
    phase: state.phase,
    phaseRevision: state.phaseRevision,
    players: state.players.map((p) => ({ ...p })),
    rosterLocked: state.rosterLocked,
    settings: { ...state.settings },
    createdAt: state.createdAt,
    topicRound: state.topicRound,
    configuredTopicRounds: state.configuredTopicRounds,
    usedTopicIds: [...state.usedTopicIds],
    topicOptions: state.topicOptions.map((t) => ({ ...t })),
    topicVoteCounts,
    myTopicVote: state.topicVotes[recipientId] ?? null,
    selectedTopic: state.selectedTopic ? { ...state.selectedTopic } : null,
    topicRerollsUsed: state.topicRerollsUsed,
    seatOrder: [...state.seatOrder],
    starterOffset: state.starterOffset,
    draftCursor: state.draftCursor,
    draftOrder: [...state.draftOrder],
    picks: state.picks.map((p) => ({ ...p })),
    takenNormalized: [...state.takenNormalized],
    pickDeadlineAt: state.pickDeadlineAt,
    pickPaused: state.pickPaused,
    pickPauseRemainingMs: state.pickPauseRemainingMs,
    correctionTargetPickId: state.correctionTargetPickId,
    correctionReason: state.correctionReason,
    humanVotesCast,
    humanVotesNeeded,
    myHumanVote: state.humanVotes[recipientId] ?? null,
    scores,
    scoresLocked: state.scoresLocked,
    judgeStatus: state.judgeStatus,
    judgeNotice: state.judgeNotice,
    earnedThisRound: { ...state.earnedThisRound },
    wagers: { ...state.wagers },
    wagerDeadlineAt: state.wagerDeadlineAt,
    diceSubphase: state.diceSubphase,
    diceTurnSeat: state.diceTurnSeat,
    diceActiveIds: [...state.diceActiveIds],
    personalRollCounts: { ...state.personalRollCounts },
    pots: { ...state.pots },
    protectedStones: { ...state.protectedStones },
    lastDice: stripDiceForPublic(state.lastDice, now),
    diceDecisionDeadlineAt: state.diceDecisionDeadlineAt,
    diceIdleDeadlineAt: state.diceIdleDeadlineAt,
    diceRoundStartedAt: state.diceRoundStartedAt,
    diceLapsCompleted: state.diceLapsCompleted,
    partyPrompt: state.partyPrompt ? { ...state.partyPrompt } : null,
    ledger: state.ledger.map((e) => ({ ...e })),
    checkpoint: state.checkpoint
      ? {
          stones: { ...state.checkpoint.stones },
          topicRound: state.checkpoint.topicRound,
        }
      : null,
    phaseDeadlineAt: state.phaseDeadlineAt,
    hostLastSeenAt: state.hostLastSeenAt,
    gameOver: state.gameOver,
    notice: state.notice,
  };
}

/** True if public projection leaks ballot maps (regression guard). */
export function publicStateLeaksBallots(
  pub: PublicRoomState | Record<string, unknown>,
): boolean {
  return (
    Object.prototype.hasOwnProperty.call(pub, "topicVotes") ||
    Object.prototype.hasOwnProperty.call(pub, "humanVotes") ||
    Object.prototype.hasOwnProperty.call(pub, "processedActionIds") ||
    Object.prototype.hasOwnProperty.call(pub, "judgeJobId")
  );
}
