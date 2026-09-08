"use client";

import { useEffect, useRef, useState } from "react";
import { normalizePick, type ClientMessage, type Player, type PublicRoomState } from "@/shared/types";
import { loadIdeas, saveIdeas } from "@/lib/party";
import { DraftBoard } from "@/components/DraftBoard";
import { RULES } from "@/shared/rules";

function Countdown({ until, paused }: { until: number | null; paused: boolean }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0);
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [until]);
  return <span className="text-3xl font-extrabold tabular-nums leading-none">{paused ? "‖" : `${left}s`}</span>;
}

export function DraftPanel({ state, you, youId, send }: {
  state: PublicRoomState; you: Player; youId: string; send: (m: ClientMessage) => void;
}) {
  const [selection, setSelection] = useState("");
  const [queue, setQueue] = useState<string[]>([]);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ text: string; turn: number } | null>(null);
  const topicId = state.selectedTopic?.id ?? "none";
  const seat = state.draftOrder[state.draftCursor];
  const turnId = state.seatOrder[seat];
  const turnPlayer = state.players.find((p) => p.id === turnId);
  const myTurn = turnId === youId && you.role === "player";
  const selectedTaken = state.takenNormalized.includes(normalizePick(selection));
  const upcoming = state.draftOrder.findIndex((s, index) => index > state.draftCursor && state.seatOrder[s] === youId);
  const pickLabel = `Pick ${state.draftCursor + 1}/${state.draftOrder.length}`;

  useEffect(() => {
    const timer = setTimeout(() => setQueue(loadIdeas(state.code, youId, topicId)), 0);
    return () => clearTimeout(timer);
  }, [state.code, youId, topicId]);
  useEffect(() => {
    const submitted = pending.current;
    if (!submitted || !state.picks.some((pick) => pick.playerId === youId && pick.turnIndex === submitted.turn && normalizePick(pick.text) === normalizePick(submitted.text))) return;
    pending.current = null;
    const timer = setTimeout(() => { setSelection(""); setBusy(false); }, 0);
    return () => clearTimeout(timer);
  }, [state.picks, youId]);
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setBusy(false), 1200);
    return () => clearTimeout(timer);
  }, [busy]);

  function persist(next: string[]) {
    setQueue(next);
    try { saveIdeas(state.code, youId, topicId, next); setSaveFailed(false); }
    catch { setSaveFailed(true); }
  }
  function addToQueue(text: string) {
    const clean = text.trim().slice(0, 48);
    if (!clean || queue.length >= 40 || queue.some((item) => normalizePick(item) === normalizePick(clean))) return;
    persist([...queue, clean]);
  }
  function lock() {
    if (!myTurn || !selection.trim() || selectedTaken || state.pickPaused || busy) return;
    pending.current = { text: selection.trim(), turn: state.draftCursor };
    setBusy(true);
    send({ type: "lock_in", text: selection.trim() });
  }

  const turnHint = state.phase === "CORRECTION"
    ? `Replace the ${state.correctionReason} pick`
    : myTurn
      ? "Type your answer"
      : upcoming < 0
        ? "Your four are in"
        : `You’re up in ${upcoming}`;

  return <div className="space-y-3 pb-36">
    <header className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{pickLabel}</p>
      <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold leading-tight">{state.selectedTopic?.text}</h2>
      <div
        className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ${myTurn ? "bg-[var(--yellow)] ring-2 ring-[var(--text)]" : "bg-white/70"}`}
        role="status"
        aria-live="polite"
      >
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold">{myTurn ? "Your turn" : `${turnPlayer?.name ?? "Player"}’s turn`}</p>
          <p className="text-sm text-[var(--muted)]">{turnHint}{state.pickPaused ? " · paused" : ""}</p>
        </div>
        <Countdown until={state.pickDeadlineAt} paused={state.pickPaused} />
      </div>
    </header>

    <DraftBoard state={state} youId={youId} isHost={you.isHost} send={send} />

    {you.role === "player" && (
      <div className="space-y-2">
        <button
          type="button"
          className="flex min-h-12 w-full items-center justify-between rounded-xl bg-white/60 px-3 text-sm font-bold"
          aria-expanded={ideasOpen}
          onClick={() => setIdeasOpen((open) => !open)}
        >
          <span>My Ideas{queue.length ? ` (${queue.length})` : ""}</span>
          <span aria-hidden>{ideasOpen ? "▴" : "▾"}</span>
        </button>
        {ideasOpen && (
          <section className="space-y-2" aria-label="Private idea queue">
            {queue.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Private list — Queue a typed answer while you wait.</p>
            ) : (
              <ul className="max-h-40 overflow-y-auto rounded-xl bg-white/60">
                {queue.map((text) => {
                  const taken = state.takenNormalized.includes(normalizePick(text));
                  return (
                    <li key={text} className="flex items-center border-b border-[var(--mint)] last:border-0">
                      <button
                        type="button"
                        className={`min-h-12 min-w-0 flex-1 break-words px-3 py-3 text-left text-sm ${taken ? "line-through opacity-50" : "font-bold"}`}
                        disabled={taken}
                        onClick={() => setSelection(text)}
                      >
                        {text}{taken ? " · taken" : ""}
                      </button>
                      <button
                        type="button"
                        className="min-h-12 min-w-12 text-xl"
                        aria-label={`Remove ${text}`}
                        onClick={() => persist(queue.filter((item) => item !== text))}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {saveFailed && <p className="text-xs" role="status">Ideas won’t survive a reload.</p>}
          </section>
        )}
      </div>
    )}

    {you.isHost && (
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1 !min-h-12" onClick={() => send({ type: state.pickPaused ? "host_resume" : "host_pause" })}>
          {state.pickPaused ? "Resume" : "Pause"}
        </button>
        <button type="button" className="btn-secondary flex-1 !min-h-12" onClick={() => send({ type: "host_extend" })}>
          +{RULES.hostExtendSeconds}s
        </button>
      </div>
    )}

    {you.role === "player" && (
      <section className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--mint)] bg-[var(--bg)]/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md space-y-2">
          <label className="sr-only" htmlFor="selected-pick">Your draft pick</label>
          <input
            id="selected-pick"
            className="field w-full text-base"
            placeholder={myTurn ? "Type your answer" : "Type while you wait"}
            value={selection}
            maxLength={48}
            autoComplete="off"
            onChange={(e) => setSelection(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") lock(); }}
          />
          {selectedTaken && <p className="text-sm font-bold" role="status">Taken — try another.</p>}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary flex-[2] text-lg"
              disabled={!myTurn || !selection.trim() || selectedTaken || state.pickPaused || busy}
              onClick={lock}
            >
              {busy ? "Locking…" : "Lock pick"}
            </button>
            <button
              type="button"
              className="btn-secondary flex-1"
              disabled={!selection.trim() || selectedTaken || queue.length >= 40 || queue.some((item) => normalizePick(item) === normalizePick(selection))}
              onClick={() => { addToQueue(selection); setIdeasOpen(true); }}
            >
              Queue
            </button>
          </div>
        </div>
      </section>
    )}
  </div>;
}
