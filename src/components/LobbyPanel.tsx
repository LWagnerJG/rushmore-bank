"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { shareInvite } from "@/lib/share-invite";
import { HostAiPreGameStatus } from "@/components/HostAiPreGameStatus";

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
  const [showQR, setShowQR] = useState(false);
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
    const result = await shareInvite({ url, code: state.code });
    if (result === "copied") {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  const statusText = enough
    ? you.isHost
      ? "Ready — Start when everyone is here"
      : "Ready — waiting on host"
    : `Need ${RULES.minPlayers - players.length} more`;

  return (
    <div className="lobby-layout stack">
      <section className="panel lobby-invite stack text-center">
        <p
          className="lobby-room-code type-display"
          aria-label={`Room code ${state.code.split("").join(" ")}`}
        >
          {state.code}
        </p>
        <p className="type-meta text-[var(--muted)]">{statusText}</p>

        <div className="stack-sm">
          <button
            type="button"
            className="btn-primary lobby-share-btn w-full"
            onClick={() => void share()}
          >
            {copied ? "Copied" : "Share"}
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => setShowQR((v) => !v)}
            aria-expanded={showQR}
          >
            {showQR ? "Hide QR" : "Show QR"}
          </button>
        </div>

        {showQR && (
          <div className="lobby-qr mx-auto w-fit rounded-2xl bg-white p-[var(--space-3)] shadow-sm">
            <QRCodeSVG
              value={url}
              size={160}
              bgColor="#ffffff"
              fgColor="#23483E"
            />
          </div>
        )}
      </section>

      <section className="panel stack-sm">
        <div className="flex items-baseline justify-between gap-[var(--space-2)]">
          <h2 className="type-body font-[family-name:var(--font-display)] font-extrabold">
            Who&rsquo;s in
          </h2>
          <span className="type-meta font-bold text-[var(--muted)]">
            {players.length}/{RULES.maxPlayers}
          </span>
        </div>
        <ul className="stack-sm">
          {players.map((p) => (
            <li key={p.id} className="player-row">
              <span className="type-body font-extrabold">
                {p.isHost ? "★ " : ""}
                {p.name}
                {p.id === you.id ? " (you)" : ""}
                {!p.connected && (
                  <span className="ml-[var(--space-1)] type-meta text-[var(--muted)]">
                    away
                  </span>
                )}
              </span>
              <span className="stack-row">
                <span className="type-meta font-bold text-[var(--muted)]">
                  {p.stones} {RULES.currencyName}
                </span>
                {you.isHost && p.id !== you.id && (
                  <button
                    type="button"
                    className="min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-md px-[var(--space-2)] type-meta font-bold text-[var(--muted)] hover:bg-[rgba(231,111,78,0.12)] hover:text-[var(--coral)]"
                    aria-label={`Remove ${p.name}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove ${p.name} from the lobby? They can rejoin with a fresh seat.`,
                        )
                      ) {
                        send({ type: "remove_player", playerId: p.id });
                      }
                    }}
                  >
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
          {players.length === 0 && (
            <li className="type-meta text-[var(--muted)]">No players yet</li>
          )}
        </ul>
        {spectators.length > 0 && (
          <p className="type-meta text-[var(--muted)]">
            Watching: {spectators.map((s) => s.name).join(", ")}
          </p>
        )}
      </section>

      {you.isHost ? (
        <section className="lobby-host-tools">
          <div className="lobby-start-slot">
            <button
              type="button"
              data-diag="lobby-start"
              className="btn-primary w-full"
              disabled={!canStart}
              onClick={() => send({ type: "start" })}
            >
              {canStart
                ? partyOn
                  ? "Start the party"
                  : "Start game"
                : `Need ${RULES.minPlayers}+ players`}
            </button>
            <HostAiPreGameStatus />
          </div>
        </section>
      ) : null}
    </div>
  );
}
