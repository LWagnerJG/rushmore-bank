"use client";

import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RushmoreCard } from "@/components/RushmoreCard";
import { rosterDensity } from "@/shared/roster-density";

/**
 * Fallback roster skim UI. Normal play skips REVIEW (reviewSeconds = 0) and
 * goes straight into VOTING_AND_JUDGING — this panel only flashes if a host
 * lands here via admin jump with a non-zero review window.
 */
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
      </div>
      <p className="text-sm text-[var(--muted)]">
        Starting vote + AI judge…
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
