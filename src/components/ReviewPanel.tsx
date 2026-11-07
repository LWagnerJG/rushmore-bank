"use client";

import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { RushmoreCard } from "@/components/RushmoreCard";
import { rosterDensity } from "@/shared/roster-density";

/**
 * Draft-complete beat + legacy review skim.
 * Normal play: short server hold (`draftCompleteHoldMs`) with “Everyone’s in!”
 * so the last lock-in registers before VOTING_AND_JUDGING. Host can skip.
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
  const shortBeat = RULES.reviewSeconds <= 0;

  return (
    <div
      className={`roster-board space-y-3 roster-board-${density}${shortBeat ? " draft-all-in" : ""}`}
    >
      {shortBeat ? (
        <div className="draft-all-in-banner" role="status" aria-live="polite">
          <p className="draft-all-in-kicker type-meta">Draft complete</p>
          <h2 className="draft-all-in-title type-display">Everyone&apos;s in!</h2>
          <p className="type-meta text-[var(--muted)]">
            Vote + AI judge next…
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="type-display">Rosters</h2>
          </div>
          <p className="type-meta text-[var(--muted)]">
            Starting vote + AI judge…
          </p>
        </>
      )}
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
