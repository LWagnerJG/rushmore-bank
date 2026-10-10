"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  normalizePick,
  type ClientMessage,
  type Player,
  type PublicRoomState,
} from "@/shared/types";
import { loadStash, saveStash } from "@/lib/party";
import { cueYourTurn } from "@/lib/your-turn";
import { draftStatusLine } from "@/lib/draft-status";
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
  // Find absolute index of our next turn after the current cursor.
  const nextTurnIndex = state.draftOrder.findIndex(
    (s, index) => index > state.draftCursor && state.seatOrder[s] === youId,
  );
  // Distance from current cursor to our next turn (negative = no more turns).
  const turnsAway = nextTurnIndex >= 0 ? nextTurnIndex - state.draftCursor : -1;

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

  useEffect(() => {
    if (!myTurn || state.pickPaused) return;
    cueYourTurn(`draft:${state.code}:${state.draftCursor}:${state.phaseRevision}`);
  }, [
    myTurn,
    state.pickPaused,
    state.code,
    state.draftCursor,
    state.phaseRevision,
  ]);

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

  // Draft controls never take focus: the pick field (and keyboard) stays up,
  // so one tap is one click and nothing re-animates under the finger.
  function keepFieldFocus(e: MouseEvent) {
    e.preventDefault();
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

  const status = draftStatusLine({
    phase: state.phase,
    myTurn,
    turnName: turnPlayer?.name,
    turnsAway,
    pickPaused: state.pickPaused,
    correctionPickIndex: state.correctionPickIndex,
    correctionReason: state.correctionReason,
  });

  return (
    <div className="draft-panel">
      {/*
        Composer first: the pick field sits right under the chrome, above
        where the iOS keyboard lands, so WebKit never pans the page to reveal
        it. Everything that grows (stash chips, Taken, board) renders below.
      */}
      {you.role === "player" && (
        <section className="draft-composer" aria-label="Your pick">
          <div className="draft-composer-row">
            <label className="sr-only" htmlFor="selected-pick">
              Your draft pick
            </label>
            <input
              id="selected-pick"
              className="field draft-pick-input"
              placeholder={
                myTurn ? "Type your answer" : "Park a pick in your stash"
              }
              value={selection}
              maxLength={48}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="go"
              onChange={(e) => setSelection(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                e.preventDefault();
                primaryAction();
              }}
            />
            <button
              type="button"
              className={
                myTurn
                  ? "btn-primary btn-your-turn draft-pick-submit"
                  : "btn-secondary draft-pick-submit"
              }
              aria-disabled={!canPrimary}
              onMouseDown={keepFieldFocus}
              onClick={() => {
                if (canPrimary) primaryAction();
              }}
            >
              <span>
                {myTurn ? (busy ? "Locking…" : "Lock in") : "Stash it"}
              </span>
            </button>
          </div>

          {queue.length > 0 ? (
            <div className="draft-stash">
              <p className="draft-stash-meta">
                {`Your stash · ${queue.length}${myTurn ? " · tap to lock" : ""}`}
                {saveFailed ? " · won’t survive a reload" : ""}
              </p>
              <ul className="draft-stash-list">
                {queue.map((text) => {
                  const taken = state.takenNormalized.includes(
                    normalizePick(text),
                  );
                  const canLock =
                    myTurn && !taken && !state.pickPaused && !busy;
                  const selected = selection.trim() === text;
                  return (
                    <li key={text} className="draft-stash-item">
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
                        aria-disabled={taken || undefined}
                        aria-label={
                          canLock
                            ? `Lock in ${text}`
                            : taken
                              ? `${text} already taken`
                              : `Use ${text}`
                        }
                        onMouseDown={keepFieldFocus}
                        onClick={() => applyStash(text)}
                      >
                        {text}
                      </button>
                      <button
                        type="button"
                        className="draft-stash-remove"
                        aria-label={`Remove ${text}`}
                        onMouseDown={keepFieldFocus}
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
            </div>
          ) : null}
        </section>
      )}

      {/* One fixed line: turn copy, or why the typed pick can't go in. */}
      <p
        className={[
          "draft-turn-line",
          myTurn ? "draft-turn-line-active" : "",
          you.role === "player" && selectedTaken ? "draft-turn-line-warn" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="status"
        aria-live="polite"
      >
        {you.role === "player" && selectedTaken
          ? "Taken — try another."
          : status}
      </p>

      <DraftBoard
        state={state}
        youId={youId}
        isHost={you.isHost}
        send={send}
      />
    </div>
  );
}
