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
      <div className="flex justify-between">
        <h2 className="font-extrabold">Defend your picks</h2>
        <Countdown until={state.phaseDeadlineAt} />
      </div>
      <p className="text-sm text-[var(--muted)]">
        One sentence. Make your case.
      </p>
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
                <li key={pk.turnIndex}>{pk.text}{you.isHost && <details className="my-1 text-xs">
                  <summary className="cursor-pointer text-[var(--muted)]">Correct</summary>
                  <div className="flex gap-4">{(["duplicate", "invalid"] as const).map((reason) => <button key={reason} type="button" className="min-h-11 font-bold capitalize" onClick={() => {
                    if (window.confirm(`Replace “${pk.text}” as ${reason}?`)) send({ type: "host_correct", turnIndex: pk.turnIndex, reason });
                  }}>{reason}</button>)}</div>
                </details>}</li>
              ))}
            </ol>
          </div>
        );
      })}
      {you.isHost && (
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => send({ type: "skip_review" })}
        >
          {state.seatOrder.length === 2 ? "Judge our picks" : "Start voting"}
        </button>
      )}
    </div>
  );
}

