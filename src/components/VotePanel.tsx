"use client";

import { useEffect, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";

function Countdown({ until }: { until: number | null }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!until) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
            Pick one roster
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Private · no self-vote · {state.humanVotesCast}/
            {state.humanVotesNeeded} in
            {state.judgeStatus === "pending" ? " · Judge scoring…" : ""}
          </p>
        </div>
        <span className="text-sm font-bold tabular-nums text-[var(--muted)]">
          <Countdown until={state.phaseDeadlineAt} />
        </span>
      </div>
      {state.judgeStatus === "failed" && state.judgeNotice && (
        <p className="text-sm font-semibold text-[var(--coral)]">
          {state.judgeNotice}
        </p>
      )}
      {myVote && (
        <p className="text-sm font-bold text-[var(--text)]" aria-live="polite">
          You picked {state.players.find((p) => p.id === myVote)?.name}. Tap
          another to change.
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
                {selected ? " · your pick" : ""}
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
