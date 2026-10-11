"use client";

import { useEffect, useState } from "react";
import {
  isSoundEnabled,
  setSoundEnabled,
  subscribeSoundEnabled,
} from "@/lib/sound-prefs";
import { enableSoundFromUserGesture } from "@/lib/sfx";
import type { ClientMessage, HostAiJudgeHealth, Phase } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { HostAiJudgeCue } from "./HostAiJudgeCue";
import { AdminTools, isAdminUnlocked } from "./AdminPanel";
import { profileInitials } from "@/lib/profile-initials";
import {
  emptyProfileStats,
  loadProfileStats,
  subscribeProfileStats,
  winRatePct,
  type ProfileStats,
} from "@/lib/profile-stats";
import { recallDisplayName } from "@/lib/party";

type SheetPanel = "main" | "host" | "admin";

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
  drafting = false,
  pickPaused = false,
  nickname,
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
  drafting?: boolean;
  pickPaused?: boolean;
  /** Display name for the profile header (falls back to stored nickname). */
  nickname?: string;
}) {
  const [soundOn, setSoundOn] = useState(() =>
    typeof window !== "undefined" ? isSoundEnabled() : false,
  );
  const [copied, setCopied] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [stats, setStats] = useState<ProfileStats>(emptyProfileStats);
  const [displayName, setDisplayName] = useState("");
  const [panel, setPanel] = useState<SheetPanel>("main");

  useEffect(() => {
    if (!open) {
      setPanel("main");
      return;
    }
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
    const name = nickname?.trim() || recallDisplayName().trim() || "Player";
    setDisplayName(name);
    setStats(loadProfileStats());
    return subscribeProfileStats(setStats);
  }, [open, nickname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (panel !== "main") {
          setPanel("main");
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, panel]);

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
  const showHostOptions = isHost;
  const rate = winRatePct(stats);
  const hasGames = stats.gamesPlayed > 0;

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
        aria-label="Profile"
        onClick={(e) => e.stopPropagation()}
      >
        {panel === "main" ? (
          <>
            <div className="profile-sheet-top">
              <div className="profile-sheet-header">
                <span className="profile-sheet-avatar" aria-hidden="true">
                  {profileInitials(displayName)}
                </span>
                <div className="profile-sheet-identity min-w-0">
                  <p className="profile-sheet-name font-[family-name:var(--font-display)]">
                    {displayName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="text-sm font-bold text-[var(--muted)]"
                onClick={onClose}
              >
                Close
              </button>
            </div>

            {hasGames ? (
              <div className="profile-stats" aria-label="All-time stats">
                <div className="profile-stat profile-stat-hero">
                  <span className="profile-stat-value tabular-nums">
                    {stats.wins}
                  </span>
                  <span className="profile-stat-label">Wins</span>
                </div>
                <div className="profile-stat">
                  <span className="profile-stat-value tabular-nums">
                    {stats.gamesPlayed}
                  </span>
                  <span className="profile-stat-label">Games</span>
                </div>
                <div className="profile-stat">
                  <span className="profile-stat-value tabular-nums">
                    {rate}%
                  </span>
                  <span className="profile-stat-label">Win rate</span>
                </div>
                <div className="profile-stat">
                  <span className="profile-stat-value tabular-nums">
                    {stats.bestScore}
                  </span>
                  <span className="profile-stat-label">Best</span>
                </div>
                <div className="profile-stat">
                  <span className="profile-stat-value tabular-nums">
                    {stats.winStreak}
                  </span>
                  <span className="profile-stat-label">Streak</span>
                </div>
              </div>
            ) : (
              <p className="profile-stats-empty" aria-label="All-time stats">
                No games yet
              </p>
            )}

            <div className="settings-row">
              <span className="settings-row-label">
                <span className="font-extrabold">Sound</span>
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
                  // Must prime AudioContext inside this tap (iOS gesture).
                  if (next) enableSoundFromUserGesture();
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

            {showHostOptions ? (
              <button
                type="button"
                className="settings-nav-row"
                onClick={() => setPanel("host")}
              >
                <span className="font-extrabold">Host options</span>
                <span className="settings-nav-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            ) : null}

            {showAdmin ? (
              <button
                type="button"
                className="settings-nav-row"
                onClick={() => setPanel("admin")}
              >
                <span className="font-extrabold">Admin</span>
                <span className="settings-nav-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            ) : null}
          </>
        ) : null}

        {panel === "host" ? (
          <>
            <div className="profile-sheet-top">
              <button
                type="button"
                className="settings-panel-back"
                onClick={() => setPanel("main")}
              >
                ‹ Host options
              </button>
              <button
                type="button"
                className="text-sm font-bold text-[var(--muted)]"
                onClick={onClose}
              >
                Close
              </button>
            </div>

            {onPartyChange ? (
              <div className="settings-row">
                <span className="settings-row-label">
                  <span className="font-extrabold">Party Mode</span>
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

            <HostAiJudgeCue health={hostAiJudge} />

            {drafting && send ? (
              <div className="settings-row">
                <span className="settings-row-label">
                  <span className="font-extrabold">Draft clock</span>
                </span>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="btn-secondary px-[var(--space-3)]"
                    onClick={() =>
                      send({ type: pickPaused ? "host_resume" : "host_pause" })
                    }
                  >
                    {pickPaused ? "Resume" : "Pause"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary px-[var(--space-3)]"
                    onClick={() => send({ type: "host_extend" })}
                  >
                    +{RULES.hostExtendSeconds}s
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {panel === "admin" && showAdmin && send ? (
          <>
            <div className="profile-sheet-top">
              <button
                type="button"
                className="settings-panel-back"
                onClick={() => setPanel("main")}
              >
                ‹ Admin
              </button>
              <button
                type="button"
                className="text-sm font-bold text-[var(--muted)]"
                onClick={onClose}
              >
                Close
              </button>
            </div>

            <AdminTools
              send={send}
              currentPhase={currentPhase}
              playerCount={playerCount}
              botCountInRoom={botCountInRoom}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
