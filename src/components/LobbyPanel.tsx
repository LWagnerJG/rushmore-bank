"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { shareInvite } from "@/lib/share-invite";
import { HostAiPreGameStatus } from "@/components/HostAiPreGameStatus";
import { StatsMergePrompt } from "@/components/StatsMergePrompt";
import { BeanAvatar } from "@/components/BeanAvatar";
import { nameWithYouSuffix } from "@/shared/you-label";
import { getStableClientId } from "@/lib/client-id";
import {
  pullProfileStatsFromServer,
  sightProfileNickname,
} from "@/lib/profile-stats";

const NAME_MAX = 18;

function PencilIcon() {
  return (
    <svg
      className="lobby-rename-pencil"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
    >
      <path
        d="M11.7 1.6a1.4 1.4 0 0 1 2 2L5.4 11.9 2 12.8l.9-3.4L11.7 1.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Tap-to-edit own lobby nickname — saves on Enter / blur. */
function LobbyOwnName({
  name,
  isHost,
  onRename,
}: {
  name: string;
  isHost: boolean;
  onRename: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  function commit() {
    const clean = draft.trim();
    setEditing(false);
    if (!clean || clean === name.trim()) {
      setDraft(name);
      return;
    }
    onRename(clean);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="lobby-rename-input type-body font-extrabold"
        value={draft}
        maxLength={NAME_MAX}
        aria-label="Your nickname"
        autoComplete="nickname"
        enterKeyHint="done"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(name);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="lobby-rename-btn"
      onClick={() => setEditing(true)}
      aria-label={`Edit your nickname (currently ${name})`}
    >
      {isHost ? <span className="lobby-rename-host">★</span> : null}
      <span className="lobby-rename-text type-body font-extrabold">
        {nameWithYouSuffix(name)}
      </span>
      <PencilIcon />
    </button>
  );
}

export function LobbyPanel({
  state,
  you,
  send,
  rename,
}: {
  state: PublicRoomState;
  you: Player;
  send: (m: ClientMessage) => void;
  rename: (name: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${state.code}`
      : `${RULES.productionUrl}/room/${state.code}`;

  useEffect(() => {
    const deviceId = getStableClientId();
    const nickname = you.name.trim();
    if (!nickname) return;
    void pullProfileStatsFromServer(deviceId, nickname);
    void sightProfileNickname({
      deviceId,
      nickname,
      roomCode: state.code,
    });
  }, [you.name, state.code]);

  const players = state.players.filter((p) => p.role === "player");
  const spectators = state.players.filter((p) => p.role === "spectator");
  const enough = players.length >= RULES.minPlayers;
  const canStart =
    you.isHost && enough && players.length <= RULES.maxPlayers;
  const partyOn = state.settings.partyMode;

  const markCopied = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const share = async () => {
    const result = await shareInvite({ url, code: state.code });
    if (result === "copied") markCopied();
  };

  const copyLink = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        markCopied();
      } else {
        await share();
      }
    } catch {
      await share();
    }
  };

  const statusText = enough
    ? you.isHost
      ? "Ready — Start when everyone is here"
      : "Ready — waiting on host"
    : `Need ${RULES.minPlayers - players.length} more`;

  return (
    <div className="lobby-layout stack">
      <StatsMergePrompt nickname={you.name} />
      <section className="panel lobby-invite">
        <div className="lobby-invite-row">
          <button
            type="button"
            className="lobby-room-code type-display"
            onClick={() => void copyLink()}
            aria-label={`Room code ${state.code.split("").join(" ")}. Tap to copy invite link.`}
          >
            {state.code}
          </button>

          <div className="lobby-qr" aria-label="Invite QR code">
            <QRCodeSVG
              value={url}
              size={108}
              bgColor="#f5f0e7"
              fgColor="#23483e"
              level="M"
              marginSize={2}
              title={`Join room ${state.code}`}
            />
          </div>
        </div>

        <button
          type="button"
          className="btn-primary lobby-share-btn w-full"
          onClick={() => void share()}
        >
          {copied ? "Copied" : "Share"}
        </button>

        <p className="lobby-invite-status type-meta text-[var(--muted)]">
          {statusText}
        </p>
      </section>

      <section className="panel stack-sm lobby-roster">
        <div className="flex items-baseline justify-between gap-[var(--space-2)]">
          <h2 className="type-body font-bold">
            Who&rsquo;s in
          </h2>
          <span className="type-meta font-bold text-[var(--muted)]">
            {players.length}/{RULES.maxPlayers}
          </span>
        </div>
        <ul className="stack-sm lobby-roster-list">
          {players.map((p) => (
            <li
              key={p.id}
              className={[
                "player-row",
                p.id === you.id ? "player-row-you" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="lobby-roster-avatar" aria-hidden="true">
                <BeanAvatar id={p.avatarId} seed={p.id} size={28} />
              </span>
              {p.id === you.id ? (
                <LobbyOwnName
                  name={p.name}
                  isHost={p.isHost}
                  onRename={rename}
                />
              ) : (
                <span className="lobby-roster-name type-body font-extrabold">
                  {p.isHost ? (
                    <span className="lobby-rename-host">★</span>
                  ) : null}
                  {p.name}
                  {!p.connected && (
                    <span className="ml-[var(--space-1)] type-meta text-[var(--muted)]">
                      away
                    </span>
                  )}
                </span>
              )}
              {you.isHost && p.id !== you.id ? (
                <span className="stack-row">
                  <button
                    type="button"
                    className="min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-md px-[var(--space-2)] type-meta font-bold text-[var(--muted)] hover:bg-[rgba(231,111,78,0.12)] hover:text-[var(--coral-ink)]"
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
                </span>
              ) : null}
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

      {/* A direct child of the layout: a sticky box only travels inside its parent. */}
      {you.isHost ? (
        <div className="lobby-start-slot phase-sticky-cta">
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
      ) : null}
    </div>
  );
}
