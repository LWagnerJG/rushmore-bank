"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
import { BeanAvatar } from "./BeanAvatar";
import {
  emptyProfileStats,
  loadProfileStats,
  pullProfileStatsFromServer,
  subscribeProfileStats,
  winRatePct,
  type ProfileStats,
} from "@/lib/profile-stats";
import { resolveStableClientId } from "@/lib/client-id";
import { loadAvatarId, saveAvatarId } from "@/lib/avatar-prefs";
import { recallDisplayName } from "@/lib/party";
import {
  BEAN_AVATAR_IDS,
  BEAN_AVATAR_LABELS,
  type BeanAvatarId,
} from "@/shared/bean-avatars";

type SheetPanel = "main" | "host" | "admin" | "avatar";

const SHEET_OPEN_CLASS = "settings-sheet-open";

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
  /** When opening, jump to this panel (e.g. home avatar tap → picker). */
  initialPanel = "main",
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
  initialPanel?: SheetPanel;
}) {
  const [soundOn, setSoundOn] = useState(() =>
    typeof window !== "undefined" ? isSoundEnabled() : false,
  );
  const [copied, setCopied] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [stats, setStats] = useState<ProfileStats>(emptyProfileStats);
  const [displayName, setDisplayName] = useState("");
  const [panel, setPanel] = useState<SheetPanel>("main");
  const [avatarId, setAvatarId] = useState<BeanAvatarId>(() =>
    typeof window !== "undefined" ? loadAvatarId() : "aviator",
  );

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setPanel("main");
      return;
    }
    setPanel(initialPanel);
    return subscribeSoundEnabled(setSoundOn);
  }, [open, initialPanel]);

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
    setAvatarId(loadAvatarId());
    setStats(loadProfileStats());
    const unsub = subscribeProfileStats(setStats);
    void (async () => {
      const id = await resolveStableClientId();
      const next = await pullProfileStatsFromServer(id, name);
      setStats(next);
    })();
    return unsub;
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

  // iOS: cream seam under the home indicator comes from html/body paint
  // showing through when the sheet is nested inside transformed ancestors.
  // Portal to body + dim html/body while open closes that gap.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const { body } = document;
    root.classList.add(SHEET_OPEN_CLASS);
    body.classList.add(SHEET_OPEN_CLASS);
    return () => {
      root.classList.remove(SHEET_OPEN_CLASS);
      body.classList.remove(SHEET_OPEN_CLASS);
    };
  }, [open]);

  if (!open || !mounted) return null;

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

  return createPortal(
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
                <button
                  type="button"
                  className="profile-sheet-avatar-btn"
                  aria-label="Change avatar"
                  onClick={() => setPanel("avatar")}
                >
                  <BeanAvatar id={avatarId} seed={displayName} size={44} />
                </button>
                <div className="profile-sheet-identity min-w-0">
                  <p className="profile-sheet-name font-[family-name:var(--font-display)]">
                    {displayName}
                  </p>
                  <p className="type-meta text-[var(--muted)]">Tap bean to change</p>
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
                <div className="profile-stat">
                  <span className="profile-stat-value tabular-nums">
                    {stats.totalBeans}
                  </span>
                  <span className="profile-stat-label">Beans</span>
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

        {panel === "avatar" ? (
          <>
            <div className="profile-sheet-top">
              <button
                type="button"
                className="settings-panel-back"
                onClick={() => setPanel("main")}
              >
                ‹ Avatar
              </button>
              <button
                type="button"
                className="text-sm font-bold text-[var(--muted)]"
                onClick={onClose}
              >
                Close
              </button>
            </div>
            <p className="type-meta text-[var(--muted)]">
              Pick a bean for your profile.
            </p>
            <div className="avatar-picker-grid" role="listbox" aria-label="Bean avatars">
              {BEAN_AVATAR_IDS.map((id) => {
                const selected = id === avatarId;
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`avatar-picker-cell ${selected ? "avatar-picker-cell-on" : ""}`}
                    title={BEAN_AVATAR_LABELS[id]}
                    onClick={() => {
                      setAvatarId(id);
                      saveAvatarId(id);
                      send?.({ type: "set_avatar", avatarId: id });
                      setPanel("main");
                    }}
                  >
                    <BeanAvatar id={id} size={40} />
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
