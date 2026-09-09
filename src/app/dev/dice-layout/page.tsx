"use client";

/**
 * Local layout lab — toggles DicePanel states to verify reserved zones
 * (not linked from prod nav). Measures stage heights across transitions.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { DicePanel } from "@/components/DicePanel";
import type {
  ClientMessage,
  Player,
  PublicDiceBroadcast,
  PublicRoomState,
} from "@/shared/types";

type Scenario =
  | "watching"
  | "your_turn"
  | "rolling"
  | "settled"
  | "bust"
  | "next_seat";

const YOU_ID = "you";
const OTHER = "p2";
const THIRD = "p3";

function player(id: string, name: string, seat: number, host = false): Player {
  return {
    id,
    name,
    role: "player",
    isHost: host,
    connected: true,
    stones: 40,
    seat,
    joinedAt: Date.now(),
  };
}

function baseState(): PublicRoomState {
  const players = [
    player(YOU_ID, "You", 0, true),
    player(OTHER, "Sam", 1),
    player(THIRD, "Alex", 2),
  ];
  return {
    code: "LAB1",
    phase: "DICE",
    phaseRevision: 1,
    players,
    rosterLocked: true,
    settings: {
      topicCountOverride: null,
      scopeMix: [],
      partyMode: false,
    },
    createdAt: Date.now(),
    topicRound: 1,
    configuredTopicRounds: 3,
    usedTopicIds: [],
    topicOptions: [],
    topicVoteCounts: {},
    myTopicVote: null,
    selectedTopic: {
      id: "t1",
      text: "Best snacks",
      scope: "food",
      scopeBoundary: "edible",
    },
    topicRerollsUsed: 0,
    seenTopicCount: 1,
    seatOrder: [YOU_ID, OTHER, THIRD],
    starterOffset: 0,
    draftCursor: 0,
    draftOrder: [],
    picks: [],
    takenNormalized: [],
    draftOptions: [],
    draftOptionsStatus: "idle",
    pickDeadlineAt: null,
    pickPaused: false,
    pickPauseRemainingMs: null,
    correctionTargetPickId: null,
    correctionReason: null,
    correctionPickIndex: null,
    humanVotesCast: 0,
    humanVotesNeeded: 0,
    myHumanVote: null,
    scores: [],
    scoresLocked: true,
    judgeStatus: "idle",
    judgeNotice: null,
    rushmoreWhy: {},
    bankBeansReadyCast: 0,
    bankBeansReadyNeeded: 0,
    myBankBeansReady: false,
    earnedThisRound: {},
    wagers: { [YOU_ID]: 10, [OTHER]: 10, [THIRD]: 10 },
    wagerDeadlineAt: null,
    diceSubphase: "READY",
    diceTurnSeat: 0,
    diceActiveIds: [YOU_ID, OTHER, THIRD],
    personalRollCounts: { [YOU_ID]: 1, [OTHER]: 0, [THIRD]: 0 },
    pots: { [YOU_ID]: 8, [OTHER]: 0, [THIRD]: 0 },
    protectedStones: { [YOU_ID]: 30, [OTHER]: 40, [THIRD]: 40 },
    lastDice: null,
    diceDecisionDeadlineAt: null,
    diceIdleDeadlineAt: Date.now() + 15000,
    diceRoundStartedAt: Date.now(),
    diceLapsCompleted: 0,
    partyPrompt: null,
    ledger: [],
    checkpoint: null,
    phaseDeadlineAt: null,
    hostLastSeenAt: Date.now(),
    gameOver: false,
    notice: null,
  };
}

function settledBroadcast(
  rollerId: string,
  d1: number,
  d2: number,
  busted: boolean,
): PublicDiceBroadcast {
  const now = Date.now();
  return {
    rollId: `lab-${rollerId}-${d1}${d2}`,
    rollerId,
    personalRollNumber: 2,
    animStartedAt: now - 3000,
    animSettleAt: now - 100,
    animSeed: 42,
    revealed: true,
    potBefore: 8,
    d1,
    d2,
    potAfter: busted ? 0 : 8 + d1 + d2,
    busted,
    note: busted ? "BEAN BUSTER" : `+${d1 + d2}`,
    outcomeKind: busted ? "bust" : "add_sum",
  };
}

function scenarioState(scenario: Scenario): PublicRoomState {
  const s = baseState();
  switch (scenario) {
    case "watching":
      s.diceTurnSeat = 1; // Sam up
      s.pots[YOU_ID] = 0;
      s.diceIdleDeadlineAt = Date.now() + 12000;
      s.lastDice = null;
      break;
    case "your_turn":
      s.diceTurnSeat = 0;
      s.lastDice = settledBroadcast(YOU_ID, 3, 4, false); // sticky prior roll
      s.pots[YOU_ID] = 15;
      break;
    case "rolling":
      s.diceTurnSeat = 0;
      s.diceSubphase = "COMMITTED";
      s.diceIdleDeadlineAt = null;
      s.lastDice = {
        rollId: "lab-roll",
        rollerId: YOU_ID,
        personalRollNumber: 3,
        animStartedAt: Date.now() - 200,
        animSettleAt: Date.now() + 2200,
        animSeed: 7,
        revealed: false,
        potBefore: 15,
      };
      break;
    case "settled":
      s.diceTurnSeat = 0;
      s.diceSubphase = "SETTLED";
      s.diceIdleDeadlineAt = null;
      s.lastDice = settledBroadcast(YOU_ID, 5, 2, false);
      s.pots[YOU_ID] = 22;
      break;
    case "bust":
      s.diceTurnSeat = 0;
      s.diceSubphase = "SETTLED";
      s.diceIdleDeadlineAt = null;
      s.lastDice = settledBroadcast(YOU_ID, 3, 4, true);
      s.pots[YOU_ID] = 0;
      s.diceActiveIds = [OTHER, THIRD];
      s.partyPrompt = {
        kind: "bust_sip",
        targetPlayerIds: [YOU_ID],
        resolved: false,
      };
      s.settings = {
        topicCountOverride: null,
        scopeMix: [],
        partyMode: true,
      };
      s.ledger = [
        {
          id: "l1",
          at: Date.now(),
          playerId: YOU_ID,
          kind: "bust",
          amount: -15,
          balanceAfter: 30,
          note: "BEAN BUSTER",
          topicRound: 1,
        },
      ];
      break;
    case "next_seat":
      s.diceTurnSeat = 1;
      s.diceSubphase = "READY";
      s.diceActiveIds = [OTHER, THIRD];
      s.pots[YOU_ID] = 0;
      s.lastDice = null; // server cleared
      s.diceIdleDeadlineAt = Date.now() + 15000;
      s.ledger = [
        {
          id: "l1",
          at: Date.now(),
          playerId: YOU_ID,
          kind: "bust",
          amount: -15,
          balanceAfter: 30,
          note: "BEAN BUSTER",
          topicRound: 1,
        },
      ];
      break;
  }
  return s;
}

const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "watching", label: "Watching" },
  { id: "your_turn", label: "Your turn" },
  { id: "rolling", label: "Rolling" },
  { id: "settled", label: "Settled" },
  { id: "bust", label: "Bust" },
  { id: "next_seat", label: "Next seat" },
];

export default function DiceLayoutLabPage() {
  const [scenario, setScenario] = useState<Scenario>("your_turn");
  const [heights, setHeights] = useState<Record<string, number>>({});
  const state = useMemo(() => scenarioState(scenario), [scenario]);
  const you = state.players.find((p) => p.id === YOU_ID)!;

  function measure() {
    const layout = document.querySelector(".dice-layout");
    const tray = document.querySelector(".bean-dice-tray");
    const stage = document.querySelector(".dice-zone-stage");
    const timer = document.querySelector(".dice-stage-timer");
    const result = document.querySelector(".dice-result-readout");
    const cta = document.querySelector(".dice-cta-slot");
    if (!layout) return;
    const next: Record<string, number> = {
      layout: Math.round(layout.getBoundingClientRect().height),
      stage: stage ? Math.round(stage.getBoundingClientRect().height) : 0,
      trayTop: tray ? Math.round(tray.getBoundingClientRect().top) : 0,
      timer: timer ? Math.round(timer.getBoundingClientRect().height) : 0,
      result: result ? Math.round(result.getBoundingClientRect().height) : 0,
      cta: cta ? Math.round(cta.getBoundingClientRect().height) : 0,
    };
    setHeights(next);
  }

  return (
    <main className="app-shell app-shell-scroll mx-auto max-w-md space-y-3 px-4 pb-10 pt-6">
      <Link href="/" className="text-sm font-bold text-[var(--coral)]">
        ← Home
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
        Dice layout lab
      </h1>
      <p className="text-sm text-[var(--muted)]">
        Cycle states — tray top / zone heights should stay stable.
      </p>
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
              scenario === s.id
                ? "bg-[var(--coral)] text-white"
                : "bg-white/70 text-[var(--text)]"
            }`}
            onClick={() => {
              setScenario(s.id);
              window.setTimeout(measure, 50);
            }}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          className="rounded-lg bg-[rgba(167,215,194,0.55)] px-3 py-1.5 text-sm font-bold"
          onClick={measure}
        >
          Measure
        </button>
      </div>
      {Object.keys(heights).length > 0 && (
        <pre
          data-testid="layout-heights"
          className="rounded-lg bg-black/5 p-2 text-xs"
        >
          {JSON.stringify(heights, null, 2)}
        </pre>
      )}
      <DicePanel
        state={state}
        you={you}
        youId={YOU_ID}
        send={(_m: ClientMessage) => undefined}
      />
    </main>
  );
}
