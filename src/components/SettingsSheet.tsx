"use client";

import { useEffect, useState } from "react";
import {
  isSoundEnabled,
  setSoundEnabled,
  subscribeSoundEnabled,
} from "@/lib/sound-prefs";
import { ensureAudio, unlockAudioOnGesture } from "@/lib/sfx";
import type { ClientMessage, HostAiJudgeHealth, Phase } from "@/shared/types";
import { HostAiJudgeCue } from "./HostAiJudgeCue";
import { AdminTools, isAdminUnlocked } from "./AdminPanel";

export function SettingsSheet({
  open,
  onClose,
  roomCode,
  isHost = false,
  partyOn = false,
  onPartyChange,
  hostAiJudge,
  send,
  currentPhase = null,
  playerCount = 0,
  botCountInRoom = 0,
}: {
  open: boolean;
  onClose: () => void;
  roomCode?: string | null;
  isHost?: boolean;
  partyOn?: boolean;
  onPartyChange?: (next: boolean) => void;
  /** Host-only AI health from PartyKit — never pass for non-hosts. */
  hostAiJudge?: HostAiJudgeHealth;
  send?: (m: ClientMessage) => void;
  currentPhase?: Phase | null;
  playerCount?: number;
  botCountInRoom?: number;
}) {
  const [soundOn, setSoundOn] = useState(() =>
    typeof window !== "undefined" ? isSoundEnabled() : false,
  );
  const [copied, setCopied] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  useEffect(() => {
    if (!open) return;
    return subscribeSoundEnabled(setSoundOn);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setSoundOn(isSoundEnabled()), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setAdminUnlocked(isAdminUnlocked());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function copyCode() {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  // Host-only admin tools; PIN unlock still required.
  const showAdmin = isHost && adminUnlocked && !!send;

  return (
    <div
      className="settings-sheet-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-extrabold">
            Settings
          </h2>
          <button
            type="button"
            className="text-sm font-bold text-[var(--muted)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="settings-row">
          <span className="settings-row-label">
            <span className="font-extrabold">Sound</span>
            <span className="text-xs text-[var(--muted)]">
              Soft cues — off by default
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={soundOn}
            className={`settings-toggle ${soundOn ? "settings-toggle-on" : ""}`}
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              setSoundEnabled(next);
              if (next) {
                unlockAudioOnGesture();
                void ensureAudio();
              }
            }}
          >
            <span className="settings-toggle-knob" />
            <span className="sr-only">{soundOn ? "On" : "Off"}</span>
          </button>
        </div>

        {roomCode ? (
          <div className="settings-row">
            <span className="settings-row-label">
              <span className="font-extrabold">Room code</span>
              <span className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-[0.18em]">
                {roomCode}
              </span>
            </span>
            <button
              type="button"
              className="btn-secondary shrink-0 px-[var(--space-3)]"
              onClick={() => void copyCode()}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : null}

        {isHost && onPartyChange ? (
          <div className="settings-row">
            <span className="settings-row-label">
              <span className="font-extrabold">Party Mode</span>
              <span className="text-xs text-[var(--muted)]">
                Drink prompts after bust &amp; low beans
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={partyOn}
              className={`settings-toggle ${partyOn ? "settings-toggle-on" : ""}`}
              onClick={() => onPartyChange(!partyOn)}
            >
              <span className="settings-toggle-knob" />
              <span className="sr-only">{partyOn ? "On" : "Off"}</span>
            </button>
          </div>
        ) : null}

        {isHost ? <HostAiJudgeCue health={hostAiJudge} /> : null}

        {showAdmin ? (
          <AdminTools
            send={send}
            currentPhase={currentPhase}
            playerCount={playerCount}
            botCountInRoom={botCountInRoom}
          />
        ) : null}
      </div>
    </div>
  );
}
