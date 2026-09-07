"use client";

import { useMemo, useState } from "react";
import type { ClientMessage, RoomState } from "@/shared/types";

export function RankPanel({
  state,
  youId,
  send,
}: {
  state: RoomState;
  youId: string;
  send: (msg: ClientMessage) => void;
}) {
  const others = useMemo(
    () => state.submissions.filter((s) => s.playerId !== youId),
    [state.submissions, youId],
  );
  const [order, setOrder] = useState<string[]>(() =>
    others.map((s) => s.playerId),
  );
  const [rationale, setRationale] = useState("");
  const [askingBot, setAskingBot] = useState(false);
  const submitted = state.rankings.some((r) => r.judgeId === youId);

  // Keep order in sync if late submissions arrive
  const orderSafe = order.filter((id) =>
    others.some((o) => o.playerId === id),
  );
  const missing = others
    .map((o) => o.playerId)
    .filter((id) => !orderSafe.includes(id));
  const effectiveOrder = [...orderSafe, ...missing];

  function move(id: string, dir: -1 | 1) {
    const idx = effectiveOrder.indexOf(id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= effectiveOrder.length) return;
    const next = [...effectiveOrder];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setOrder(next);
  }

  async function askBotHelp() {
    setAskingBot(true);
    try {
      const payload = {
        category: state.category,
        mounts: others.map((s) => ({
          playerId: s.playerId,
          name:
            state.players.find((p) => p.id === s.playerId)?.name ?? "Player",
          items: s.items,
        })),
      };
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        orderedPlayerIds?: string[];
        rationale?: string;
      };
      if (data.orderedPlayerIds?.length) setOrder(data.orderedPlayerIds);
      if (data.rationale) setRationale(data.rationale);
    } catch {
      setRationale("This Mount has the strongest spine — bold #1, honest bottom.");
    } finally {
      setAskingBot(false);
    }
  }

  const waiting = state.players
    .filter((p) => p.connected || p.isBot)
    .filter((p) => !state.rankings.some((r) => r.judgeId === p.id));

  if (others.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Need another Rushmore to rank. Add a friend or RushBot.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Rank everyone else&apos;s Mount for{" "}
        <span className="text-[var(--foam)]">{state.category}</span>. Best on
        top — then say why.
      </p>

      <div className="space-y-2">
        {effectiveOrder.map((id, index) => {
          const sub = others.find((s) => s.playerId === id);
          const name =
            state.players.find((p) => p.id === id)?.name ?? "Player";
          if (!sub) return null;
          return (
            <div
              key={id}
              className="rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-semibold text-[var(--gold)]">
                  #{index + 1} · {name}
                </div>
                {!submitted && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Move up"
                      onClick={() => move(id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Move down"
                      onClick={() => move(id, 1)}
                    >
                      ↓
                    </button>
                  </div>
                )}
              </div>
              <ol className="space-y-1 text-sm text-[var(--foam)]">
                {sub.items.map((item, i) => (
                  <li key={`${id}-${i}`}>
                    <span className="text-[var(--muted)]">{i + 1}.</span> {item}
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>

      {!submitted ? (
        <>
          <textarea
            className="field min-h-[88px] w-full resize-none"
            placeholder="Short rationale — why is #1 better?"
            maxLength={200}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary w-full"
            disabled={askingBot}
            onClick={askBotHelp}
          >
            {askingBot ? "Asking RushBot…" : "Suggest ranking (RushBot)"}
          </button>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() =>
              send({
                type: "submit_ranking",
                orderedPlayerIds: effectiveOrder,
                rationale,
              })
            }
          >
            Submit ranking
          </button>
        </>
      ) : (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-[var(--muted)]">
          Ranking in. Waiting on {waiting.map((p) => p.name).join(", ") || "…"}
        </p>
      )}
    </div>
  );
}
