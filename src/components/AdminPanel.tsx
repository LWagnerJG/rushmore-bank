"use client";

import { useEffect, useRef, useState } from "react";
import {
  phaseLabel,
  type ClientMessage,
  type Phase,
} from "@/shared/types";
import { RULES } from "@/shared/rules";
import { BOT_MAX_PER_ADD, parseBotCountDraft } from "@/shared/admin-bots";
import { ADMIN_UNLOCK_KEY } from "@/lib/admin-session";

const ADMIN_KEY = ADMIN_UNLOCK_KEY;
const ADMIN_PIN = "8989";

const PHASES: Phase[] = [
  "LOBBY",
  "TOPIC_SELECTION",
  "DRAFT",
  "REVIEW",
  "VOTING_AND_JUDGING",
  "SCORE_REVEAL",
  "WAGER_SELECTION",
  "DICE",
  "ROUND_RESULTS",
  "GAME_RESULTS",
];

export function isAdminUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(ADMIN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Host/debug admin tools — rendered inside SettingsSheet so the floating
 * ADMIN pill never overlaps phase content.
 */
export function AdminTools({
  send,
  currentPhase,
  playerCount = 0,
  botCountInRoom = 0,
}: {
  send: (m: ClientMessage) => void;
  currentPhase: Phase | null;
  playerCount?: number;
  botCountInRoom?: number;
}) {
  const [botCountDraft, setBotCountDraft] = useState("2");
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const slotsLeft = Math.max(0, RULES.maxPlayers - playerCount);
  const maxAdd = Math.min(BOT_MAX_PER_ADD, Math.max(1, slotsLeft || BOT_MAX_PER_ADD));
  const parsed = parseBotCountDraft(botCountDraft, maxAdd);
  const canAdd = parsed !== null && slotsLeft > 0;

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);

  function commitAdd() {
    if (!canAdd || parsed === null) return;
    const count = Math.min(parsed, slotsLeft);
    send({
      type: "admin_spawn_bots",
      pin: ADMIN_PIN,
      count,
    });
    setLastAdded(count);
    setBotCountDraft(String(Math.min(2, Math.max(1, slotsLeft - count)) || 1));
  }

  return (
    <div className="admin-tools space-y-2">
      <p className="text-[0.7rem] font-extrabold uppercase tracking-wide text-[var(--muted)]">
        Admin · {currentPhase ? phaseLabel(currentPhase) : "…"}
      </p>

      <label className="block text-xs font-bold text-[var(--text)]">
        Jump phase
        <select
          className="field mt-1 w-full !py-2"
          value={currentPhase ?? "LOBBY"}
          onChange={(e) =>
            send({
              type: "admin_jump_phase",
              pin: ADMIN_PIN,
              phase: e.target.value as Phase,
            })
          }
        >
          {PHASES.map((p) => (
            <option key={p} value={p}>
              {phaseLabel(p)}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-1.5 rounded-xl bg-[rgba(167,215,194,0.28)] px-2.5 py-2">
        <div className="flex items-end gap-2">
          <label className="block flex-1 text-xs font-bold text-[var(--text)]">
            Add bots
            <input
              ref={inputRef}
              className="field mt-1 w-full !py-2 tabular-nums"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              spellCheck={false}
              value={botCountDraft}
              aria-invalid={botCountDraft.trim() !== "" && parsed === null}
              aria-describedby="admin-bots-hint"
              onChange={(e) => {
                const next = e.target.value.replace(/[^\d]/g, "").slice(0, 2);
                setBotCountDraft(next);
                setLastAdded(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitAdd();
                }
              }}
              onBlur={() => {
                if (botCountDraft.trim() === "") return;
                if (parsed !== null) setBotCountDraft(String(parsed));
              }}
            />
          </label>
          <button
            type="button"
            className="btn-secondary shrink-0 px-[var(--space-3)] disabled:opacity-40"
            disabled={!canAdd}
            onClick={commitAdd}
          >
            Add
          </button>
        </div>
        <p
          id="admin-bots-hint"
          className="text-[0.65rem] leading-snug text-[var(--muted)]"
        >
          {slotsLeft <= 0
            ? `Room full (${RULES.maxPlayers}/${RULES.maxPlayers}).`
            : `Adds ${parsed ?? "?"} · ${slotsLeft} seat${slotsLeft === 1 ? "" : "s"} left · ${botCountInRoom} bot${botCountInRoom === 1 ? "" : "s"} in room.`}
          {lastAdded !== null ? ` Last added ${lastAdded}.` : ""}
        </p>
      </div>
    </div>
  );
}

/** @deprecated Floating pill removed — use AdminTools inside SettingsSheet. */
export function AdminPanel(_props: {
  send: (m: ClientMessage) => void;
  currentPhase: Phase | null;
  playerCount?: number;
  botCountInRoom?: number;
}) {
  return null;
}
