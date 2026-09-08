"use client";

import { useEffect, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";

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
        <h2
          className="font-[family-name:var(--font-display)] text-xl font-extrabold"
          role="status"
        >
          The judge is deciding…
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Two players — AI scores both drafts (no vote needed).
        </p>
        {state.seatOrder.map((pid) => (
          <article key={pid} className="panel">
            <p className="font-extrabold">
              {state.players.find((p) => p.id === pid)?.name}
            </p>
            <ol className="mt-2 list-decimal pl-5 text-sm">
              {state.picks
                .filter((pick) => pick.playerId === pid)
                .sort((a, b) => a.pickIndex - b.pickIndex)
                .map((pick) => (
                  <li key={pick.turnIndex}>{pick.text}</li>
                ))}
            </ol>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
          Vote · {state.humanVotesCast}/{state.humanVotesNeeded}
        </h2>
        <span className="text-sm font-bold tabular-nums text-[var(--muted)]">
          <Countdown until={state.phaseDeadlineAt} />
        </span>
      </div>
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
          const picks = state.picks
            .filter((pk) => pk.playerId === pid)
            .sort((a, b) => a.pickIndex - b.pickIndex);
          const selected = myVote === pid;
          return (
            <button
              key={pid}
              type="button"
              className={`panel w-full min-h-[72px] text-left transition ${
                selected ? "ring-2 ring-[var(--coral)]" : ""
              }`}
              disabled={you.role !== "player" || busy}
              onClick={() => {
                if (busy || you.role !== "player") return;
                setBusy(true);
                send({ type: "submit_vote", targetPlayerId: pid });
                setTimeout(() => setBusy(false), 400);
              }}
            >
              <p className="font-extrabold">
                {p?.name}
                {selected ? " ✓" : ""}
              </p>
              <ol className="mt-1 list-decimal pl-5 text-sm">
                {picks.map((pk) => (
                  <li key={pk.turnIndex}>{pk.text}</li>
                ))}
              </ol>
            </button>
          );
        })}
    </div>
  );
}
