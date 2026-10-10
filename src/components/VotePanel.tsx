"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { rosterDensity } from "@/shared/roster-density";
import { cueYourTurn } from "@/lib/your-turn";
import { RushmoreCard } from "@/components/RushmoreCard";
import { WaitingRoster } from "@/components/WaitingRoster";

function Countdown({ until }: { until: number | null }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!until) return;
    const tick = () =>
      setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  return <span className="tabular-nums">{left}s</span>;
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

  useEffect(() => {
    if (!canVote) return;
    cueYourTurn(`vote:${state.code}:${state.topicRound}:${state.phaseRevision}`);
  }, [canVote, state.code, state.topicRound, state.phaseRevision]);

  return (
    <div className={`roster-board space-y-3 roster-board-${density}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="type-display" role="status">
          {twoPlayer
            ? "The judge is deciding…"
            : votesDone
              ? "Votes in"
              : "Vote"}
        </h2>
        {!twoPlayer && !votesDone ? (
          <span className="type-meta font-bold tabular-nums text-[var(--muted)]">
            <Countdown until={state.phaseDeadlineAt} />
          </span>
        ) : null}
      </div>

      {!twoPlayer ? (
        <WaitingRoster
          state={state}
          youId={youId}
          doneIds={state.humanVotedIds}
          label={votesDone ? "Votes in" : "Waiting on votes"}
        />
      ) : null}

      {judging ? (
        <p
          className="judge-working type-meta font-semibold text-[var(--muted)]"
          role="status"
          aria-live="polite"
        >
          <span className="judge-working-dot" aria-hidden="true" />
          AI is calculating…
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
                  ? `${p?.name ?? "You"} (you)`
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
