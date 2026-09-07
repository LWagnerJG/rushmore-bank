"use client";

import { useState } from "react";
import { MIN_PLAYERS, type ClientMessage, type RoomState } from "@/shared/types";

export function LobbyPanel({
  state,
  youId,
  send,
}: {
  state: RoomState;
  youId: string;
  send: (msg: ClientMessage) => void;
}) {
  const you = state.players.find((p) => p.id === youId);
  const [copied, setCopied] = useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${state.code}`
      : `/room/${state.code}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const ready = state.players.filter((p) => p.connected || p.isBot).length;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-sm text-[var(--muted)]">Room code</p>
        <p className="font-[family-name:var(--font-display)] text-5xl tracking-[0.35em] text-[var(--gold)]">
          {state.code}
        </p>
      </div>

      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={copyLink}>
          {copied ? "Copied" : "Copy link"}
        </button>
        {"share" in navigator && (
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() =>
              navigator.share?.({
                title: "Rushmore Bank",
                text: `Join my Rushmore Bank room: ${state.code}`,
                url: shareUrl,
              })
            }
          >
            Share
          </button>
        )}
      </div>

      <p className="text-center text-sm text-[var(--muted)]">
        {ready}/{MIN_PLAYERS}+ players · share the code, then start when ready
      </p>

      {you?.isHost && (
        <div className="space-y-3">
          {!state.players.some((p) => p.isBot) && (
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => send({ type: "add_bot" })}
            >
              Add RushBot
            </button>
          )}
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => send({ type: "start" })}
          >
            Start game
          </button>
        </div>
      )}

      {!you?.isHost && (
        <p className="rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-[var(--muted)]">
          Waiting for host to start…
        </p>
      )}
    </div>
  );
}
