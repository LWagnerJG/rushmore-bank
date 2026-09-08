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
  const many = players.length >= 6;

  return (
    <div
      className={`player-rail mt-2 ${many ? "player-rail-many" : ""}`}
      data-count={players.length}
      aria-label={`${players.length} players`}
    >
      <div className="player-rail-track">
        {players.map((p) => (
          <PlayerChip
            key={p.id}
            player={p}
            you={p.id === youId}
            compact={many}
            earned={
              showEarned
                ? (state.earnedThisRound[p.id] ?? undefined)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

function PlayerChip({
  player,
  you,
  earned,
  compact,
}: {
  player: Player;
  you: boolean;
  earned?: number;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "player-chip",
        compact ? "player-chip-compact" : "",
        you ? "player-chip-you" : "player-chip-other",
        player.connected ? "" : "opacity-50",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="player-chip-name">
        {player.isHost && <span title="Host">★</span>}
        <span className="player-chip-name-text">{player.name}</span>
      </div>
      <div className="player-chip-score">
        <span className="player-chip-stones tabular-nums">{player.stones}</span>
        {earned != null && earned > 0 ? (
          <span
            className={`player-chip-earned tabular-nums ${
              you ? "player-chip-earned-you" : ""
            }`}
          >
            +{earned}
          </span>
        ) : null}
      </div>
    </div>
  );
}
