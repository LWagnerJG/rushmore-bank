"use client";

import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { RushmoreCard } from "@/components/RushmoreCard";

function rosterDensity(count: number): "cozy" | "snug" | "dense" {
  if (count >= 8) return "dense";
  if (count >= 5) return "snug";
  return "cozy";
}

function EarnedBadge({
  earned,
  votes,
  aiAward,
  aiFallback,
}: {
  earned: number;
  votes: number;
  aiAward: number;
  aiFallback: boolean;
}) {
  const fromVotes = votes * RULES.stonesPerHumanVote;
  return (
    <span className="earned-badge flex flex-col items-end gap-0.5 text-right">
      <span className="font-[family-name:var(--font-display)] text-xl font-extrabold tabular-nums text-[var(--coral)]">
        +{earned}
      </span>
      <span className="earned-badge-split text-[0.65rem] font-semibold leading-tight text-[var(--muted)]">
        {fromVotes} from votes · {aiAward} from AI
        {aiFallback ? " · neutral" : ""}
      </span>
    </span>
  );
}

export function ScorePanel({
  state,
  you,
  send,
}: {
  state: PublicRoomState;
  you: Player;
  send: (m: ClientMessage) => void;
}) {
  const bySeat = state.seatOrder
    .map((pid) => state.scores.find((s) => s.playerId === pid))
    .filter((s): s is NonNullable<typeof s> => !!s);
  const scored = bySeat.length > 0 ? bySeat : [...state.scores];
  const notice =
    state.judgeNotice &&
    !/HTTP\s*\d{3}|\b5\d{2}\b|\b429\b/i.test(state.judgeNotice)
      ? state.judgeNotice
      : state.judgeNotice
        ? RULES.aiFallbackLabel
        : null;
  const cast = state.bankBeansReadyCast;
  const needed = state.bankBeansReadyNeeded;
  const density = rosterDensity(state.seatOrder.length);

  return (
    <div className={`roster-board space-y-3 roster-board-${density}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
          Beans earned
        </h2>
        {notice ? (
          <p className="max-w-[55%] text-right text-[0.7rem] font-semibold leading-snug text-[var(--muted)]">
            {notice}
          </p>
        ) : null}
      </div>

      <div className={`roster-board-grid roster-board-grid-${density}`}>
        {scored.map((s) => {
          const p = state.players.find((x) => x.id === s.playerId);
          const picks = state.picks.filter((pk) => pk.playerId === s.playerId);
          const why =
            s.explanation && s.explanation !== RULES.aiFallbackLabel
              ? s.explanation
              : state.rushmoreWhy[s.playerId];
          return (
            <RushmoreCard
              key={s.playerId}
              name={p?.name ?? "Player"}
              picks={picks}
              why={why}
              compact={density !== "cozy"}
              density={density}
              badge={
                <EarnedBadge
                  earned={s.earned}
                  votes={s.votes}
                  aiAward={s.aiAward}
                  aiFallback={s.aiFallback}
                />
              }
            />
          );
        })}
      </div>

      <p
        className="text-center text-sm font-bold tabular-nums text-[var(--muted)]"
        aria-live="polite"
      >
        {cast}/{needed} ready to wager
      </p>
      {you.isHost ? (
        <button
          type="button"
          className="w-full text-center text-xs font-bold text-[var(--muted)] underline-offset-2 hover:underline"
          onClick={() => send({ type: "advance" })}
        >
          Force wager (host)
        </button>
      ) : null}
    </div>
  );
}
