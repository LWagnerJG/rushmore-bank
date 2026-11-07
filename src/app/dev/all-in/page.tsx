"use client";

/**
 * Local “Everyone’s in!” draft-complete beat lab.
 * Not linked from prod nav.
 */
import Link from "next/link";
import { ReviewPanel } from "@/components/ReviewPanel";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";

const YOU_ID = "you";

function player(
  id: string,
  name: string,
  seat: number,
  host = false,
): Player {
  return {
    id,
    name,
    role: "player",
    isHost: host,
    connected: true,
    stones: 40,
    seat,
    joinedAt: 1,
  };
}

const players: Player[] = [
  player(YOU_ID, "Luke", 0, true),
  player("p2", "Sam", 1),
  player("p3", "Alex", 2),
];

const state: PublicRoomState = {
  code: "ALL1",
  phase: "REVIEW",
  phaseRevision: 1,
  players,
  rosterLocked: true,
  settings: {
    topicCountOverride: null,
    scopeMix: [],
    topicVibe: "all",
    partyMode: false,
  },
  createdAt: 1,
  topicRound: 1,
  configuredTopicRounds: 4,
  topicOptions: [],
  topicVoteCounts: {},
  myTopicVote: null,
  selectedTopic: {
    id: "t1",
    text: "Best pizza toppings",
    scope: "everyday",
    scopeBoundary: "food",
  },
  topicRerollsUsed: 0,
  seenTopicCount: 1,
  seatOrder: players.map((p) => p.id),
  starterOffset: 0,
  draftCursor: 12,
  draftOrder: [],
  picks: [
    { playerId: YOU_ID, text: "Pepperoni", pickIndex: 0, turnIndex: 0 },
    { playerId: "p2", text: "Mushroom", pickIndex: 0, turnIndex: 1 },
    { playerId: "p3", text: "Pineapple", pickIndex: 0, turnIndex: 2 },
    { playerId: YOU_ID, text: "Basil", pickIndex: 1, turnIndex: 3 },
    { playerId: "p2", text: "Onion", pickIndex: 1, turnIndex: 4 },
    { playerId: "p3", text: "Olives", pickIndex: 1, turnIndex: 5 },
    { playerId: YOU_ID, text: "Sausage", pickIndex: 2, turnIndex: 6 },
    { playerId: "p2", text: "Peppers", pickIndex: 2, turnIndex: 7 },
    { playerId: "p3", text: "Garlic", pickIndex: 2, turnIndex: 8 },
    { playerId: YOU_ID, text: "Ricotta", pickIndex: 3, turnIndex: 9 },
    { playerId: "p2", text: "Honey", pickIndex: 3, turnIndex: 10 },
    { playerId: "p3", text: "Chili", pickIndex: 3, turnIndex: 11 },
  ],
  takenNormalized: [],
  draftOptionsStatus: "idle",
  pickDeadlineAt: null,
  pickPaused: false,
  pickPauseRemainingMs: null,
  correctionTargetPickId: null,
  correctionReason: null,
  correctionPickIndex: null,
  humanVotesCast: 0,
  humanVotesNeeded: 3,
  humanVotedIds: [],
  myHumanVote: null,
  scores: [],
  scoresLocked: false,
  judgeStatus: "idle",
  judgeNotice: null,
  rushmoreWhy: {},
  bankBeansReadyCast: 0,
  bankBeansReadyNeeded: 0,
  bankBeansReadyIds: [],
  myBankBeansReady: false,
  rematchReadyCast: 0,
  rematchReadyNeeded: 0,
  rematchReadyIds: [],
  myRematchReady: false,
  earnedThisRound: {},
  wagers: {},
  wagerDeadlineAt: null,
  diceSubphase: "WAITING",
  diceTurnSeat: 0,
  diceActiveIds: [],
  personalRollCounts: {},
  pots: {},
  protectedStones: {},
  lastDice: null,
  diceDecisionDeadlineAt: null,
  diceIdleDeadlineAt: null,
  diceRoundStartedAt: null,
  diceLapsCompleted: 0,
  partyPrompt: null,
  partyBustRedoUsedIds: [],
  diceIdlePauseRemainingMs: null,
  bustedPlayerIdsThisRound: [],
  phaseDeadlineAt: Date.now() + 1300,
  hostLastSeenAt: Date.now(),
  stateVersion: 1,
  gameOver: false,
  notice: null,
  allTimeHigh: null,
  newAllTimeHigh: false,
};

export default function AllInLabPage() {
  const you = players[0]!;
  const send = (_m: ClientMessage) => {
    /* lab noop */
  };

  return (
    <main className="app-shell mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <div className="lab-chrome stack-sm">
        <p className="type-meta text-[var(--muted)]">Dev · all-in beat</p>
      </div>
      <ReviewPanel state={state} you={you} send={send} />
      <Link href="/" className="lab-chrome type-meta text-[var(--muted)]">
        ← Home
      </Link>
    </main>
  );
}
