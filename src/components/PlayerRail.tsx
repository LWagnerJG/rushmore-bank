"use client";

import type { Player } from "@/shared/types";

export function PlayerRail({
  players,
  youId,
}: {
  players: Player[];
  youId: string;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {players.map((p) => {
        const you = p.id === youId;
        return (
          <div
            key={p.id}
            className={`min-w-[7.5rem] shrink-0 rounded-xl px-3 py-2 ${
              you
                ? "bg-[var(--gold)] text-[var(--ink)]"
                : "bg-white/5 text-[var(--foam)]"
            } ${!p.connected && !p.isBot ? "opacity-45" : ""}`}
          >
            <div className="truncate text-sm font-semibold">
              {p.name}
              {p.isHost ? " · host" : ""}
              {p.isBot ? " · bot" : ""}
            </div>
            <div className="text-xs tabular-nums opacity-80">
              {p.chips} chips
              {p.doubleJudge ? " · 2×" : ""}
              {p.hasRematchToken ? " · token" : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
