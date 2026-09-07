"use client";

import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";

export function ScorePanel({
  state,
  you,
  send,
}: {
  state: PublicRoomState;
  you: Player;
  send: (m: ClientMessage) => void;
}) {
  const sorted = [...state.scores].sort((a, b) => b.earned - a.earned);
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
          Beans earned
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Votes + AI judge · next up: wager
        </p>
      </header>
      {state.judgeNotice && (
        <p className="panel text-sm font-semibold text-[var(--coral)]">
          {state.judgeNotice}
        </p>
      )}
      {sorted.map((s) => {
        const p = state.players.find((x) => x.id === s.playerId);
        return (
          <div key={s.playerId} className="panel space-y-1">
            <div className="flex justify-between font-extrabold">
              <span>{p?.name}</span>
              <span className="text-[var(--coral)]">
                +{s.earned} {RULES.currencyName}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)]">
              {s.votes} vote{s.votes === 1 ? "" : "s"} · AI {s.aiAward}
              {s.aiFallback ? " · neutral" : ""}
            </p>
            <p className="text-sm">{s.explanation}</p>
          </div>
        );
      })}
      {you.isHost && (
        <div className="space-y-2">
          <button
            type="button"
            className="btn-primary w-full text-lg"
            onClick={() => send({ type: "advance" })}
          >
            Continue to wager
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => send({ type: "void_topic" })}
          >
            Void this topic
          </button>
        </div>
      )}
      {!you.isHost && (
        <p className="text-center text-sm text-[var(--muted)]">
          Waiting for host…
        </p>
      )}
    </div>
  );
}
