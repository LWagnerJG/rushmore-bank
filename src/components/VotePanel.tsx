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
      <div className="flex justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
          Vote for one roster
        </h2>
        <Countdown until={state.phaseDeadlineAt} />
      </div>
      <p className="text-sm text-[var(--muted)]">
        Private ballot — no self-vote.{" "}
        <strong>
          {state.humanVotesCast} of {state.humanVotesNeeded} voted
        </strong>
        {state.judgeStatus === "pending" && " · Judge working…"}
        {state.judgeStatus === "failed" && state.judgeNotice
          ? ` · ${state.judgeNotice}`
          : ""}
      </p>
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
              className={`panel w-full text-left ${
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
              <p className="font-extrabold">{p?.name}</p>
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
