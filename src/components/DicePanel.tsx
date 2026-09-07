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
  const protectedBal = state.protectedStones[youId] ?? you.stones;
  const personal = state.personalRollCounts[youId] ?? 0;
  const active = state.diceActiveIds.includes(youId);
  const rolling = state.diceSubphase === "COMMITTED";
  const canBank =
    active &&
    you.role === "player" &&
    pot > 0 &&
    !(myTurn && state.diceSubphase === "COMMITTED");
  const canRoll =
    myTurn && active && you.role === "player" && state.diceSubphase === "READY";

  const [pullBusy, setPullBusy] = useState(false);
  const [rollBusy, setRollBusy] = useState(false);

  const reducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const revealed = state.lastDice?.revealed === true;
  const statusLine = (() => {
    if (rolling) {
      return myTurn
        ? "Your dice are in the air…"
        : `${roller?.name ?? "Player"} is rolling…`;
    }
    if (state.diceSubphase === "COOLDOWN") {
      return myTurn
        ? "Your turn — unlock soon"
        : `${roller?.name ?? "Player"} unlocks soon`;
    }
    if (state.diceSubphase === "READY") {
      return myTurn ? "Your turn. Roll or bank your beans." : active ? "You can bank your beans while you wait." : "Watch the next throw.";
    }
    return "Watching the table";
  })();

  return (
    <div className="space-y-4">
      <div className="panel space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
          Round {Math.min(state.topicRound + 1, state.configuredTopicRounds)} of{" "}
          {state.configuredTopicRounds} · Dice
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
          {roller?.name ?? "—"}&apos;s throw
        </h2>
        <p className="text-sm font-semibold">{statusLine}</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-[rgba(167,215,194,0.35)] px-3 py-2">
            <p className="text-xs font-bold uppercase text-[var(--muted)]">
              Safe beans
            </p>
            <p className="font-extrabold">
              {protectedBal} {RULES.currencyName}
            </p>
          </div>
          <div className="rounded-xl bg-[rgba(231,111,78,0.18)] px-3 py-2">
            <p className="text-xs font-bold uppercase text-[var(--muted)]">
              Dice pot
            </p>
            <p className="font-extrabold">
              {pot} {RULES.currencyName}
            </p>
          </div>
        </div>
        <p className="text-sm text-[var(--muted)]">
          {active ? (personal < RULES.safePersonalRolls ? String(RULES.safePersonalRolls - personal) + " safe rolls left. You cannot bust yet." : "Your next roll: 7 busts, doubles double your pot.") : "Your dice round is over."}
        </p>
        {state.diceSubphase === "COOLDOWN" && (
          <p className="text-sm font-bold text-[var(--coral)]">
            Unlock in <Countdown until={state.diceDecisionDeadlineAt} />
          </p>
        )}
        {state.diceSubphase === "READY" && myTurn && (
          <p className="text-sm text-[var(--muted)]">
            Auto-bank in <Countdown until={state.diceIdleDeadlineAt} />
          </p>
        )}
      </div>

      <DiceScene
        broadcast={state.lastDice}
        reducedMotion={reducedMotion}
        isHost={you.isHost}
      />

      {revealed && state.lastDice?.d1 != null && state.lastDice.d2 != null && (
        <p className="text-center text-sm font-bold animate-rise">
          {state.lastDice.d1}+{state.lastDice.d2} · {state.lastDice.note}
          {state.lastDice.busted ? " · Busted" : ""}
        </p>
      )}
      {rolling && (
        <p className="text-center text-sm font-semibold text-[var(--muted)]">
          Dice tumbling…
        </p>
      )}

      {you.role === "player" && active && (
        <div className="space-y-2">
          <button
            type="button"
            className="btn-danger w-full text-lg"
            disabled={!canBank || pullBusy}
            onClick={() => {
              if (!canBank || pullBusy) return;
              setPullBusy(true);
              send({ type: "pull_out" });
              setTimeout(() => setPullBusy(false), 800);
            }}
          >
            Bank {pot} {RULES.currencyName}
          </button>
          {myTurn && (
            <button
              type="button"
              className="btn-primary w-full pulse-soft text-lg"
              disabled={!canRoll || rollBusy}
              onClick={() => {
                if (!canRoll || rollBusy) return;
                setRollBusy(true);
                send({ type: "roll" });
                setTimeout(() => setRollBusy(false), 800);
              }}
            >
              Roll the dice
            </button>
          )}
          {!myTurn && (
            <p className="text-center text-xs text-[var(--muted)]">
              Waiting for {roller?.name ?? "roller"}. Only your own rolls affect your pot.
            </p>
          )}
        </div>
      )}

      {!active && you.role === "player" && (
        <p className="panel text-sm font-semibold">
          Your dice round is over. You have {you.stones} beans safe.
        </p>
      )}

      <section className="panel space-y-1 text-sm">
        <h3 className="font-extrabold">Still in</h3>
        {state.diceActiveIds.map((pid) => {
          const p = state.players.find((x) => x.id === pid);
          const isNext = pid === rollerId;
          return (
            <div key={pid} className="flex justify-between gap-2">
              <span>
                {isNext ? "→ " : ""}
                {p?.name}
                {pid === youId ? " (you)" : ""}
              </span>
              <span>
                {state.pots[pid] ?? 0}  beans · roll #
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
            Party Mode ·{" "}
            {state.partyPrompt.kind === "bust_sip" ? "Bust sip" : "Winner sip"}
          </p>
          <p className="text-sm">Optional one sip — Pass is fine. No score effect.</p>
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
