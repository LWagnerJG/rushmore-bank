"use client";

import { useEffect, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { rosterDensity } from "@/shared/roster-density";
import { RushmoreCard } from "@/components/RushmoreCard";

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

  return (
    <div className={`roster-board space-y-3 roster-board-${density}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2
          className="font-[family-name:var(--font-display)] text-xl font-extrabold"
          role="status"
        >
          {twoPlayer
            ? "The judge is deciding…"
            : votesDone
              ? "Votes in"
              : "Vote"}
        </h2>
        {!twoPlayer && !votesDone ? (
          <span className="text-sm font-bold tabular-nums text-[var(--muted)]">
            <Countdown until={state.phaseDeadlineAt} />
          </span>
        ) : null}
      </div>

      {twoPlayer ? (
        <p className="text-sm text-[var(--muted)]">
          Two players — AI scores both drafts (no vote needed).
        </p>
      ) : (
        <>
          <p
            className="vote-count text-sm font-extrabold tabular-nums"
            role="status"
            aria-live="polite"
          >
            {state.humanVotesCast}/{state.humanVotesNeeded} voted
          </p>
          {!votesDone ? (
            <p className="text-sm text-[var(--muted)]">
              Tap a Mount Rushmore — best list for the topic. Ends in{" "}
              {RULES.humanVoteSeconds}s or when everyone has voted.
            </p>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Rosters stay up while scores lock in.
            </p>
          )}
        </>
      )}

      {judging ? (
        <p
          className="judge-working text-sm font-semibold text-[var(--muted)]"
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
                      setTimeout(() => setBusy(false), 400);
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
