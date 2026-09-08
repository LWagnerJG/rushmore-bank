"use client";

import type { Player, PublicRoomState } from "@/shared/types";

export function PlayerRail({
  state,
  youId,
}: {
  state: PublicRoomState;
  youId: string;
}) {
  const players = state.players
    .filter((p) => p.role === "player")
    .sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99));
  const showEarned =
    state.scoresLocked ||
    state.phase === "SCORE_REVEAL" ||
    state.phase === "WAGER_SELECTION" ||
    state.phase === "VOTING_AND_JUDGING";

  return (
    <div className="player-rail mt-2 flex flex-wrap gap-2">
      {players.map((p) => (
        <PlayerChip
          key={p.id}
          player={p}
          you={p.id === youId}
          earned={
            showEarned ? (state.earnedThisRound[p.id] ?? undefined) : undefined
          }
        />
      ))}
    </div>
  );
}

function PlayerChip({
  player,
  you,
  earned,
}: {
  player: Player;
  you: boolean;
  earned?: number;
}) {
  return (
    <div
      className={`player-chip min-w-[5rem] rounded-xl px-3 py-2 ${
        you
          ? "bg-[var(--coral)] text-white"
          : "bg-white/80 text-[var(--text)]"
      } ${player.connected ? "" : "opacity-50"}`}
    >
      <div className="flex items-center gap-1 text-[0.7rem] font-bold leading-tight">
        {player.isHost && <span title="Host">★</span>}
        <span className="max-w-[6.5rem] truncate">{player.name}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-[family-name:var(--font-display)] text-lg font-extrabold tabular-nums leading-none">
          {player.stones}
        </span>
        {earned != null && earned > 0 ? (
          <span
            className={`text-xs font-extrabold tabular-nums ${
              you ? "text-white/90" : "text-[var(--coral)]"
            }`}
          >
            +{earned}
          </span>
        ) : null}
      </div>
    </div>
  );
}
