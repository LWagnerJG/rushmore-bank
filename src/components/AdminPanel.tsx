"use client";

import { useState } from "react";
import {
  phaseLabel,
  type ClientMessage,
  type Phase,
} from "@/shared/types";

const ADMIN_KEY = "beans:admin-unlocked";
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
}: {
  send: (m: ClientMessage) => void;
  currentPhase: Phase | null;
}) {
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(ADMIN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [botCount, setBotCount] = useState(2);

  if (!unlocked) return null;

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

          <div className="flex items-end gap-2">
            <label className="block flex-1 text-xs font-bold text-[var(--text)]">
              Fake players
              <input
                className="field mt-1 w-full !py-2 text-sm"
                type="number"
                min={1}
                max={8}
                value={botCount}
                onChange={(e) =>
                  setBotCount(
                    Math.max(1, Math.min(8, Number(e.target.value) || 1)),
                  )
                }
              />
            </label>
            <button
              type="button"
              className="btn-secondary !min-h-11 shrink-0 px-3 text-sm"
              onClick={() =>
                send({
                  type: "admin_spawn_bots",
                  pin: ADMIN_PIN,
                  count: botCount,
                })
              }
            >
              Add
            </button>
          </div>
          <p className="text-[0.65rem] leading-snug text-[var(--muted)]">
            Seeds enough state to render each screen. Real multiplayer still
            works — bots stay connected as players.
          </p>
        </div>
      )}
    </div>
  );
}
