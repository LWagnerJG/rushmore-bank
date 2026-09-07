"use client";

import { useState } from "react";
import {
  CATEGORY_PRESETS,
  type ClientMessage,
  type RoomState,
} from "@/shared/types";

export function CategoryPanel({
  state,
  youId,
  send,
}: {
  state: RoomState;
  youId: string;
  send: (msg: ClientMessage) => void;
}) {
  const you = state.players.find((p) => p.id === youId);
  const pickerId = state.categoryPickerId;
  const isPicker = pickerId === youId;
  const [custom, setCustom] = useState("");
  const myVote = state.categoryVotes[youId];

  function submit(category: string, forcePick: boolean) {
    if (forcePick || isPicker || (you?.isHost && !pickerId && forcePick)) {
      send({ type: "pick_category", category });
      return;
    }
    if (pickerId) return;
    send({ type: "vote_category", category });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        {pickerId
          ? isPicker
            ? "You hold the rematch token — pick the category."
            : "Waiting on the rematch token holder…"
          : "Vote a Mount Rushmore category. Host can force-pick."}
      </p>

      <div className="grid gap-2">
        {CATEGORY_PRESETS.map((cat) => {
          const selected = myVote === cat;
          return (
            <button
              key={cat}
              type="button"
              className={`rounded-xl border px-4 py-3 text-left text-base transition ${
                selected
                  ? "border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--gold)]"
                  : "border-white/10 bg-white/5 text-[var(--foam)] active:scale-[0.99]"
              }`}
              onClick={() => submit(cat, isPicker)}
              disabled={!!pickerId && !isPicker}
            >
              {cat}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          className="field flex-1"
          placeholder="Custom category"
          value={custom}
          maxLength={80}
          onChange={(e) => setCustom(e.target.value)}
        />
        <button
          type="button"
          className="btn-primary shrink-0"
          disabled={!custom.trim() || (!!pickerId && !isPicker)}
          onClick={() => submit(custom.trim(), isPicker)}
        >
          {isPicker ? "Pick" : "Vote"}
        </button>
      </div>

      {you?.isHost && !pickerId && (
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => send({ type: "advance" })}
        >
          Tally votes / force start
        </button>
      )}

      {you?.isHost && !pickerId && myVote && (
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => send({ type: "pick_category", category: myVote })}
        >
          Host force-pick my vote
        </button>
      )}
    </div>
  );
}
