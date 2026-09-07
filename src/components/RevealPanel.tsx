"use client";

import type { ClientMessage, RoomState } from "@/shared/types";

export function RevealPanel({
  state,
  youId,
  send,
}: {
  state: RoomState;
  youId: string;
  send: (msg: ClientMessage) => void;
}) {
  const you = state.players.find((p) => p.id === youId);
  const ranked = [...state.submissions].sort(
    (a, b) =>
      (state.lastRushmoreScores[b.playerId] ?? 0) -
      (state.lastRushmoreScores[a.playerId] ?? 0),
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        The mountain speaks. Chips awarded from peer rankings.
      </p>

      <div className="space-y-3">
        {ranked.map((sub, place) => {
          const player = state.players.find((p) => p.id === sub.playerId);
          const score = state.lastRushmoreScores[sub.playerId] ?? 0;
          return (
            <div
              key={sub.playerId}
              className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03]"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--gold)]">
                    Place {place + 1}
                  </div>
                  <div className="font-[family-name:var(--font-display)] text-2xl">
                    {player?.name ?? "Player"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[var(--muted)]">Score</div>
                  <div className="text-xl font-semibold tabular-nums">
                    {score}
                  </div>
                </div>
              </div>
              <ol className="space-y-2 px-4 py-3">
                {sub.items.map((item, i) => (
                  <li
                    key={`${sub.playerId}-r-${i}`}
                    className="flex gap-3 text-[var(--foam)]"
                  >
                    <span className="w-6 font-[family-name:var(--font-display)] text-xl text-[var(--gold)]">
                      {i + 1}
                    </span>
                    <span className="pt-1">{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          Rationales
        </h4>
        {state.rankings.map((r) => {
          const judge =
            state.players.find((p) => p.id === r.judgeId)?.name ?? "Judge";
          const top =
            state.players.find((p) => p.id === r.orderedPlayerIds[0])?.name ??
            "someone";
          return (
            <blockquote
              key={r.judgeId}
              className="rounded-xl border-l-4 border-[var(--gold)] bg-white/5 px-4 py-3 text-sm"
            >
              <div className="mb-1 text-xs text-[var(--muted)]">
                {judge} ranked {top} #1
              </div>
              {r.rationale}
            </blockquote>
          );
        })}
      </div>

      {you?.isHost && (
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => send({ type: "advance" })}
        >
          Open the BANK
        </button>
      )}
      {!you?.isHost && (
        <p className="text-center text-sm text-[var(--muted)]">
          Waiting for host to open BANK…
        </p>
      )}
    </div>
  );
}
