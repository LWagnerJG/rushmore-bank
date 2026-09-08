"use client";

import type { Player, PublicRoomState } from "@/shared/types";

/** You first, then beans descending (seat as stable tiebreak). */
export function sortLeaderboard(
  players: Player[],
  youId: string,
): Player[] {
  return [...players].sort((a, b) => {
    if (a.id === youId) return -1;
    if (b.id === youId) return 1;
    if (b.stones !== a.stones) return b.stones - a.stones;
    return (a.seat ?? 99) - (b.seat ?? 99);
  });
}

export function PlayerRail({
  state,
  youId,
}: {
  state: PublicRoomState;
  youId: string;
}) {
  const players = sortLeaderboard(
    state.players.filter((p) => p.role === "player"),
    youId,
  );
  const showEarned =
    state.scoresLocked ||
    state.phase === "SCORE_REVEAL" ||
    state.phase === "WAGER_SELECTION" ||
    state.phase === "VOTING_AND_JUDGING";
  const count = players.length;
  const fit = count > 0 && count <= 5;
  const many = count >= 6;
  const dense = count >= 8;

  return (
    <div
      className={[
        "player-rail mt-2",
        fit ? "player-rail-fit" : "",
        many ? "player-rail-many" : "",
        dense ? "player-rail-dense" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-count={count}
      aria-label={`Leaderboard · ${count} players`}
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
        <span className="player-chip-name-text">
          {you ? "You" : player.name}
        </span>
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
