"use client";

import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { rosterDensity } from "@/shared/roster-density";
import { RushmoreCard } from "@/components/RushmoreCard";
import { WaitingRoster } from "@/components/WaitingRoster";

function EarnedBadge({ earned }: { earned: number }) {
  return (
    <span className="earned-badge earned-badge-quiet">
      <span className="earned-badge-num tabular-nums">+{earned}</span>
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
  const density = rosterDensity(state.seatOrder.length);

  return (
    <div className={`roster-board space-y-3 roster-board-${density}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="type-display">Beans earned</h2>
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
              badge={<EarnedBadge earned={s.earned} />}
            />
          );
        })}
      </div>

      <WaitingRoster
        state={state}
        youId={you.id}
        doneIds={state.bankBeansReadyIds}
        label="Ready to wager"
      />
      {you.isHost ? (
        <button
          type="button"
          className="w-full text-center type-meta font-bold text-[var(--muted)] underline-offset-2 hover:underline"
          onClick={() => send({ type: "advance" })}
        >
          Force wager (host)
        </button>
      ) : null}
    </div>
  );
}
