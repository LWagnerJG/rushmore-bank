"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { rosterDensity } from "@/shared/roster-density";
import { cueYourTurn } from "@/lib/your-turn";
import { RushmoreCard } from "@/components/RushmoreCard";
import { TimerPill } from "@/components/TimerPill";
import { nameWithYouSuffix } from "@/shared/you-label";

/** One quiet wait line — no avatar strip, no second status, no busy-judge spinner copy. */
export function voteWaitLine(opts: {
  twoPlayer: boolean;
  votesDone: boolean;
  judging: boolean;
  waitingCount: number;
}): string | null {
  const { twoPlayer, votesDone, judging, waitingCount } = opts;
  if (twoPlayer) return "AI scoring…";
  if (!votesDone && waitingCount > 0) {
    // One quiet signal — waiting count + that AI scoring follows.
    return `Waiting on ${waitingCount} · AI scoring next`;
  }
  if (judging || votesDone) return "AI scoring…";
  return null;
}

export function VotePanel({
  state,
  you,
  youId,
  send,
}: {
  state: PublicRoomState;
  you: Player;
  youId: string;
  send: (m: ClientMessage) => void;
}) {
  const myVote = state.myHumanVote;
  const [busy, setBusy] = useState(false);
  const busyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (busyTimerRef.current) clearTimeout(busyTimerRef.current);
    };
  }, []);
  const twoPlayer = state.seatOrder.length === 2;
  const density = rosterDensity(state.seatOrder.length);
  /** Server only auto-completes when needed > 0; don’t treat 0/0 as done. */
  const votesDone =
    twoPlayer ||
    (state.humanVotesNeeded > 0 &&
      state.humanVotesCast >= state.humanVotesNeeded);
  /** Only show while the judge is actually running — not ready/idle. */
  const judging = state.judgeStatus === "pending";
  const canVote = you.role === "player" && !twoPlayer && !votesDone;
  const done = new Set(state.humanVotedIds);
  const waitingCount = state.seatOrder.filter((id) => {
    const p = state.players.find((x) => x.id === id);
    return p?.role === "player" && !done.has(id);
  }).length;
  const waitLine = voteWaitLine({
    twoPlayer,
    votesDone,
    judging,
    waitingCount,
  });

  useEffect(() => {
    if (!canVote) return;
    cueYourTurn(`vote:${state.code}:${state.topicRound}:${state.phaseRevision}`);
  }, [canVote, state.code, state.topicRound, state.phaseRevision]);

  return (
    <div className={`roster-board space-y-3 roster-board-${density}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="type-display">Vote</h2>
        {!twoPlayer && !votesDone && state.phaseDeadlineAt ? (
          <TimerPill
            until={state.phaseDeadlineAt}
            label="Vote"
            announce={canVote && !myVote}
          />
        ) : null}
      </div>

      {waitLine ? (
        <p className="vote-wait type-meta text-[var(--muted)]" role="status">
          {waitLine}
        </p>
      ) : null}
      {state.judgeStatus === "failed" && (
        <p className="text-xs font-semibold text-[var(--muted)]">
          {RULES.aiFallbackLabel}
        </p>
      )}

      <div className={`roster-board-grid roster-board-grid-${density}`}>
        {state.seatOrder.map((pid) => {
          const p = state.players.find((x) => x.id === pid);
          const picks = state.picks.filter((pk) => pk.playerId === pid);
          const isYou = pid === youId;
          const selected = myVote === pid;
          const interactive = canVote && !isYou;

          return (
            <RushmoreCard
              key={pid}
              name={
                isYou
                  ? nameWithYouSuffix(p?.name ?? "You")
                  : (p?.name ?? "Player")
              }
              picks={picks}
              why={state.rushmoreWhy[pid]}
              selected={selected}
              interactive={interactive}
              disabled={!interactive || busy}
              compact={density !== "cozy"}
              density={density}
              onSelect={
                interactive
                  ? () => {
                      if (busy || you.role !== "player") return;
                      setBusy(true);
                      send({ type: "submit_vote", targetPlayerId: pid });
                      if (busyTimerRef.current) clearTimeout(busyTimerRef.current);
                      busyTimerRef.current = setTimeout(() => setBusy(false), 400);
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
