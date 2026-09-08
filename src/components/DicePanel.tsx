"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { DiceScene } from "@/components/dice/DiceScene";
import { RULES } from "@/shared/rules";
import { classifyPullOut } from "@/shared/engine/banking";

function Countdown({ until }: { until: number | null }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0);
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [until]);
  return <span className="tabular-nums">{left}s</span>;
}

export function DicePanel({ state, you, youId, send }: {
  state: PublicRoomState; you: Player; youId: string; send: (m: ClientMessage) => void;
}) {
  const rollerId = state.seatOrder[state.diceTurnSeat] ?? null;
  const roller = state.players.find((p) => p.id === rollerId);
  const myTurn = rollerId === youId;
  const pot = state.pots[youId] ?? 0;
  const active = state.diceActiveIds.includes(youId);
  const personal = state.personalRollCounts[youId] ?? 0;
  const rolling = state.diceSubphase === "COMMITTED";
  const canBank = you.role === "player" && classifyPullOut({
    phase: state.phase, diceSubphase: state.diceSubphase, playerId: youId,
    currentRollerId: rollerId, diceActiveIds: state.diceActiveIds, pot,
  }).ok;
  const canRoll = myTurn && active && you.role === "player" && state.diceSubphase === "READY";
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setBusy(false), 1000);
    return () => clearTimeout(timer);
  }, [busy]);
  const reducedMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const last = state.lastDice;
  const lastName = state.players.find((p) => p.id === last?.rollerId)?.name ?? "Player";
  const nextId = Array.from({ length: state.seatOrder.length - 1 }, (_, i) => state.seatOrder[(state.diceTurnSeat + i + 1) % state.seatOrder.length]).find((id) => state.diceActiveIds.includes(id));
  const nextName = state.players.find((p) => p.id === nextId)?.name;
  const partyPrompt = state.partyPrompt;
  const canResolveParty = partyPrompt?.targetPlayerIds.includes(youId) || you.isHost;

  function act(message: ClientMessage) {
    if (busy) return;
    setBusy(true);
    send(message);
  }

  return <div className="space-y-4">
    <header className="space-y-1 text-center">
      <h2 className="text-2xl font-extrabold">{myTurn ? "Your roll" : `${roller?.name ?? "Player"}’s roll`}</h2>
      <p className="min-h-6 text-sm" aria-live="polite">
        {rolling ? "Rolling…" : state.diceSubphase === "COOLDOWN" ? <>Opens in <Countdown until={state.diceDecisionDeadlineAt} /></> : myTurn ? <><Countdown until={state.diceIdleDeadlineAt} /></> : nextName ? `Next: ${nextName}` : "Last in"}
      </p>
    </header>

    <DiceScene broadcast={last} reducedMotion={reducedMotion} isHost={you.isHost} />
    <p className="min-h-6 text-center text-sm font-bold" role="status">
      {last?.revealed ? `${lastName}: ${last.d1} + ${last.d2} · ${last.busted ? "Busted" : last.note}` : "\u00a0"}
    </p>

    {you.role === "player" && <section className="panel space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div><p className="text-sm">Your pot</p><p className="text-3xl font-extrabold tabular-nums">{pot}</p></div>
        <p className="text-right text-sm"><strong>{active ? state.protectedStones[youId] ?? you.stones : you.stones}</strong> safe</p>
      </div>
      {active ? <>
        <p className="text-sm text-[var(--muted)]">{personal < RULES.safePersonalRolls ? `${RULES.safePersonalRolls - personal} safe left · 7 = +70` : "7 busts · doubles ×2"}</p>
        <div className="flex gap-2">
          {myTurn && <button className="btn-primary flex-1 text-lg" disabled={!canRoll || busy} onClick={() => { if (canRoll) act({ type: "roll" }); }}>Roll</button>}
          <button className="btn-secondary flex-1" disabled={!canBank || busy} onClick={() => { if (canBank) act({ type: "pull_out" }); }}>{pot === 0 ? "Bank out" : `Bank ${pot}`}</button>
        </div>
      </> : <p className="text-sm text-[var(--muted)]">Out this round.</p>}
    </section>}

    <details className="panel text-sm">
      <summary className="min-h-11 cursor-pointer font-bold">Table</summary>
      <div className="mt-2 space-y-1" aria-label="Dice turn order">
        {state.seatOrder.map((pid) => {
          const player = state.players.find((p) => p.id === pid);
          const inRound = state.diceActiveIds.includes(pid);
          const bust = state.ledger.some((e) => e.topicRound === state.topicRound && e.playerId === pid && e.kind === "bust");
          const status = !inRound ? bust ? "Busted" : "Banked" : pid === rollerId ? "Rolling" : pid === nextId ? "Next" : "In";
          return <div key={pid} className={`flex items-center justify-between gap-3 rounded-lg px-2 py-2 ${pid === rollerId && inRound ? "bg-[var(--mint)] font-bold" : ""}`}>
            <span>{player?.name}{pid === youId ? " (you)" : ""}</span>
            <span className="text-right tabular-nums">{inRound ? `${state.pots[pid] ?? 0} · ${status}` : `${player?.stones ?? 0} · ${status}`}</span>
          </div>;
        })}
      </div>
    </details>
    {partyPrompt && !partyPrompt.resolved && <section className="panel space-y-2">
      <p className="font-bold">{partyPrompt.targetPlayerIds.map((id) => state.players.find((p) => p.id === id)?.name).join(", ")} · optional sip</p>
      {canResolveParty && <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={() => send({ type: "party_resolve", choice: "done" })}>Done</button>
        <button className="btn-secondary flex-1" onClick={() => send({ type: "party_resolve", choice: "pass" })}>Pass</button>
      </div>}
    </section>}
  </div>;
}
