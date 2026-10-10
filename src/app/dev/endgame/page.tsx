"use client";

/**
 * Local endgame lab — final standings reveal for 2/4/6 players + ties.
 * Not linked from prod nav.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { ResultsPanel } from "@/components/ResultsPanel";
import { clearRevealCompleted, resultsRevealKey } from "@/lib/results-reveal";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";

type Scenario = "two" | "four" | "six" | "tie";

const YOU_ID = "you";

function player(
  id: string,
  name: string,
  stones: number,
  seat: number,
  host = false,
): Player {
  return {
    id,
    name,
    role: "player",
    isHost: host,
    connected: true,
    stones,
    seat,
    joinedAt: 1,
  };
}

function baseState(players: Player[], createdAt: number): PublicRoomState {
  return {
    code: "END1",
    phase: "GAME_RESULTS",
    phaseRevision: 1,
    players,
    rosterLocked: true,
    settings: {
      topicCountOverride: null,
      scopeMix: [],
      topicVibe: "all",
      partyMode: false,
    },
    createdAt,
    topicRound: 4,
    configuredTopicRounds: 4,
    topicOptions: [],
    topicVoteCounts: {},
    myTopicVote: null,
    selectedTopic: null,
    topicRerollsUsed: 0,
    seenTopicCount: 4,
    seatOrder: players.map((p) => p.id),
    starterOffset: 0,
    draftCursor: 0,
    draftOrder: [],
    picks: [],
    takenNormalized: [],
    draftOptionsStatus: "idle",
    pickDeadlineAt: null,
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
    scoresLocked: true,
    judgeStatus: "idle",
    judgeNotice: null,
    rushmoreWhy: {},
    bankBeansReadyCast: 0,
    bankBeansReadyNeeded: 0,
    bankBeansReadyIds: [],
    myBankBeansReady: false,
    rematchReadyCast: 0,
    rematchReadyNeeded: players.length,
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
    gameOver: true,
    notice: null,
  };
}

function roster(scenario: Scenario): Player[] {
  switch (scenario) {
    case "two":
      return [
        player(YOU_ID, "Luke", 120, 0, true),
        player("p2", "Sam", 80, 1),
      ];
    case "four":
      return [
        player(YOU_ID, "Luke", 140, 0, true),
        player("p2", "Sam", 110, 1),
        player("p3", "Alex", 90, 2),
        player("p4", "JordanWithAVeryLongNickname", 40, 3),
      ];
    case "six":
      return [
        player(YOU_ID, "Luke", 160, 0, true),
        player("p2", "Sam", 130, 1),
        player("p3", "Alex", 100, 2),
        player("p4", "Jo", 70, 3),
        player("p5", "Kai", 50, 4),
        player("p6", "Rio", 20, 5),
      ];
    case "tie":
      return [
        player(YOU_ID, "Luke", 100, 0, true),
        player("p2", "Sam", 100, 1),
        player("p3", "Alex", 60, 2),
        player("p4", "Jo", 60, 3),
      ];
  }
}

export default function EndgameLabPage() {
  const [scenario, setScenario] = useState<Scenario>("four");
  const [createdAt, setCreatedAt] = useState(() => Date.now());
  const [revision, setRevision] = useState(1);

  const players = useMemo(() => roster(scenario), [scenario]);
  const state = useMemo(() => {
    const s = baseState(players, createdAt);
    s.phaseRevision = revision;
    return s;
  }, [players, createdAt, revision]);
  const you = players[0]!;

  const send = (_m: ClientMessage) => {
    /* lab noop */
  };

  const replay = () => {
    const key = resultsRevealKey({
      code: state.code,
      createdAt,
      phase: state.phase,
      topicRound: state.topicRound,
    });
    clearRevealCompleted(key);
    setCreatedAt(Date.now());
    setRevision((r) => r + 1);
  };

  const bumpRevision = () => setRevision((r) => r + 1);

  return (
    <main className="app-shell mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <div className="stack-sm">
        <p className="type-meta text-[var(--muted)]">Dev · endgame lab</p>
        <h1 className="type-display">Endgame lab</h1>
        <div className="stack-row flex-wrap">
          {(["two", "four", "six", "tie"] as Scenario[]).map((s) => (
            <button
              key={s}
              type="button"
              className={scenario === s ? "btn-primary" : "btn-secondary"}
              onClick={() => {
                setScenario(s);
                replay();
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="stack-row">
          <button type="button" className="btn-secondary flex-1" onClick={replay}>
            Replay reveal
          </button>
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={bumpRevision}
          >
            Bump revision
          </button>
        </div>
        <p className="type-meta text-[var(--muted)]">
          Bump revision simulates reconnect noise — reveal must not restart.
        </p>
      </div>

      <ResultsPanel state={state} you={you} send={send} />

      <Link href="/" className="type-meta text-[var(--muted)]">
        ← Home
      </Link>
    </main>
  );
}
