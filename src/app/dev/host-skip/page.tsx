"use client";

/**
 * Local lab: settings invite + draft column Skip + presence chips.
 * Not linked from prod nav.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { DraftPanel } from "@/components/DraftPanel";
import { SettingsSheet } from "@/components/SettingsSheet";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";

const YOU_ID = "host";

function player(
  id: string,
  name: string,
  seat: number,
  opts?: {
    host?: boolean;
    connected?: boolean;
    presence?: Player["presence"];
  },
): Player {
  return {
    id,
    name,
    role: "player",
    isHost: Boolean(opts?.host),
    connected: opts?.connected ?? true,
    presence: opts?.presence ?? (opts?.connected === false ? "away" : "live"),
    stones: 40,
    seat,
    joinedAt: 1,
  };
}

const players: Player[] = [
  player(YOU_ID, "Luke", 0, { host: true }),
  player("p2", "Sam", 1, {
    connected: false,
    presence: "away",
  }),
  player("p3", "Alex", 2, {
    connected: false,
    presence: "reconnecting",
  }),
];

function baseState(): PublicRoomState {
  return {
    code: "SKIP",
    phase: "DRAFT",
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
    draftCursor: 1,
    draftOrder: [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0],
    picks: [
      { playerId: YOU_ID, text: "Pepperoni", pickIndex: 0, turnIndex: 0 },
    ],
    takenNormalized: ["pepperoni"],
    draftOptionsStatus: "idle",
    pickDeadlineAt: Date.now() + 45000,
    pickPaused: false,
    pickPauseRemainingMs: null,
    correctionTargetPickId: null,
    correctionReason: null,
    correctionPickIndex: null,
    humanVotesCast: 0,
    humanVotesNeeded: 0,
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
    phaseDeadlineAt: null,
    hostLastSeenAt: Date.now(),
    stateVersion: 1,
    gameOver: false,
    notice: "Sam disconnected — pick skipped",
    allTimeHigh: null,
    newAllTimeHigh: false,
  };
}

export default function HostSkipLabPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const state = useMemo(() => baseState(), []);
  const you = players[0]!;
  const send = (_m: ClientMessage) => {
    /* lab noop */
  };

  return (
    <main className="app-shell mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <div className="lab-chrome stack-sm">
        <p className="type-meta text-[var(--muted)]">Dev · host skip / invite</p>
        <div className="stack-row flex-wrap">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setSettingsOpen(true)}
          >
            Open settings
          </button>
        </div>
      </div>

      <DraftPanel state={state} you={you} youId={YOU_ID} send={send} />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomCode={state.code}
        nickname={you.name}
        isHost
        partyOn={false}
        drafting
        pickPaused={false}
        send={send}
        currentPhase="DRAFT"
        playerCount={3}
        rosterLocked
        canRename={false}
        awayPlayers={players
          .filter((p) => !p.connected)
          .map((p) => ({
            id: p.id,
            name: p.name,
            presence: p.presence,
          }))}
      />

      <Link href="/" className="lab-chrome type-meta text-[var(--muted)]">
        ← Home
      </Link>
    </main>
  );
}
