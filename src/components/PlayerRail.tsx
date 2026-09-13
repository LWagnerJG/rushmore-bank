"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Player, PublicRoomState } from "@/shared/types";
import { currentUpPlayerId } from "@/shared/engine/up-seat";

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
  const upId = currentUpPlayerId(state);
  const showEarned =
    state.scoresLocked ||
    state.phase === "SCORE_REVEAL" ||
    state.phase === "WAGER_SELECTION" ||
    state.phase === "VOTING_AND_JUDGING";
  const showPotSplit =
    state.phase === "WAGER_SELECTION" || state.phase === "DICE";
  const count = players.length;
  const fit = count > 0 && count <= 5;
  const many = count >= 6;
  const dense = count >= 8;
  const upRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!upId) return;
    upRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [upId, state.draftCursor, state.diceTurnSeat, state.phase]);

  return (
    <div
      className={[
        "player-rail mt-2",
        fit ? "player-rail-fit" : "",
        many ? "player-rail-many" : "",
        dense ? "player-rail-dense" : "",
        showPotSplit ? "player-rail-pot-split" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-count={count}
      aria-label={`Leaderboard · ${count} players`}
    >
      <div className="player-rail-track">
        {players.map((p) => {
          const inDice = state.diceActiveIds?.includes(p.id) ?? false;
          const pot = state.pots?.[p.id] ?? 0;
          const safe = inDice
            ? (state.protectedStones?.[p.id] ?? p.stones)
            : p.stones;
          return (
            <PlayerChip
              key={p.id}
              player={p}
              you={p.id === youId}
              up={upId === p.id}
              chipRef={upId === p.id ? upRef : undefined}
              compact={many}
              earned={
                showEarned
                  ? (state.earnedThisRound[p.id] ?? undefined)
                  : undefined
              }
              showPotSplit={showPotSplit}
              pot={pot}
              safe={safe}
              wagering={showPotSplit && (inDice || pot > 0)}
            />
          );
        })}
      </div>
    </div>
  );
}

function PlayerChip({
  player,
  you,
  up,
  earned,
  compact,
  chipRef,
  showPotSplit,
  pot,
  safe,
  wagering,
}: {
  player: Player;
  you: boolean;
  up: boolean;
  earned?: number;
  compact?: boolean;
  chipRef?: RefObject<HTMLDivElement | null>;
  showPotSplit?: boolean;
  pot: number;
  safe: number;
  wagering?: boolean;
}) {
  const label = you ? "You" : player.name;
  const tip = up
    ? `${player.name} · on the clock`
    : player.name;

  return (
    <div
      ref={chipRef}
      className={[
        "player-chip",
        compact ? "player-chip-compact" : "",
        you ? "player-chip-you" : "player-chip-other",
        up ? "player-chip-up" : "",
        player.connected ? "" : "opacity-50",
        showPotSplit ? "player-chip-pot-split" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-current={up ? "true" : undefined}
      title={tip}
    >
      <div className="player-chip-name">
        {up && (
          <span className="player-chip-up-dot" aria-hidden="true">
            ●
          </span>
        )}
        {player.isHost && !up && <span title="Host">★</span>}
        <span className="player-chip-name-text">{label}</span>
      </div>
      {showPotSplit ? (
        <div className="player-chip-split" aria-label={`${safe} safe, ${pot} pot`}>
          <span className="player-chip-safe tabular-nums">
            <span className="player-chip-split-label">safe</span> {safe}
          </span>
          <span
            className={`player-chip-pot tabular-nums ${
              wagering && pot > 0 ? "player-chip-pot-hot" : ""
            }`}
          >
            <span className="player-chip-split-label">pot</span> {pot}
          </span>
        </div>
      ) : (
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
      )}
    </div>
  );
}
