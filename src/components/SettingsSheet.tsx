"use client";

import { useEffect, useRef, useState } from "react";
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

type SheetPanel = "main" | "host" | "admin";
/** Home may still pass "avatar" — opens main with the picker expanded. */
type InitialPanel = SheetPanel | "avatar";

const SHEET_OPEN_CLASS = "settings-sheet-open";
const DISMISS_PX = 96;
const NAME_MAX = 18;

function PencilIcon({ className = "profile-sheet-pencil" }: { className?: string }) {
  return (
    <svg
      className={className}
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

/** Inline nickname edit — Enter / blur save (lobby rename parity). */
function ProfileNameEdit({
  name,
  canEdit,
  lockedHint,
  onRename,
}: {
  name: string;
  canEdit: boolean;
  lockedHint: string;
  onRename?: (next: string) => void;
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
    onRename?.(clean);
  }

  if (!canEdit || !onRename) {
    return (
      <div className="profile-sheet-identity min-w-0">
        <p className="profile-sheet-name font-[family-name:var(--font-display)]">
          {name}
        </p>
        {lockedHint ? (
          <p className="profile-sheet-locked-hint">{lockedHint}</p>
        ) : null}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="profile-sheet-identity min-w-0">
        <input
          ref={inputRef}
          className="profile-sheet-name-input font-[family-name:var(--font-display)]"
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
      </div>
    );
  }

  return (
    <div className="profile-sheet-identity min-w-0">
      <button
        type="button"
        className="profile-sheet-name-btn"
        onClick={() => setEditing(true)}
        aria-label={`Edit your nickname (currently ${name})`}
      >
        <span className="profile-sheet-name font-[family-name:var(--font-display)]">
          {name}
        </span>
        <PencilIcon />
      </button>
    </div>
  );
}

export function SettingsSheet({
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
  rename,
  canRename = true,
  rosterLocked = false,
  /** When opening, jump to this panel (or expand avatar picker). */
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
  /** Lobby / home rename — same server path as #162 when wired from RoomClient. */
  rename?: (name: string) => void;
  canRename?: boolean;
  rosterLocked?: boolean;
  initialPanel?: InitialPanel;
}) {
  void _roomCode; // Lobby already shows the code — keep out of the sheet.
  const [soundOn, setSoundOn] = useState(() =>
    typeof window !== "undefined" ? isSoundEnabled() : false,
  );
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [stats, setStats] = useState<ProfileStats>(emptyProfileStats);
  const [displayName, setDisplayName] = useState("");
  const [panel, setPanel] = useState<SheetPanel>("main");
  const [avatarOpen, setAvatarOpen] = useState(false);
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
      setAvatarOpen(false);
      setDragY(0);
      setDragging(false);
      return;
    }
    if (initialPanel === "avatar") {
      setPanel("main");
      setAvatarOpen(true);
    } else {
      setPanel(initialPanel);
      setAvatarOpen(false);
    }
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
        if (avatarOpen) {
          setAvatarOpen(false);
          return;
        }
        if (panel !== "main") {
          setPanel("main");
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, panel, avatarOpen]);

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
  const nameEditable = Boolean(rename) && canRename && !rosterLocked;
  const nameLockedHint =
    rename && (!canRename || rosterLocked) ? "Change after the game" : "";

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

  function pickAvatar(id: BeanAvatarId) {
    setAvatarId(id);
    saveAvatarId(id);
    send?.({ type: "set_avatar", avatarId: id });
    setAvatarOpen(false);
  }

  function onRenameCommit(next: string) {
    setDisplayName(next);
    rename?.(next);
  }

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
                    aria-expanded={avatarOpen}
                    onClick={() => setAvatarOpen((v) => !v)}
                  >
                    <BeanAvatar id={avatarId} seed={displayName} size={56} />
                  </button>
                  <div className="profile-sheet-identity-wrap min-w-0">
                    <ProfileNameEdit
                      name={displayName}
                      canEdit={nameEditable}
                      lockedHint={nameLockedHint}
                      onRename={rename ? onRenameCommit : undefined}
                    />
                    <button
                      type="button"
                      className="profile-sheet-change"
                      aria-expanded={avatarOpen}
                      onClick={() => setAvatarOpen((v) => !v)}
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

              <div
                className={`avatar-picker-expand ${avatarOpen ? "avatar-picker-expand-open" : ""}`}
                aria-hidden={!avatarOpen}
              >
                {avatarOpen ? (
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
                          onClick={() => pickAvatar(id)}
                        >
                          <BeanAvatar id={id} size={40} />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
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
        </div>
      </div>
    </div>,
    document.body,
  );
}
