"use client";

import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { settingsSheetPropsAreEqual } from "@/lib/room-render-guards";
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
const DISMISS_PX = 96;

function SettingsSheetImpl({
  open,
  onClose,
  roomCode: _roomCode,
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
  hostAiJudge?: HostAiJudgeHealth;
  send?: (m: ClientMessage) => void;
  currentPhase?: Phase | null;
  playerCount?: number;
  botCountInRoom?: number;
  drafting?: boolean;
  pickPaused?: boolean;
  nickname?: string;
  initialPanel?: SheetPanel;
}) {
  void _roomCode; // Lobby already shows the code — keep out of the sheet.
  const [soundOn, setSoundOn] = useState(() =>
    typeof window !== "undefined" ? isSoundEnabled() : false,
  );
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [stats, setStats] = useState<ProfileStats>(emptyProfileStats);
  const [displayName, setDisplayName] = useState("");
  const [panel, setPanel] = useState<SheetPanel>("main");
  const [avatarId, setAvatarId] = useState<BeanAvatarId>(() =>
    typeof window !== "undefined" ? loadAvatarId() : "aviator",
  );
  const [mounted, setMounted] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setPanel("main");
      setDragY(0);
      setDragging(false);
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

  const showAdmin = isHost && adminUnlocked && !!send;
  const showHostOptions = isHost;
  const rate = winRatePct(stats);
  const hasGames = stats.gamesPlayed > 0;

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    const el = sheetRef.current;
    const scrollTop = el?.querySelector(".settings-sheet-body")?.scrollTop ?? 0;
    // Only start dismiss drag from the top of the scroll body / grabber.
    if (scrollTop > 0) return;
    dragStartY.current = t.clientY;
    setDragging(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (dragStartY.current == null) return;
    const t = e.touches[0];
    if (!t) return;
    const dy = Math.max(0, t.clientY - dragStartY.current);
    setDragY(dy);
  }

  function onTouchEnd() {
    if (dragStartY.current == null) return;
    const dy = dragY;
    dragStartY.current = null;
    setDragging(false);
    if (dy >= DISMISS_PX) {
      setDragY(0);
      onClose();
      return;
    }
    setDragY(0);
  }

  const sheetStyle =
    dragY > 0
      ? {
          transform: `translate3d(0, ${dragY}px, 0)`,
          transition: dragging ? "none" : undefined,
        }
      : undefined;

  return createPortal(
    <div
      className="settings-sheet-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className="settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Profile"
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div className="settings-sheet-grabber" aria-hidden="true">
          <span className="settings-sheet-grabber-pill" />
        </div>

        <div className="settings-sheet-body">
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
                    <BeanAvatar id={avatarId} seed={displayName} size={56} />
                  </button>
                  <div className="profile-sheet-identity min-w-0">
                    <p className="profile-sheet-name font-[family-name:var(--font-display)]">
                      {displayName}
                    </p>
                    <button
                      type="button"
                      className="profile-sheet-change"
                      onClick={() => setPanel("avatar")}
                    >
                      Change avatar
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="settings-sheet-close"
                  aria-label="Close"
                  onClick={onClose}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              {hasGames ? (
                <div className="profile-stats" aria-label="All-time stats">
                  <div className="profile-stat">
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
                </div>
              ) : (
                <p className="profile-stats-empty" aria-label="All-time stats">
                  No games yet
                </p>
              )}

              <div className="settings-group">
                <div className="settings-row">
                  <span className="settings-row-label">
                    <span className="settings-row-title">Sound</span>
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
                      if (next) enableSoundFromUserGesture();
                    }}
                  >
                    <span className="settings-toggle-knob" />
                    <span className="sr-only">{soundOn ? "On" : "Off"}</span>
                  </button>
                </div>

                {showHostOptions ? (
                  <button
                    type="button"
                    className="settings-nav-row"
                    onClick={() => setPanel("host")}
                  >
                    <span className="settings-row-title">Host options</span>
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
                    <span className="settings-row-title">Admin</span>
                    <span className="settings-nav-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                ) : null}
              </div>
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
                  className="settings-sheet-close"
                  aria-label="Close"
                  onClick={onClose}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              <div className="settings-group">
                {onPartyChange ? (
                  <div className="settings-row">
                    <span className="settings-row-label">
                      <span className="settings-row-title">Party Mode</span>
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

                <div className="settings-host-ai">
                  <HostAiJudgeCue health={hostAiJudge} />
                </div>

                {drafting && send ? (
                  <div className="settings-row">
                    <span className="settings-row-label">
                      <span className="settings-row-title">Draft clock</span>
                    </span>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        className="btn-secondary px-[var(--space-3)]"
                        onClick={() =>
                          send({
                            type: pickPaused ? "host_resume" : "host_pause",
                          })
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
              </div>
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
                  className="settings-sheet-close"
                  aria-label="Close"
                  onClick={onClose}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              <div className="settings-group">
                <AdminTools
                  send={send}
                  currentPhase={currentPhase}
                  playerCount={playerCount}
                  botCountInRoom={botCountInRoom}
                />
              </div>
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
                  className="settings-sheet-close"
                  aria-label="Close"
                  onClick={onClose}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              <p className="type-meta text-[var(--muted)] profile-avatar-hint">
                Pick a bean for your profile.
              </p>
              <div
                className="avatar-picker-grid"
                role="listbox"
                aria-label="Bean avatars"
              >
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
      </div>
    </div>,
    document.body,
  );
}

/** Skip re-renders while closed — room broadcasts must not wake the sheet. */
export const SettingsSheet = memo(SettingsSheetImpl, settingsSheetPropsAreEqual);
