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
      <h2 className="font-extrabold">Scores</h2>
      <p className="text-xs text-[var(--muted)]">
        Earned = {RULES.scoreBase} + AI (0–40) + {RULES.stonesPerHumanVote}×votes
      </p>
      {sorted.map((s) => {
        const p = state.players.find((x) => x.id === s.playerId);
        return (
          <div key={s.playerId} className="panel space-y-1">
            <div className="flex justify-between font-extrabold">
              <span>{p?.name}</span>
              <span className="text-[var(--coral)]">+{s.earned}◆</span>
            </div>
            <p className="text-xs text-[var(--muted)]">
              votes {s.votes} · AI {s.aiAward}
              {s.aiFallback ? " (fallback)" : ""} · fit {s.topicFit} / strength{" "}
              {s.pickStrength} / quality {s.rosterQuality}
            </p>
            <p className="text-sm">{s.explanation}</p>
          </div>
        );
      })}
      {you.isHost && (
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={() => send({ type: "advance" })}
          >
            Wager
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => send({ type: "void_topic" })}
          >
            Void Topic
          </button>
        </div>
      )}
    </div>
  );
}
