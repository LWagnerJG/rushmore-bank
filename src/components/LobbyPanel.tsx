"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";

export function LobbyPanel({
  state,
  you,
  send,
}: {
  state: PublicRoomState;
  you: Player;
  send: (m: ClientMessage) => void;
}) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${state.code}`
      : `${RULES.productionUrl}/room/${state.code}`;

  const players = state.players.filter((p) => p.role === "player");
  const spectators = state.players.filter((p) => p.role === "spectator");
  const canStart =
    you.isHost &&
    players.length >= RULES.minPlayers &&
    players.length <= RULES.maxPlayers;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Beans", url, text: `Join Beans: ${state.code}` });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    }
  };

  const topicOverrideLabel = useMemo(() => {
    if (state.settings.topicCountOverride == null) return "Auto";
    return String(state.settings.topicCountOverride);
  }, [state.settings.topicCountOverride]);

  return (
    <div className="space-y-4">
      <section className="panel space-y-3 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
          Room code
        </p>
        <p className="font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-[0.2em]">
          {state.code}
        </p>
        <div className="mx-auto w-fit rounded-xl bg-white p-3">
          <QRCodeSVG value={url} size={148} bgColor="#ffffff" fgColor="#23483E" />
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={share}>
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => navigator.clipboard.writeText(state.code)}
          >
            Copy code
          </button>
        </div>
      </section>

      <section className="panel space-y-2">
        <h2 className="font-extrabold">
          Players ({players.length}/{RULES.maxPlayers})
        </h2>
        <ul className="space-y-1 text-sm">
          {players.map((p) => (
            <li key={p.id} className="flex justify-between">
              <span>
                {p.isHost ? "★ " : ""}
                {p.name}
                {!p.connected && " (away)"}
              </span>
              <span className="text-[var(--muted)]">{p.stones} beans</span>
            </li>
          ))}
        </ul>
        {spectators.length > 0 && (
          <p className="text-xs text-[var(--muted)]">
            Spectators: {spectators.map((s) => s.name).join(", ")}
          </p>
        )}
      </section>

      {you.isHost && (
        <section className="panel space-y-3">
          <h2 className="font-extrabold">Host settings</h2>
          <label className="flex items-center justify-between text-sm font-semibold">
            Topic choices
            <select
              className="field !min-h-0 !py-2"
              value={topicOverrideLabel}
              onChange={(e) => {
                const v = e.target.value;
                send({
                  type: "update_settings",
                  settings: {
                    topicCountOverride: v === "Auto" ? null : Number(v),
                  },
                });
              }}
            >
              <option>Auto</option>
              <option>2</option>
              <option>3</option>
            </select>
          </label>
          <label className="flex items-center justify-between text-sm font-semibold">
            Party Mode
            <input
              type="checkbox"
              checked={state.settings.partyMode}
              onChange={(e) =>
                send({
                  type: "update_settings",
                  settings: { partyMode: e.target.checked },
                })
              }
            />
          </label>
          <p className="text-xs text-[var(--muted)]">
            Party Mode is off by default. Optional sips — no score effect.
          </p>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={!canStart}
            onClick={() => send({ type: "start" })}
          >
            Start game
          </button>
          {!canStart && (
            <p className="text-xs text-[var(--muted)]">
              Need {RULES.minPlayers}–{RULES.maxPlayers} players.
            </p>
          )}
        </section>
      )}

      {!you.isHost && (
        <p className="text-center text-sm text-[var(--muted)]">
          Waiting for host to start…
        </p>
      )}
    </div>
  );
}
