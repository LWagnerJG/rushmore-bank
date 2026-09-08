"use client";

import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { RushmoreCard } from "@/components/RushmoreCard";

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
  const ready = state.myBankBeansReady;
  const cast = state.bankBeansReadyCast;
  const needed = state.bankBeansReadyNeeded;

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
        const picks = state.picks.filter((pk) => pk.playerId === s.playerId);
        const why =
          s.explanation && s.explanation !== RULES.aiFallbackLabel
            ? s.explanation
            : state.rushmoreWhy[s.playerId];
        return (
          <RushmoreCard
            key={s.playerId}
            name={p?.name ?? "Player"}
            picks={picks}
            why={why}
            badge={
              <span className="font-[family-name:var(--font-display)] text-xl font-extrabold tabular-nums text-[var(--coral)]">
                +{s.earned}
              </span>
            }
            footer={
              <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
                {s.votes} vote{s.votes === 1 ? "" : "s"} · AI {s.aiAward}
                {s.aiFallback ? " · neutral" : ""}
              </p>
            }
          />
        );
      })}

      {you.role === "player" ? (
        <div className="space-y-2">
          <button
            type="button"
            className="btn-primary w-full text-lg"
            disabled={ready}
            onClick={() => send({ type: "bank_the_beans" })}
          >
            {ready ? "Ready" : "Bank the Beans"}
          </button>
          <p
            className="text-center text-sm font-bold tabular-nums text-[var(--muted)]"
            aria-live="polite"
          >
            {cast}/{needed} ready
          </p>
        </div>
      ) : (
        <p className="text-center text-sm font-bold tabular-nums text-[var(--muted)]">
          {cast}/{needed} ready
        </p>
      )}
    </div>
  );
}
