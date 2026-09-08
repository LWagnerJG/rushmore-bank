/**
 * Explicit public-state projection — never broadcast internal ballot maps.
 */
import type {
  DiceBroadcast,
  PublicDiceBroadcast,
  PublicRoomState,
  RoomState,
} from "../types";
import { RULES } from "../rules";

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
 * - draftOptionsJobId stays server-only
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
  // Two-player games: AI-only scoring (no forced human votes).
  const humanVotesNeeded =
    state.seatOrder.length === 2
      ? 0
      : state.seatOrder.filter((pid) => {
          const p = state.players.find((x) => x.id === pid);
          return p && p.role === "player" && p.connected;
        }).length;

  const scores = state.scoresLocked
    ? state.scores.map((s) => ({ ...s }))
    : [];

  const rushmoreWhy: Record<string, string> = {};
  for (const s of state.scores) {
    if (
      s.explanation &&
      s.explanation !== RULES.aiFallbackLabel
    ) {
      rushmoreWhy[s.playerId] = s.explanation;
    }
  }

  const bankNeeded = state.seatOrder.filter((pid) => {
    const p = state.players.find((x) => x.id === pid);
    return p && p.role === "player";
  }).length;
  const bankCast = Object.keys(state.bankBeansReady ?? {}).filter((pid) =>
    state.seatOrder.includes(pid),
  ).length;

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
    draftOptions: [...state.draftOptions],
    draftOptionsStatus: state.draftOptionsStatus,
    pickDeadlineAt: state.pickDeadlineAt,
    pickPaused: state.pickPaused,
    pickPauseRemainingMs: state.pickPauseRemainingMs,
    correctionTargetPickId: state.correctionTargetPickId,
    correctionReason: state.correctionReason,
    correctionPickIndex: state.correctionPickIndex,
    humanVotesCast,
    humanVotesNeeded,
    myHumanVote: state.humanVotes[recipientId] ?? null,
    scores,
    scoresLocked: state.scoresLocked,
    judgeStatus: state.judgeStatus,
    judgeNotice: state.judgeNotice,
    rushmoreWhy,
    bankBeansReadyCast: bankCast,
    bankBeansReadyNeeded: bankNeeded,
    myBankBeansReady: !!state.bankBeansReady?.[recipientId],
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
    Object.prototype.hasOwnProperty.call(pub, "judgeJobId") ||
    Object.prototype.hasOwnProperty.call(pub, "draftOptionsJobId")
  );
}
