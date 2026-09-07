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
  return <span className="text-2xl font-extrabold tabular-nums">{paused ? "Paused" : `${left}s`}</span>;
}

export function DraftPanel({ state, you, youId, send }: {
  state: PublicRoomState; you: Player; youId: string; send: (m: ClientMessage) => void;
}) {
  const [tab, setTab] = useState<"available" | "queue" | "board">("available");
  const [search, setSearch] = useState("");
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
  const available = (state.draftOptions ?? []).filter((text) => !state.takenNormalized.includes(normalizePick(text)) && normalizePick(text).includes(normalizePick(search))).sort((a, b) => a.localeCompare(b));
  const selectedTaken = state.takenNormalized.includes(normalizePick(selection));
  const upcoming = state.draftOrder.findIndex((s, index) => index > state.draftCursor && state.seatOrder[s] === youId);
  const myPicks = state.picks.filter((pick) => pick.playerId === youId);

  useEffect(() => {
    const timer = setTimeout(() => setQueue(loadIdeas(state.code, youId, topicId)), 0);
    return () => clearTimeout(timer);
  }, [state.code, youId, topicId]);
  useEffect(() => {
    const submitted = pending.current;
    if (!submitted || !state.picks.some((pick) => pick.playerId === youId && pick.turnIndex === submitted.turn && normalizePick(pick.text) === normalizePick(submitted.text))) return;
    pending.current = null;
    const timer = setTimeout(() => { setSelection(""); setSearch(""); setBusy(false); }, 0);
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

  return <div className="space-y-4">
    <header className="space-y-2">
      <p className="text-xs font-bold uppercase text-[var(--muted)]">Pick {state.draftCursor + 1} of {state.draftOrder.length} · Snake draft</p>
      <h2 className="text-xl font-extrabold">{state.selectedTopic?.text}</h2>
      <div className={`flex items-center justify-between gap-3 rounded-xl p-3 ${myTurn ? "bg-[var(--yellow)]" : "bg-white/65"}`}>
        <div><p className="font-extrabold">{myTurn ? "You’re on the clock" : `${turnPlayer?.name ?? "Player"} is picking`}</p><p className="text-xs">{state.phase === "CORRECTION" ? `Replace the ${state.correctionReason} pick` : myTurn ? "Choose one answer" : upcoming < 0 ? "Your four picks are in" : `Your next pick: ${upcoming + 1}`}</p></div>
        <Countdown until={state.pickDeadlineAt} paused={state.pickPaused} />
      </div>
      {state.selectedTopic?.scopeBoundary && <p className="text-xs text-[var(--muted)]">{state.selectedTopic.scopeBoundary}</p>}
    </header>

    <div className="flex rounded-xl bg-white/70 p-1" aria-label="Draft views">
      {(["available", "queue", "board"] as const).map((value) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-bold ${tab === value ? "bg-[var(--text)] text-white" : ""}`}>{value === "queue" ? `My queue (${queue.length})` : value === "available" ? "Available" : "Board"}</button>)}
    </div>

    {tab === "board" ? <DraftBoard state={state} youId={youId} isHost={you.isHost} send={send} /> : <section className="space-y-2">
      {tab === "available" ? <>
        <label className="sr-only" htmlFor="draft-search">Search or add an answer</label>
        <input id="draft-search" className="field w-full" placeholder="Search or add your own…" value={search} maxLength={48} onChange={(e) => setSearch(e.target.value)} />
        {search.trim() && !state.takenNormalized.includes(normalizePick(search)) && !available.some((item) => normalizePick(item) === normalizePick(search)) && <button type="button" className="btn-secondary w-full text-left" onClick={() => setSelection(search.trim())}>Use “{search.trim()}”</button>}
        <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--mint)] bg-white/60">
          {available.map((text) => <div key={text} className={`flex border-b border-[var(--mint)] last:border-0 ${selection === text ? "bg-[var(--mint)]" : ""}`}>
            <button type="button" className="min-h-12 min-w-0 flex-1 break-words px-3 py-3 text-left text-sm font-semibold" aria-pressed={selection === text} onClick={() => setSelection(text)}>{text}</button>
            {you.role === "player" && <button type="button" className="min-h-12 min-w-12 px-3 text-xl" aria-label={`Queue ${text}`} disabled={queue.length >= 40 || queue.some((item) => normalizePick(item) === normalizePick(text))} onClick={() => addToQueue(text)}>+</button>}
          </div>)}
          {available.length === 0 && <p className="p-4 text-sm text-[var(--muted)]">{state.draftOptionsStatus === "pending" ? "Loading suggestions. You can add your own now." : "Add your own answer above."}</p>}
        </div>
        <p className="text-xs text-[var(--muted)]">Suggestions are starting points. Any answer that fits can be drafted.</p>
      </> : <>
        <p className="text-xs text-[var(--muted)]">Only you can see this list.</p>
        {queue.length === 0 && <p className="panel text-sm">Tap + beside a pick to save it here.</p>}
        <ul className="max-h-72 overflow-y-auto rounded-xl bg-white/60">{queue.map((text) => {
          const taken = state.takenNormalized.includes(normalizePick(text));
          return <li key={text} className="flex items-center border-b border-[var(--mint)] last:border-0">
            <button type="button" className={`min-h-12 min-w-0 flex-1 break-words px-3 py-3 text-left text-sm ${taken ? "line-through opacity-50" : "font-bold"}`} disabled={taken} onClick={() => setSelection(text)}>{text}{taken ? " · taken" : ""}</button>
            <button type="button" className="min-h-12 min-w-12 text-xl" aria-label={`Remove ${text} from queue`} onClick={() => persist(queue.filter((item) => item !== text))}>×</button>
          </li>;
        })}</ul>
        {saveFailed && <p className="text-xs" role="status">Your queue will be lost if you reload.</p>}
      </>}
    </section>}

    {you.role === "player" && <section className="sticky bottom-0 z-10 -mx-4 space-y-2 border-t border-[var(--mint)] bg-[var(--bg)] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
      <label className="sr-only" htmlFor="selected-pick">Your draft pick</label>
      <input id="selected-pick" className="field w-full" placeholder="Select a pick or type your own" value={selection} maxLength={48} onChange={(e) => setSelection(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") lock(); }} />
      {selectedTaken && <p className="text-sm font-bold" role="status">That answer was taken. Choose another.</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-primary flex-1" disabled={!myTurn || !selection.trim() || selectedTaken || state.pickPaused || busy} onClick={lock}>{busy ? "Locking…" : myTurn ? "Lock pick" : "Waiting for your turn"}</button>
        <button type="button" className="btn-secondary" disabled={!selection.trim() || selectedTaken || queue.length >= 40 || queue.some((item) => normalizePick(item) === normalizePick(selection))} onClick={() => addToQueue(selection)}>Queue</button>
      </div>
    </section>}
    <details className="text-sm"><summary className="min-h-11 cursor-pointer font-bold">My picks ({myPicks.length}/4)</summary><ol className="list-inside list-decimal space-y-1">{myPicks.map((pick) => <li key={pick.turnIndex}>{pick.text}</li>)}</ol></details>
    {you.isHost && <details><summary className="min-h-11 cursor-pointer text-sm font-bold">Host controls</summary><div className="flex gap-2">
      <button className="btn-secondary flex-1" onClick={() => send({ type: state.pickPaused ? "host_resume" : "host_pause" })}>{state.pickPaused ? "Resume" : "Pause"}</button>
      <button className="btn-secondary flex-1" onClick={() => send({ type: "host_extend" })}>+{RULES.hostExtendSeconds}s</button>
    </div></details>}
  </div>;
}
