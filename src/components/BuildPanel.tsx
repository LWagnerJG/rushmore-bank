"use client";

import { useState } from "react";
import type { ClientMessage, RoomState } from "@/shared/types";

const LABELS = ["#1 Face", "#2", "#3", "#4"];

export function BuildPanel({
  state,
  youId,
  send,
}: {
  state: RoomState;
  youId: string;
  send: (msg: ClientMessage) => void;
}) {
  const existing = state.submissions.find((s) => s.playerId === youId);
  const [items, setItems] = useState<[string, string, string, string]>(
    existing?.items ?? ["", "", "", ""],
  );
  const submitted = Boolean(existing);

  const waiting = state.players
    .filter((p) => p.connected || p.isBot)
    .filter((p) => !state.submissions.some((s) => s.playerId === p.id));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          Category
        </p>
        <h3 className="font-[family-name:var(--font-display)] text-3xl text-[var(--foam)]">
          {state.category}
        </h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Carve your personal Mount Rushmore — best at the top.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((value, i) => (
          <label key={LABELS[i]} className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--gold)]">
              {LABELS[i]}
            </span>
            <input
              className="field w-full"
              value={value}
              maxLength={40}
              disabled={submitted}
              placeholder={`Pick ${i + 1}`}
              onChange={(e) => {
                const next = [...items] as [string, string, string, string];
                next[i] = e.target.value;
                setItems(next);
              }}
            />
          </label>
        ))}
      </div>

      {!submitted ? (
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => send({ type: "submit_rushmore", items })}
        >
          Lock my Rushmore
        </button>
      ) : (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-[var(--muted)]">
          Locked in. Waiting on {waiting.map((p) => p.name).join(", ") || "…"}
        </p>
      )}
    </div>
  );
}
