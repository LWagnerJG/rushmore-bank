"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Player, PublicRoomState } from "@/shared/types";
import { currentUpPlayerId } from "@/shared/engine/up-seat";
import { draftBoardSeats } from "@/shared/engine/snake";
import { FitName } from "@/components/FitName";
import { railChipTip, railYouLabel } from "@/shared/you-label";

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

/**
 * Match draft board left→right columns: seatOrder rotated by starterOffset
 * (first drafter leftmost). Stable through snake reversals — not score-sorted.
 */
export function sortDraftBoardPlayers(
  players: Player[],
  seatOrder: string[],
  starterOffset: number = 0,
): Player[] {
  const columnIds = draftBoardSeats(seatOrder.length, starterOffset).map(
    (seat) => seatOrder[seat]!,
  );
  const orderIndex = new Map(columnIds.map((id, i) => [id, i]));
  return players
    .map((player, index) => ({ player, index }))
    .sort((a, b) => {
      const aOrd = orderIndex.get(a.player.id) ?? 99;
      const bOrd = orderIndex.get(b.player.id) ?? 99;
      return aOrd - bOrd || a.index - b.index;
    })
    .map(({ player }) => player);
}

export function PlayerRail({
  state,
  youId,
}: {
  state: PublicRoomState;
  youId: string;
}) {
  const playerList = state.players.filter((p) => p.role === "player");
  const players =
    state.phase === "DRAFT" || state.phase === "CORRECTION"
      ? sortDraftBoardPlayers(
          playerList,
          state.seatOrder,
          state.starterOffset ?? 0,
        )
      : sortLeaderboard(playerList, youId);
  const upId = currentUpPlayerId(state);
  // Pending +earned only while still pending on the bank. After wager lock,
  // stones already include earned (bankedAfter / dice), so never show +N again
  // — that was the ROUND_RESULTS rail vs list mismatch (e.g. 50 vs 48).
  // +N under the total only on score reveal. Wager folds earned into one total.
  const showEarned = state.phase === "SCORE_REVEAL";
  // Dice owns Safe/Risking split with labels. Wager card owns AT RISK —
  // rail shows one clear total so coral tiles stay readable.
  const showPotSplit = state.phase === "DICE";
  const wagerTotals = state.phase === "WAGER_SELECTION";
  const count = players.length;
  const fit = count > 0 && count <= 5;
  const few = count > 0 && count <= 3;
  const many = count >= 6;
  const dense = count >= 8;
  // Edge peeks when tiles can overflow (pot-split 4+, or 6+ seats).
  const scrollable = many || (showPotSplit && count >= 4) || count >= 5;
  const upRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Scroll only the track (scrollIntoView can also nudge locked ancestors).
  // Instant scroll — smooth scrolling contributed measurable in-game CLS.
  // Nobody up → back to the start so You isn't left off-screen from a
  // previous phase's scroll.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const behavior: ScrollBehavior = "auto";
    const chip = upRef.current;
    if (!chip) {
      track.scrollTo({ left: 0, behavior });
      return;
    }
    const t = track.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    track.scrollBy({
      left: c.left + c.width / 2 - (t.left + t.width / 2),
      behavior,
    });
  }, [upId, state.draftCursor, state.diceTurnSeat, state.phase]);

  return (
    <div
      className={[
        "player-rail",
        fit ? "player-rail-fit" : "",
        few ? "player-rail-few" : "",
        many ? "player-rail-many" : "",
        dense ? "player-rail-dense" : "",
        showPotSplit ? "player-rail-pot-split" : "",
        scrollable ? "player-rail-scrollable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-count={count}
      aria-label={`Leaderboard · ${count} players`}
    >
      <div className="player-rail-track" ref={trackRef}>
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
              showEarned={showEarned}
              earned={
                showEarned
                  ? (state.earnedThisRound[p.id] ?? 0)
                  : undefined
              }
              showPotSplit={showPotSplit}
              pot={pot}
              safe={safe}
              totalBeans={
                wagerTotals
                  ? safe + pot + (state.earnedThisRound[p.id] ?? 0)
                  : p.stones
              }
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
  showEarned,
  compact,
  chipRef,
  showPotSplit,
  pot,
  safe,
  totalBeans,
  wagering,
}: {
  player: Player;
  you: boolean;
  up: boolean;
  earned?: number;
  showEarned?: boolean;
  compact?: boolean;
  chipRef?: RefObject<HTMLDivElement | null>;
  showPotSplit?: boolean;
  pot: number;
  safe: number;
  /** Single clear total when not showing Safe/Risking split. */
  totalBeans: number;
  wagering?: boolean;
}) {
  const label = you ? railYouLabel() : player.name;
  const tip = railChipTip(player.name, { you, up });
  const [land, setLand] = useState(false);
  const prevTotal = useRef(totalBeans);
  const prevEarned = useRef(earned);

  useEffect(() => {
    const totalChanged = prevTotal.current !== totalBeans;
    const earnedLanded =
      earned != null &&
      earned > 0 &&
      prevEarned.current !== earned;
    prevTotal.current = totalBeans;
    prevEarned.current = earned;
    if (!totalChanged && !earnedLanded) return;
    setLand(true);
    const t = window.setTimeout(() => setLand(false), 340);
    return () => window.clearTimeout(t);
  }, [totalBeans, earned]);

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
        <span className="player-chip-name-inner">
          {up ? (
            <span className="player-chip-up-dot" aria-hidden="true">
              ●
            </span>
          ) : null}
          {player.isHost && !up ? (
            <span className="player-chip-host-star" title="Host" aria-hidden="true">
              ★
            </span>
          ) : null}
          <FitName className="player-chip-name-text" text={label} title={tip} />
        </span>
      </div>
      {showPotSplit ? (
        <div
          className="player-chip-split"
          aria-label={`${safe} safe, ${pot} risking`}
        >
          <span className="player-chip-safe tabular-nums" title="Safe">
            <span className="player-chip-split-label">Safe</span>
            <span className="player-chip-split-num">{safe}</span>
          </span>
          <span
            className={`player-chip-pot tabular-nums ${
              wagering && pot > 0 ? "player-chip-pot-hot" : ""
            }`}
            title="Risking"
          >
            <span className="player-chip-split-label">Risking</span>
            <span className="player-chip-split-num">{pot}</span>
          </span>
        </div>
      ) : (
        <div className={`player-chip-score${land ? " score-land" : ""}`}>
          <span className="player-chip-stones tabular-nums">{totalBeans}</span>
          {showEarned ? (
            earned != null && earned > 0 ? (
              <span
                className={`player-chip-earned tabular-nums ${
                  you ? "player-chip-earned-you" : ""
                }`}
              >
                +{earned}
              </span>
            ) : (
              <span className="player-chip-earned-spacer" aria-hidden="true">
                &nbsp;
              </span>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}
