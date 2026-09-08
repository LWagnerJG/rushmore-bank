"use client";

import { useEffect, useRef, useState } from "react";
import {
  normalizePick,
  type ClientMessage,
  type Player,
  type PublicRoomState,
} from "@/shared/types";
import { loadIdeas, saveIdeas } from "@/lib/party";
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
  const [ideasOpen, setIdeasOpen] = useState(true);
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
      () => setQueue(loadIdeas(state.code, youId, topicId)),
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
      // Drop used idea from private queue
      setQueue((prev) => {
        const next = prev.filter(
          (item) => normalizePick(item) !== normalizePick(submitted.text),
        );
        try {
          saveIdeas(state.code, youId, topicId, next);
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
      saveIdeas(state.code, youId, topicId, next);
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

  function applyIdea(text: string) {
    if (state.takenNormalized.includes(normalizePick(text))) return;
    if (myTurn && !state.pickPaused && !busy) {
      lock(text);
      return;
    }
    setSelection(text);
  }

  const turnHint =
    state.phase === "CORRECTION"
      ? `Replace the ${state.correctionReason} pick`
      : myTurn
        ? "Type below or tap an idea"
        : upcoming < 0
          ? "Your four are in"
          : `You’re up in ${upcoming}`;

  return (
    <div className="space-y-3 pb-36">
      <header className="space-y-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold leading-tight">
          {state.selectedTopic?.text}
        </h2>
        <div
          className={`rounded-2xl px-4 py-3 ${
            myTurn
              ? "bg-[var(--yellow)] ring-2 ring-[var(--text)]"
              : "bg-white/70"
          }`}
          role="status"
          aria-live="polite"
        >
          <p className="truncate text-lg font-extrabold">
            {myTurn ? "Your turn" : `${turnPlayer?.name ?? "Player"}’s turn`}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {turnHint}
            {state.pickPaused ? " · paused" : ""}
          </p>
        </div>
      </header>

      <DraftBoard
        state={state}
        youId={youId}
        isHost={you.isHost}
        send={send}
      />

      {you.role === "player" && (
        <div className="space-y-2">
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between rounded-xl bg-white/60 px-3 text-sm font-bold"
            aria-expanded={ideasOpen}
            onClick={() => setIdeasOpen((open) => !open)}
          >
            <span>
              My Ideas{queue.length ? ` (${queue.length})` : ""}
              {myTurn && queue.length > 0 ? (
                <span className="ml-2 text-xs font-semibold text-[var(--coral)]">
                  tap to lock
                </span>
              ) : null}
            </span>
            <span aria-hidden>{ideasOpen ? "▴" : "▾"}</span>
          </button>
          {ideasOpen && (
            <section className="space-y-2" aria-label="Private idea queue">
              {queue.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  Queue answers while you wait — private to you.
                </p>
              ) : (
                <ul className="max-h-44 overflow-y-auto rounded-xl bg-white/60">
                  {queue.map((text) => {
                    const taken = state.takenNormalized.includes(
                      normalizePick(text),
                    );
                    const canLock =
                      myTurn && !taken && !state.pickPaused && !busy;
                    return (
                      <li
                        key={text}
                        className="flex items-center border-b border-[var(--mint)] last:border-0"
                      >
                        <button
                          type="button"
                          className={`min-h-12 min-w-0 flex-1 break-words px-3 py-3 text-left text-sm transition ${
                            taken
                              ? "line-through opacity-45"
                              : canLock
                                ? "font-extrabold text-[var(--text)] active:bg-[var(--yellow)]"
                                : "font-bold text-[var(--muted)]"
                          }`}
                          disabled={taken}
                          aria-label={
                            canLock
                              ? `Lock in ${text}`
                              : taken
                                ? `${text} already taken`
                                : `Use ${text} in the input`
                          }
                          onClick={() => applyIdea(text)}
                        >
                          {text}
                          {taken
                            ? " · taken"
                            : canLock
                              ? " · lock"
                              : ""}
                        </button>
                        <button
                          type="button"
                          className="min-h-12 min-w-12 text-xl text-[var(--muted)]"
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
              {saveFailed && (
                <p className="text-xs" role="status">
                  Ideas won’t survive a reload.
                </p>
              )}
            </section>
          )}
        </div>
      )}

      {you.role === "player" && (
        <section className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--mint)] bg-[var(--bg)]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto max-w-md space-y-2">
            <label className="sr-only" htmlFor="selected-pick">
              Your draft pick
            </label>
            <input
              id="selected-pick"
              className="field w-full text-base"
              placeholder={myTurn ? "Type your answer" : "Type while you wait"}
              value={selection}
              maxLength={48}
              autoComplete="off"
              onChange={(e) => setSelection(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") lock();
              }}
            />
            {selectedTaken && (
              <p className="text-sm font-bold" role="status">
                Taken — try another.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary flex-[2] text-lg"
                disabled={
                  !myTurn ||
                  !selection.trim() ||
                  selectedTaken ||
                  state.pickPaused ||
                  busy
                }
                onClick={() => lock()}
              >
                {busy ? "Locking…" : "Lock pick"}
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                disabled={
                  !selection.trim() ||
                  selectedTaken ||
                  queue.length >= 40 ||
                  queue.some(
                    (item) =>
                      normalizePick(item) === normalizePick(selection),
                  )
                }
                onClick={() => {
                  addToQueue(selection);
                  setIdeasOpen(true);
                }}
              >
                Queue
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
