"use client";

import { useEffect, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RushmoreCard } from "@/components/RushmoreCard";
import { RULES } from "@/shared/rules";

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

function rosterDensity(count: number): "cozy" | "snug" | "dense" {
  if (count >= 8) return "dense";
  if (count >= 5) return "snug";
  return "cozy";
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
  const count = state.seatOrder.length;
  const density = rosterDensity(count);

  return (
    <div className={`roster-board space-y-3 roster-board-${density}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
          Rosters
        </h2>
        <span className="text-sm font-bold tabular-nums text-[var(--muted)]">
          Vote in <Countdown until={state.phaseDeadlineAt} />
        </span>
      </div>
      <p className="text-sm text-[var(--muted)]">
        Skim the board — voting starts automatically (~{RULES.reviewSeconds}s).
      </p>
      <div className={`roster-board-grid roster-board-grid-${density}`}>
        {state.seatOrder.map((pid) => {
          const p = state.players.find((x) => x.id === pid);
          const picks = state.picks.filter((pk) => pk.playerId === pid);
          return (
            <RushmoreCard
              key={pid}
              name={p?.name ?? "Player"}
              picks={picks}
              compact={density !== "cozy"}
              density={density}
            />
          );
        })}
      </div>
      {you.isHost ? (
        <button
          type="button"
          className="text-sm font-semibold text-[var(--muted)] underline-offset-2 hover:text-[var(--text)] hover:underline"
          onClick={() => send({ type: "skip_review" })}
        >
          Start voting now
        </button>
      ) : null}
    </div>
  );
}
