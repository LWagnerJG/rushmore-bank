"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { DiceScene } from "@/components/dice/DiceScene";
import { RULES } from "@/shared/rules";

function Countdown({ until }: { until: number | null }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!until) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  return <span className="tabular-nums">{left}s</span>;
}

export function DicePanel({
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
  const rollerId = state.seatOrder[state.diceTurnSeat] ?? null;
  const roller = state.players.find((p) => p.id === rollerId);
  const myTurn = rollerId === youId;
  const pot = state.pots[youId] ?? 0;
  const personal = state.personalRollCounts[youId] ?? 0;
  const active = state.diceActiveIds.includes(youId);

  const reducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  return (
    <div className="space-y-4">
      <div className="panel space-y-1">
        <p className="text-xs font-bold uppercase text-[var(--muted)]">
          Dice · {state.diceSubphase} · lap {state.diceLapsCompleted}
        </p>
        <h2 className="font-extrabold">
          {roller?.name ?? "—"}&apos;s throw
        </h2>
        <p className="text-sm">
          Your pot: <strong>{pot}</strong> ◆ · personal rolls: {personal} (
          {personal < RULES.safePersonalRolls ? "safe" : "danger"})
        </p>
        {state.diceSubphase === "COOLDOWN" && (
          <p className="text-sm font-bold text-[var(--coral)]">
            Unlock in <Countdown until={state.diceDecisionDeadlineAt} />
          </p>
        )}
        {state.diceSubphase === "READY" && myTurn && (
          <p className="text-sm text-[var(--muted)]">
            Idle bank in <Countdown until={state.diceIdleDeadlineAt} />
          </p>
        )}
      </div>

      <DiceScene
        broadcast={state.lastDice}
        reducedMotion={reducedMotion}
        isHost={you.isHost}
      />

      {state.lastDice && (
        <p className="text-center text-sm font-bold">
          {state.lastDice.d1}+{state.lastDice.d2} · {state.lastDice.note}
        </p>
      )}

      {myTurn && active && you.role === "player" && (
        <div className="space-y-2">
          <button
            type="button"
            className="btn-danger w-full text-lg"
            disabled={state.diceSubphase !== "READY"}
            onClick={() => send({ type: "pull_out" })}
          >
            Pull Out
          </button>
          <button
            type="button"
            className="btn-primary w-full pulse-soft"
            disabled={state.diceSubphase !== "READY"}
            onClick={() => send({ type: "roll" })}
          >
            Roll
          </button>
        </div>
      )}

      <section className="panel space-y-1 text-sm">
        <h3 className="font-extrabold">Pots</h3>
        {state.diceActiveIds.map((pid) => {
          const p = state.players.find((x) => x.id === pid);
          return (
            <div key={pid} className="flex justify-between">
              <span>{p?.name}</span>
              <span>
                {state.pots[pid] ?? 0} ◆ · roll #
                {state.personalRollCounts[pid] ?? 0}
              </span>
            </div>
          );
        })}
        {state.diceActiveIds.length === 0 && (
          <p className="text-[var(--muted)]">No active pots</p>
        )}
      </section>

      {state.partyPrompt && !state.partyPrompt.resolved && (
        <div className="panel space-y-2 border-[var(--coral)]">
          <p className="font-extrabold">
            Party Mode · {state.partyPrompt.kind === "bust_sip" ? "Bust sip" : "Winner sip"}
          </p>
          <p className="text-sm">Optional one sip — no score effect.</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => send({ type: "party_resolve", choice: "done" })}
            >
              Done
            </button>
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => send({ type: "party_resolve", choice: "pass" })}
            >
              Pass
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
