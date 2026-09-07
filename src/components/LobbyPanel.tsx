"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { PartyModeSwitch } from "@/components/PartyModeSwitch";

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
  const enough = players.length >= RULES.minPlayers;
  const canStart =
    you.isHost && enough && players.length <= RULES.maxPlayers;
  const partyOn = state.settings.partyMode;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Beans",
          url,
          text: `Join Beans: ${state.code}`,
        });
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

  const statusText = enough
    ? you.isHost
      ? "Ready — hit Start when everyone’s here"
      : "Ready — waiting on host"
    : `Need ${RULES.minPlayers - players.length} more player${
        RULES.minPlayers - players.length === 1 ? "" : "s"
      }`;

  return (
    <div className="space-y-4">
      <section className="panel space-y-3 text-center">
        <div className="flex justify-center">
          <span
            className={
              "status-pill " + (enough ? "status-pill-ready" : "")
            }
          >
            {enough ? "Ready" : "Gathering"}
          </span>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
          Room code
        </p>
        <p className="font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-[0.22em]">
          {state.code}
        </p>
        <p className="text-sm font-semibold">{statusText}</p>
        <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-sm">
          <QRCodeSVG
            value={url}
            size={148}
            bgColor="#ffffff"
            fgColor="#23483E"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary flex-1 text-base"
            onClick={share}
          >
            {copied ? "Copied!" : "Share invite"}
          </button>
          <button
            type="button"
            className="btn-secondary shrink-0 px-4"
            onClick={() => navigator.clipboard.writeText(state.code)}
          >
            Copy code
          </button>
        </div>
      </section>

      <section className="panel space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-extrabold">
            Who’s in
          </h2>
          <span className="text-sm font-bold text-[var(--muted)]">
            {players.length}/{RULES.maxPlayers}
          </span>
        </div>
        <ul className="space-y-2">
          {players.map((p) => (
            <li key={p.id} className="player-row">
              <span className="font-extrabold">
                {p.isHost ? "★ " : ""}
                {p.name}
                {p.id === you.id ? " (you)" : ""}
                {!p.connected && (
                  <span className="ml-1 text-sm font-semibold text-[var(--muted)]">
                    away
                  </span>
                )}
              </span>
              <span className="text-sm font-bold text-[var(--muted)]">
                {p.stones} {RULES.currencyName}
              </span>
            </li>
          ))}
          {players.length === 0 && (
            <li className="text-sm text-[var(--muted)]">No players yet</li>
          )}
        </ul>
        {spectators.length > 0 && (
          <p className="text-xs text-[var(--muted)]">
            Watching: {spectators.map((s) => s.name).join(", ")}
          </p>
        )}
      </section>

      {!you.isHost && (
        <section className="panel space-y-2 text-center">
          <p className="font-extrabold">
            {partyOn ? "Party Mode is on" : "Waiting for host…"}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {partyOn
              ? "Optional sip prompts later — Pass anytime."
              : "Host starts when the crew is ready."}
          </p>
        </section>
      )}

      {you.isHost && (
        <section className="space-y-3">
          <PartyModeSwitch
            on={partyOn}
            onChange={(next) =>
              send({
                type: "update_settings",
                settings: { partyMode: next },
              })
            }
          />

          <div className="panel space-y-3">
            <h2 className="font-extrabold">How we start</h2>
            <div className="space-y-2.5">
              <div className="lobby-step">
                <span className="lobby-step-num">1</span>
                <p>Friends join with the code, link, or QR.</p>
              </div>
              <div className="lobby-step">
                <span className="lobby-step-num">2</span>
                <p>
                  {RULES.minPlayers}–{RULES.maxPlayers} players — then you
                  Start.
                </p>
              </div>
              <div className="lobby-step">
                <span className="lobby-step-num">3</span>
                <p>
                  {partyOn
                    ? "Draft → vote → bank. Sip prompts stay optional."
                    : "Draft four, vote, then bank beans."}
                </p>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              Topic choices
              <select
                className="field !min-h-0 !w-auto !py-2"
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
          </div>

          <button
            type="button"
            className={
              "btn-primary w-full text-lg " + (canStart ? "pulse-soft" : "")
            }
            disabled={!canStart}
            onClick={() => send({ type: "start" })}
          >
            {canStart
              ? partyOn
                ? "Start the party"
                : "Start game"
              : `Waiting · need ${RULES.minPlayers}+`}
          </button>
        </section>
      )}
    </div>
  );
}
