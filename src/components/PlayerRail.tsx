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

  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
      {players.map((p) => (
        <PlayerChip key={p.id} player={p} you={p.id === youId} />
      ))}
    </div>
  );
}

function PlayerChip({ player, you }: { player: Player; you: boolean }) {
  return (
    <div
      className={`shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-bold ${
        you
          ? "bg-[var(--coral)] text-white"
          : "bg-white/70 text-[var(--text)]"
      } ${player.connected ? "" : "opacity-50"}`}
    >
      <div className="flex items-center gap-1">
        {player.isHost && <span title="Host">★</span>}
        <span>{player.name}</span>
      </div>
      <div className="opacity-80">{player.stones} beans</div>
    </div>
  );
}
