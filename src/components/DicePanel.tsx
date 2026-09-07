"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { DiceScene } from "@/components/dice/DiceScene";
import { RULES } from "@/shared/rules";
import { bankQueue } from "@/shared/engine/bank-turn";

function Countdown({ until }: { until: number | null }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!until) return;
    const tick = () =>
      setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
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

  const queue = useMemo(
    () =>
      bankQueue({
        seatOrder: state.seatOrder,
        diceActiveIds: state.diceActiveIds,
        currentSeat: state.diceTurnSeat,
      }),
    [state.seatOrder, state.diceActiveIds, state.diceTurnSeat],
  );

  const revealed = state.lastDice?.revealed === true;
  const safeLeft = Math.max(0, RULES.safePersonalRolls - personal);

  const statusLine = (() => {
    if (rolling) {
      return myTurn
        ? "Your dice are in the air…"
        : `${roller?.name ?? "Player"} is rolling…`;
    }
    if (state.diceSubphase === "COOLDOWN") {
      return myTurn
        ? "Your bank — unlock soon"
        : `${roller?.name ?? "Player"}’s bank unlocks soon`;
    }
    if (state.diceSubphase === "READY") {
      return myTurn
        ? "Your bank — Roll or Bank"
        : active
          ? "You can Bank while you wait"
          : "Watch this bank turn";
    }
    return "Watching the table";
  })();

  return (
    <div className="space-y-4">
      <div className="panel space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
          Round {Math.min(state.topicRound + 1, state.configuredTopicRounds)} of{" "}
          {state.configuredTopicRounds} · Personal bank
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
          {myTurn ? "Your bank turn" : `${roller?.name ?? "—"}’s bank`}
        </h2>
        <p className="text-sm font-semibold">{statusLine}</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-[rgba(167,215,194,0.35)] px-3 py-2">
            <p className="text-xs font-bold uppercase text-[var(--muted)]">
              Protected
            </p>
            <p className="font-extrabold">
              {protectedBal} {RULES.currencyName}
            </p>
          </div>
          <div className="rounded-xl bg-[rgba(231,111,78,0.18)] px-3 py-2">
            <p className="text-xs font-bold uppercase text-[var(--muted)]">
              At risk
            </p>
            <p className="font-extrabold">
              {pot} {RULES.currencyName}
            </p>
          </div>
        </div>
        {active && (
          <p className="text-sm text-[var(--muted)]">
            {safeLeft > 0
              ? `${safeLeft} safe roll${safeLeft === 1 ? "" : "s"} left — can’t bust yet.`
              : "Danger: 7 busts · doubles double the pot."}
          </p>
        )}
        {state.diceSubphase === "COOLDOWN" && myTurn && (
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
              Roll
            </button>
          )}
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
          {!myTurn && (
            <p className="text-center text-xs text-[var(--muted)]">
              Waiting for {roller?.name ?? "them"}. Only your rolls change your
              pot — Bank anytime before your turn ends.
            </p>
          )}
        </div>
      )}

      {!active && you.role === "player" && (
        <p className="panel text-sm font-semibold">
          Your bank is done. You have {you.stones} beans safe.
        </p>
      )}

      <section className="panel space-y-1 text-sm">
        <h3 className="font-extrabold">Bank queue</h3>
        {queue.map((pid, idx) => {
          const p = state.players.find((x) => x.id === pid);
          return (
            <div key={pid} className="flex justify-between gap-2">
              <span>
                {idx === 0 ? "→ " : ""}
                {p?.name}
                {pid === youId ? " (you)" : ""}
              </span>
              <span>
                {state.pots[pid] ?? 0} · roll #
                {state.personalRollCounts[pid] ?? 0}
              </span>
            </div>
          );
        })}
        {queue.length === 0 && (
          <p className="text-[var(--muted)]">No pots left</p>
        )}
      </section>

      {state.partyPrompt && !state.partyPrompt.resolved && (
        <div className="panel space-y-2 border-[var(--coral)]">
          <p className="font-extrabold">
            Party ·{" "}
            {state.partyPrompt.kind === "bust_sip" ? "Bust sip" : "Winner sip"}
          </p>
          <p className="text-sm">Optional one sip — Pass is fine.</p>
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
