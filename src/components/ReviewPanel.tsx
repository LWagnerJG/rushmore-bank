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

export function ReviewPanel({
  state,
  you,
  send,
}: {
  state: PublicRoomState;
  you: Player;
  send: (m: ClientMessage) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
          Rosters
        </h2>
        <span className="text-sm font-bold tabular-nums text-[var(--muted)]">
          <Countdown until={state.phaseDeadlineAt} />
        </span>
      </div>
      {state.seatOrder.map((pid) => {
        const p = state.players.find((x) => x.id === pid);
        const picks = state.picks
          .filter((pk) => pk.playerId === pid)
          .sort((a, b) => a.pickIndex - b.pickIndex);
        return (
          <div key={pid} className="panel">
            <p className="font-extrabold">{p?.name}</p>
            <ol className="mt-1 list-decimal pl-5 text-sm">
              {picks.map((pk) => (
                <li key={pk.turnIndex}>{pk.text}</li>
              ))}
            </ol>
          </div>
        );
      })}
      {you.isHost ? (
        <button
          type="button"
          className="btn-primary w-full text-lg"
          onClick={() => send({ type: "skip_review" })}
        >
          Start vote
        </button>
      ) : null}
    </div>
  );
}
