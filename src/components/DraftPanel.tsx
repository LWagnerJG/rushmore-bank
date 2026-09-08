"use client";

import { useEffect, useRef, useState } from "react";
import {
  normalizePick,
  type ClientMessage,
  type Player,
  type PublicRoomState,
} from "@/shared/types";
import { loadStash, saveStash } from "@/lib/party";
import { DraftBoard } from "@/components/DraftBoard";

export function DraftPanel({
  state,
  you,
  youId,
  send,
}: {
  state: PublicRoomState;
  you: Player;
  youId: string;
  send: (m: ClientMessage) => void;
}) {
  const [selection, setSelection] = useState("");
  const [queue, setQueue] = useState<string[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ text: string; turn: number } | null>(null);
  const topicId = state.selectedTopic?.id ?? "none";
  const seat = state.draftOrder[state.draftCursor];
  const turnId = state.seatOrder[seat];
  const turnPlayer = state.players.find((p) => p.id === turnId);
  const myTurn = turnId === youId && you.role === "player";
  const selectedTaken = state.takenNormalized.includes(normalizePick(selection));
  const upcoming = state.draftOrder.findIndex(
    (s, index) => index > state.draftCursor && state.seatOrder[s] === youId,
  );

  useEffect(() => {
    const timer = setTimeout(
      () => setQueue(loadStash(state.code, youId, topicId)),
      0,
    );
    return () => clearTimeout(timer);
  }, [state.code, youId, topicId]);

  useEffect(() => {
    const submitted = pending.current;
    if (
      !submitted ||
      !state.picks.some(
        (pick) =>
          pick.playerId === youId &&
          pick.turnIndex === submitted.turn &&
          normalizePick(pick.text) === normalizePick(submitted.text),
      )
    )
      return;
    pending.current = null;
    const timer = setTimeout(() => {
      setSelection("");
      setBusy(false);
      setQueue((prev) => {
        const next = prev.filter(
          (item) => normalizePick(item) !== normalizePick(submitted.text),
        );
        try {
          saveStash(state.code, youId, topicId, next);
        } catch {
          /* ignore */
        }
        return next;
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [state.picks, youId, state.code, topicId]);

  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setBusy(false), 1200);
    return () => clearTimeout(timer);
  }, [busy]);

  function persist(next: string[]) {
    setQueue(next);
    try {
      saveStash(state.code, youId, topicId, next);
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }

  function addToQueue(text: string) {
    const clean = text.trim().slice(0, 48);
    if (
      !clean ||
      queue.length >= 40 ||
      queue.some((item) => normalizePick(item) === normalizePick(clean))
    )
      return;
    persist([...queue, clean]);
    setSelection("");
  }

  function lock(text = selection) {
    const clean = text.trim();
    if (
      !myTurn ||
      !clean ||
      state.takenNormalized.includes(normalizePick(clean)) ||
      state.pickPaused ||
      busy
    )
      return;
    pending.current = { text: clean, turn: state.draftCursor };
    setSelection(clean);
    setBusy(true);
    send({ type: "lock_in", text: clean });
  }

  function applyStash(text: string) {
    if (state.takenNormalized.includes(normalizePick(text))) return;
    if (myTurn && !state.pickPaused && !busy) {
      lock(text);
      return;
    }
    setSelection(text);
  }

  function primaryAction() {
    if (myTurn) lock();
    else addToQueue(selection);
  }

  const canPrimary = myTurn
    ? Boolean(
        selection.trim() &&
          !selectedTaken &&
          !state.pickPaused &&
          !busy,
      )
    : Boolean(
        selection.trim() &&
          !selectedTaken &&
          queue.length < 40 &&
          !queue.some(
            (item) => normalizePick(item) === normalizePick(selection),
          ),
      );

  const turnHint =
    state.phase === "CORRECTION"
      ? `Replace slot ${(state.correctionPickIndex ?? 0) + 1}/4 (${state.correctionReason ?? "redo"})`
      : myTurn
        ? queue.length
          ? "Tap a stash pick or type below"
          : "Type your answer"
        : upcoming < 0
          ? "Your four are in — watch the board"
          : `You’re up in ${upcoming} · stash picks while you wait`;

  return (
    <div className="draft-panel space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        className={`draft-turn ${myTurn ? "draft-turn-active" : ""}`}
        role="status"
        aria-live="polite"
      >
        <p className="draft-turn-title">
          {myTurn ? "Your turn" : `${turnPlayer?.name ?? "Player"}’s turn`}
        </p>
        <p className="draft-turn-hint">
          {turnHint}
          {state.pickPaused ? " · paused" : ""}
        </p>
      </div>

      <DraftBoard
        state={state}
        youId={youId}
        isHost={you.isHost}
        send={send}
      />

      {you.role === "player" && (
        <section className="stash-surface space-y-3" aria-label="Your stash">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[0.7rem] font-extrabold uppercase tracking-wide text-[var(--muted)]">
              Your stash
            </h2>
            {queue.length > 0 && (
              <span className="text-[0.7rem] font-bold tabular-nums text-[var(--muted)]">
                {queue.length}
                {myTurn ? " · tap to lock" : ""}
              </span>
            )}
          </div>

          {queue.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {queue.map((text) => {
                const taken = state.takenNormalized.includes(
                  normalizePick(text),
                );
                const canLock =
                  myTurn && !taken && !state.pickPaused && !busy;
                const selected = selection.trim() === text;
                return (
                  <li key={text} className="flex max-w-full items-center gap-0.5">
                    <button
                      type="button"
                      className={[
                        "stash-chip",
                        taken
                          ? "stash-chip-taken"
                          : canLock
                            ? "stash-chip-ready"
                            : selected
                              ? "stash-chip-selected"
                              : "stash-chip-idle",
                      ].join(" ")}
                      disabled={taken}
                      aria-label={
                        canLock
                          ? `Lock in ${text}`
                          : taken
                            ? `${text} already taken`
                            : `Use ${text}`
                      }
                      onClick={() => applyStash(text)}
                    >
                      {text}
                    </button>
                    <button
                      type="button"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base text-[var(--muted)]"
                      aria-label={`Remove ${text}`}
                      onClick={() =>
                        persist(queue.filter((item) => item !== text))
                      }
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <label className="sr-only" htmlFor="selected-pick">
            Your draft pick
          </label>
          <input
            id="selected-pick"
            className="field w-full text-base"
            placeholder={
              myTurn ? "Type your answer" : "Park a pick in your stash"
            }
            value={selection}
            maxLength={48}
            autoComplete="off"
            onChange={(e) => setSelection(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") primaryAction();
            }}
          />
          {selectedTaken && (
            <p className="text-sm font-bold" role="status">
              Taken — try another.
            </p>
          )}
          {saveFailed && (
            <p className="text-xs text-[var(--muted)]" role="status">
              Stash won’t survive a reload.
            </p>
          )}

          <button
            type="button"
            className={
              myTurn
                ? "btn-primary w-full text-lg"
                : "btn-secondary w-full text-lg"
            }
            disabled={!canPrimary}
            onClick={() => primaryAction()}
          >
            {myTurn ? (busy ? "Locking…" : "Lock in") : "Stash it"}
          </button>
        </section>
      )}
    </div>
  );
}
