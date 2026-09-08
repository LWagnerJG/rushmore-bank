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
  const notice =
    state.judgeNotice &&
    !/HTTP\s*\d{3}|\b5\d{2}\b|\b429\b/i.test(state.judgeNotice)
      ? state.judgeNotice
      : state.judgeNotice
        ? RULES.aiFallbackLabel
        : null;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
          Beans earned
        </h2>
        {notice ? (
          <p className="max-w-[55%] text-right text-[0.7rem] font-semibold leading-snug text-[var(--muted)]">
            {notice}
          </p>
        ) : null}
      </div>
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
            {s.explanation && s.explanation !== RULES.aiFallbackLabel ? (
              <details>
                <summary className="cursor-pointer text-xs font-bold text-[var(--muted)]">
                  Why
                </summary>
                <p className="mt-1 text-sm">{s.explanation}</p>
              </details>
            ) : null}
          </div>
        );
      })}
      {you.isHost ? (
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
            Void topic
          </button>
        </div>
      ) : null}
    </div>
  );
}
