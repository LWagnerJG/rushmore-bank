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

export function AdminPanel({
  send,
  currentPhase,
  playerCount = 0,
  botCountInRoom = 0,
}: {
  send: (m: ClientMessage) => void;
  currentPhase: Phase | null;
  /** Total player-role seats (humans + bots). */
  playerCount?: number;
  /** Current bot players in the room. */
  botCountInRoom?: number;
}) {
  const [open, setOpen] = useState(false);
  const [unlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(ADMIN_KEY) === "1";
    } catch {
      return false;
    }
  });
  // String draft — never clamp on every keystroke (that caused 1↔8 flicker).
  const [botCountDraft, setBotCountDraft] = useState("2");
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const slotsLeft = Math.max(0, RULES.maxPlayers - playerCount);
  const maxAdd = Math.min(BOT_MAX_PER_ADD, Math.max(1, slotsLeft || BOT_MAX_PER_ADD));
  const parsed = parseBotCountDraft(botCountDraft, maxAdd);
  const canAdd = parsed !== null && slotsLeft > 0;

  useEffect(() => {
    if (!open || !unlocked) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, unlocked]);

  if (!unlocked) return null;

  function commitAdd() {
    if (!canAdd || parsed === null) return;
    const count = Math.min(parsed, slotsLeft);
    send({
      type: "admin_spawn_bots",
      pin: ADMIN_PIN,
      count,
    });
    setLastAdded(count);
    // Keep a sensible draft after add — don't fight the user with clamps.
    setBotCountDraft(String(Math.min(2, Math.max(1, slotsLeft - count)) || 1));
  }

  return (
    <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 z-40">
      {!open ? (
        <button
          type="button"
          className="rounded-full border border-[rgba(35,72,62,0.16)] bg-white/90 px-3 py-2 text-[0.65rem] font-extrabold uppercase tracking-wide text-[var(--muted)] shadow-sm backdrop-blur"
          onClick={() => setOpen(true)}
          aria-label="Open admin panel"
        >
          Admin
        </button>
      ) : (
        <div className="w-[min(92vw,20rem)] space-y-2 rounded-2xl border border-[rgba(35,72,62,0.14)] bg-[rgba(255,255,255,0.96)] p-3 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.7rem] font-extrabold uppercase tracking-wide text-[var(--muted)]">
              Debug · {currentPhase ? phaseLabel(currentPhase) : "…"}
            </p>
            <button
              type="button"
              className="text-xs font-bold text-[var(--muted)]"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>

          <label className="block text-xs font-bold text-[var(--text)]">
            Jump phase
            <select
              className="field mt-1 w-full !py-2 text-sm"
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
                  className="field mt-1 w-full !py-2 text-sm tabular-nums"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  spellCheck={false}
                  value={botCountDraft}
                  aria-invalid={botCountDraft.trim() !== "" && parsed === null}
                  aria-describedby="admin-bots-hint"
                  onChange={(e) => {
                    // Allow empty + digits only — clamp happens on Add, not while typing.
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
                    // Soft normalize empty → leave empty so user can retype; don't snap to 1.
                    if (botCountDraft.trim() === "") return;
                    if (parsed !== null) setBotCountDraft(String(parsed));
                  }}
                />
              </label>
              <button
                type="button"
                className="btn-secondary !min-h-11 shrink-0 px-3 text-sm disabled:opacity-40"
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
            <p className="text-[0.65rem] leading-snug text-[var(--muted)]">
              Bots vote, draft real answers, wager, and Bank/roll like delayed
              humans — same action paths.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
