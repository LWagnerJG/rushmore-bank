"use client";

import { useEffect, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { maxWager, wagerFromPreset } from "@/shared/engine/wager";

export function WagerPanel({ state, you, youId, send }: {
  state: PublicRoomState; you: Player; youId: string; send: (m: ClientMessage) => void;
}) {
  const earned = state.earnedThisRound[youId] ?? 0;
  const banked = you.stones;
  const max = maxWager(earned, banked);
  const locked = state.wagers[youId];
  const [selection, setSelection] = useState(String(wagerFromPreset("half_new", earned, banked)));
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
  const valid = selection.trim() !== "" && Number.isSafeInteger(amount) && amount >= 0 && amount <= max;
  const kept = valid ? banked + earned - amount : null;
  const options = [
    { label: "Keep all", amount: 0 },
    { label: "Roll half", amount: wagerFromPreset("half_new", earned, banked) },
    { label: "Roll this round", amount: earned },
  ];

  if (you.role !== "player") return <p className="panel">Everyone is choosing how many beans to roll.</p>;
  if (locked !== undefined) return <section className="panel space-y-2 text-center" aria-live="polite">
    <h2 className="text-xl font-extrabold">{locked === 0 ? "Your beans are safe." : "You're in."}</h2>
    <p>{locked === 0 ? "Sit back and watch the dice." : locked + " beans ready to roll."}</p>
    <p className="text-sm text-[var(--muted)]">Waiting for the others…</p>
  </section>;

  return <div className="space-y-4">
    <header className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-extrabold">How many beans?</h2>
        {left !== null && <span className="text-sm font-bold tabular-nums">{left}s</span>}
      </div>
      <p>You earned <strong>{earned} beans</strong> this round.</p>
      <p className="text-sm text-[var(--muted)]">Keep them safe, or put some in your dice pot.</p>
    </header>
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => <button key={option.label} type="button" className={"btn-secondary !px-2 text-sm " + (valid && amount === option.amount ? "ring-2 ring-[var(--text)]" : "")} aria-pressed={valid && amount === option.amount} onClick={() => setSelection(String(option.amount))}>
        <span className="block">{option.label}</span>
        <span className="mt-1 block text-lg font-extrabold">{option.amount}</span>
      </button>)}
    </div>
    <section className="panel grid grid-cols-2 gap-4 text-center" aria-live="polite">
      <div><p className="text-sm text-[var(--muted)]">Staying safe</p><p className="text-3xl font-extrabold">{kept ?? "—"}</p><p className="text-sm">beans</p></div>
      <div><p className="text-sm text-[var(--muted)]">Ready to roll</p><p className="text-3xl font-extrabold">{valid ? amount : "—"}</p><p className="text-sm">beans</p></div>
    </section>
    <details className="panel space-y-3">
      <summary className="cursor-pointer font-bold">Choose another amount</summary>
      <label htmlFor="bean-wager" className="block pt-3 text-sm">Beans to roll, from 0 to {max}</label>
      <input id="bean-wager" className="field w-full" type="number" inputMode="numeric" min={0} max={max} step={1} value={selection} onChange={(e) => setSelection(e.target.value)} aria-invalid={!valid} />
      <p className="text-xs text-[var(--muted)]">You can add up to {Math.min(RULES.earlierWagerCap, banked)} beans from earlier winnings.</p>
    </details>
    {!valid && <p role="alert" className="text-sm font-bold">Choose a whole number between 0 and {max}.</p>}
    <button type="button" className="btn-danger w-full text-lg" disabled={!valid || busy} onClick={() => { if (!valid || busy) return; setBusy(true); send({ type: "submit_wager", amount }); }}>
      {busy ? "Locking…" : amount === 0 ? "Keep all my beans" : "Roll with " + amount + " beans"}
    </button>
    <p className="text-center text-xs text-[var(--muted)]">No choice in time? All your beans stay safe.</p>
  </div>;
}
