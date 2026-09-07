"use client";

import { useEffect, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { maxWager } from "@/shared/engine/wager";

export function WagerPanel({ state, you, youId, send }: {
  state: PublicRoomState; you: Player; youId: string; send: (m: ClientMessage) => void;
}) {
  const earned = state.earnedThisRound[youId] ?? 0;
  const total = maxWager(earned, you.stones);
  const locked = state.wagers[youId];
  const [selection, setSelection] = useState(String(Math.floor(earned / 2)));
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const tick = () => setLeft(state.wagerDeadlineAt ? Math.max(0, Math.ceil((state.wagerDeadlineAt - Date.now()) / 1000)) : null);
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [state.wagerDeadlineAt]);
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setBusy(false), 1200);
    return () => clearTimeout(timer);
  }, [busy]);
  const amount = Number(selection);
  const valid = selection.trim() !== "" && Number.isSafeInteger(amount) && amount >= 0 && amount <= total;

  if (you.role !== "player") return <p className="panel">Everyone is choosing their wager.</p>;
  if (locked !== undefined) return <section className="panel space-y-2 text-center" aria-live="polite">
    <h2 className="text-2xl font-extrabold">{locked} beans in.</h2>
    <p>{total - locked} stay safe. You still get to roll.</p>
    <p className="text-sm text-[var(--muted)]">Waiting for the others…</p>
  </section>;

  return <div className="space-y-5">
    <header className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold">What’s your wager?</h2>
        {left !== null && <span className="font-bold tabular-nums">{left}s</span>}
      </div>
      <p className="text-sm text-[var(--muted)]">{total} beans available · {earned} earned this round</p>
    </header>
    <section className="panel space-y-5">
      <div className="text-center">
        <label htmlFor="bean-wager-amount" className="block text-sm font-bold">Beans to wager</label>
        <input id="bean-wager-amount" className="mx-auto block w-40 rounded-lg bg-transparent p-2 text-center text-5xl font-extrabold tabular-nums focus:outline-2 focus:outline-[var(--coral)]" type="number" inputMode="numeric" min={0} max={total} step={1} value={selection} onChange={(e) => setSelection(e.target.value)} aria-invalid={!valid} />
      </div>
      <div>
        <input aria-label="Wager slider" className="bean-slider w-full" type="range" min={0} max={total} step={1} value={valid ? amount : 0} onChange={(e) => setSelection(e.target.value)} aria-valuetext={`${valid ? amount : 0} beans wagered, ${valid ? total - amount : total} safe`} />
        <div className="flex justify-between text-sm"><span>0</span><span>{total}</span></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[{ label: "None", value: 0 }, { label: "Half", value: Math.floor(total / 2) }, { label: "All in", value: total }].map(({ label, value }) => <button key={label} className="btn-secondary !px-2 text-sm" type="button" aria-pressed={valid && amount === value} onClick={() => setSelection(String(value))}>{label}</button>)}
      </div>
      <p className="text-center text-sm" aria-live="polite"><strong>{valid ? total - amount : "—"} beans</strong> stay safe.</p>
    </section>
    {!valid && <p role="alert" className="text-sm font-bold">Choose a whole number from 0 to {total}.</p>}
    <button type="button" className="btn-primary w-full text-lg" disabled={!valid || busy} onClick={() => { if (!valid || busy) return; setBusy(true); send({ type: "submit_wager", amount }); }}>
      {busy ? "Locking…" : `Lock ${valid ? amount : ""} beans`}
    </button>
    <p className="text-center text-sm text-[var(--muted)]">Everyone rolls, even with 0 wagered. No choice in time? We wager 0.</p>
  </div>;
}
