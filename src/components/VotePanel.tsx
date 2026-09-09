"use client";

import { useEffect, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
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

  if (state.seatOrder.length === 2) {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <h2
            className="font-[family-name:var(--font-display)] text-xl font-extrabold"
            role="status"
          >
            The judge is deciding…
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Two players — AI scores both drafts (no vote needed).
          </p>
        </header>
        {state.seatOrder.map((pid) => {
          const p = state.players.find((x) => x.id === pid);
          const picks = state.picks.filter((pick) => pick.playerId === pid);
          return (
            <RushmoreCard
              key={pid}
              name={p?.name ?? "Player"}
              picks={picks}
              why={state.rushmoreWhy[pid]}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
          Vote
        </h2>
        <span className="text-sm font-bold tabular-nums text-[var(--muted)]">
          <Countdown until={state.phaseDeadlineAt} />
        </span>
      </div>
      <p
        className="vote-count text-sm font-extrabold tabular-nums"
        role="status"
        aria-live="polite"
      >
        {state.humanVotesCast}/{state.humanVotesNeeded} voted
      </p>
      <p className="text-sm text-[var(--muted)]">
        Tap a Mount Rushmore — best list for the topic. Ends in{" "}
        {RULES.humanVoteSeconds}s or when everyone has voted.
      </p>
      {state.judgeStatus === "pending" && (
        <p className="text-sm text-[var(--muted)]">Judge scoring…</p>
      )}
      {state.judgeStatus === "failed" && (
        <p className="text-xs font-semibold text-[var(--muted)]">
          {RULES.aiFallbackLabel}
        </p>
      )}
      {state.seatOrder
        .filter((pid) => pid !== youId)
        .map((pid) => {
          const p = state.players.find((x) => x.id === pid);
          const picks = state.picks.filter((pk) => pk.playerId === pid);
          const selected = myVote === pid;
          return (
            <RushmoreCard
              key={pid}
              name={p?.name ?? "Player"}
              picks={picks}
              why={state.rushmoreWhy[pid]}
              selected={selected}
              interactive
              disabled={you.role !== "player" || busy}
              onSelect={() => {
                if (busy || you.role !== "player") return;
                setBusy(true);
                send({ type: "submit_vote", targetPlayerId: pid });
                setTimeout(() => setBusy(false), 400);
              }}
            />
          );
        })}
    </div>
  );
}
