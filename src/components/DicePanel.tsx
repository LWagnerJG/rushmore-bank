"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { DiceScene } from "@/components/dice/DiceScene";
import { RULES } from "@/shared/rules";
import { classifyPullOut } from "@/shared/engine/banking";

function Countdown({ until }: { until: number | null }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () =>
      setLeft(until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0);
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [until]);
  return <span className="tabular-nums">{left}s</span>;
}

type SeatKind = "up" | "next" | "in" | "banked" | "busted";

function seatKind(
  pid: string,
  rollerId: string | null,
  nextId: string | undefined,
  inRound: boolean,
  busted: boolean,
): SeatKind {
  if (!inRound) return busted ? "busted" : "banked";
  if (pid === rollerId) return "up";
  if (pid === nextId) return "next";
  return "in";
}

const BADGE: Record<SeatKind, { label: string; className: string }> = {
  up: { label: "Up", className: "dice-seat-badge-up" },
  next: { label: "Next", className: "dice-seat-badge-next" },
  in: { label: "In", className: "" },
  banked: { label: "Banked", className: "dice-seat-badge-banked" },
  busted: { label: "Bust", className: "dice-seat-badge-bust" },
};

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
  const rollerPot = rollerId ? (state.pots[rollerId] ?? 0) : 0;
  const active = state.diceActiveIds.includes(youId);
  const personal = state.personalRollCounts[youId] ?? 0;
  const rolling = state.diceSubphase === "COMMITTED";
  const canBank =
    you.role === "player" &&
    classifyPullOut({
      phase: state.phase,
      diceSubphase: state.diceSubphase,
      playerId: youId,
      currentRollerId: rollerId,
      diceActiveIds: state.diceActiveIds,
      pot,
    }).ok;
  const canRoll =
    myTurn &&
    active &&
    you.role === "player" &&
    state.diceSubphase === "READY";
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setBusy(false), 1000);
    return () => clearTimeout(timer);
  }, [busy]);
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const last = state.lastDice;
  const lastName =
    state.players.find((p) => p.id === last?.rollerId)?.name ?? "Player";
  const nextId = Array.from(
    { length: state.seatOrder.length - 1 },
    (_, i) =>
      state.seatOrder[(state.diceTurnSeat + i + 1) % state.seatOrder.length],
  ).find((id) => id && state.diceActiveIds.includes(id));
  const partyPrompt = state.partyPrompt;
  const canResolveParty =
    partyPrompt?.targetPlayerIds.includes(youId) || you.isHost;

  const seats = state.seatOrder.map((pid) => {
    const player = state.players.find((p) => p.id === pid);
    const inRound = state.diceActiveIds.includes(pid);
    const bust = state.ledger.some(
      (e) =>
        e.topicRound === state.topicRound &&
        e.playerId === pid &&
        e.kind === "bust",
    );
    const kind = seatKind(pid, rollerId, nextId, inRound, bust);
    return {
      pid,
      name: player?.name ?? "Player",
      kind,
      pot: state.pots[pid] ?? 0,
      safe: inRound
        ? (state.protectedStones[pid] ?? player?.stones ?? 0)
        : (player?.stones ?? 0),
      you: pid === youId,
    };
  });

  function act(message: ClientMessage) {
    if (busy) return;
    setBusy(true);
    send(message);
  }

  const statusLine = rolling ? (
    "Rolling…"
  ) : state.diceSubphase === "COOLDOWN" ? (
    <>
      Opens in <Countdown until={state.diceDecisionDeadlineAt} />
    </>
  ) : myTurn ? (
    <>
      <Countdown until={state.diceIdleDeadlineAt} /> to bank or roll
    </>
  ) : (
    "Watch the table"
  );

  return (
    <div className="space-y-4">
      <section className="dice-round-table" aria-label="Round table">
        <p className="px-1 pb-0.5 text-[0.7rem] font-extrabold uppercase tracking-wide text-[var(--muted)]">
          Table
        </p>
        {seats.map((seat) => {
          const badge = BADGE[seat.kind];
          return (
            <div
              key={seat.pid}
              className={[
                "dice-seat",
                seat.kind === "up" ? "dice-seat-up" : "",
                seat.kind === "next" ? "dice-seat-next" : "",
                seat.kind === "banked" || seat.kind === "busted"
                  ? "dice-seat-out"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">
                  {seat.name}
                  {seat.you ? " · you" : ""}
                </p>
                <p className="text-xs tabular-nums text-[var(--muted)]">
                  {seat.kind === "banked" || seat.kind === "busted"
                    ? `${seat.safe} safe`
                    : `pot ${seat.pot}`}
                </p>
              </div>
              <span className={`dice-seat-badge ${badge.className}`}>
                {badge.label}
              </span>
            </div>
          );
        })}
      </section>

      <header className="space-y-1 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
          {myTurn ? "Your roll" : `${roller?.name ?? "Player"} is up`}
        </h2>
        <p className="min-h-6 text-sm text-[var(--muted)]" aria-live="polite">
          {statusLine}
        </p>
      </header>

      <DiceScene
        broadcast={last}
        reducedMotion={reducedMotion}
        isHost={you.isHost}
      />
      <p className="min-h-5 text-center text-sm font-bold" role="status">
        {last?.revealed
          ? `${lastName}: ${last.d1} + ${last.d2} · ${last.busted ? "Busted" : last.note}`
          : myTurn
            ? "\u00a0"
            : `Pot ${rollerPot}`}
      </p>

      {you.role === "player" && (
        <section className="dice-action-focus space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--muted)]">
                {myTurn ? "Your pot" : "Your beans"}
              </p>
              <p className="text-4xl font-extrabold tabular-nums leading-none">
                {active ? pot : you.stones}
              </p>
            </div>
            {active && (
              <p className="text-right text-sm text-[var(--muted)]">
                <strong className="text-[var(--text)]">
                  {state.protectedStones[youId] ?? you.stones}
                </strong>{" "}
                safe
                {myTurn && personal < RULES.safePersonalRolls ? (
                  <>
                    <br />
                    {RULES.safePersonalRolls - personal} safe roll
                    {RULES.safePersonalRolls - personal === 1 ? "" : "s"} left
                  </>
                ) : null}
              </p>
            )}
          </div>

          {!active ? (
            <p className="text-sm font-semibold text-[var(--muted)]">
              You’re out this round — watch the table.
            </p>
          ) : myTurn ? (
            <div className="flex flex-col gap-2">
              <button
                className="btn-primary w-full text-lg"
                disabled={!canRoll || busy}
                onClick={() => {
                  if (canRoll) act({ type: "roll" });
                }}
              >
                Roll
              </button>
              <button
                className="btn-secondary w-full"
                disabled={!canBank || busy}
                onClick={() => {
                  if (canBank) act({ type: "pull_out" });
                }}
              >
                {pot === 0 ? "Bank out" : `Bank ${pot}`}
              </button>
            </div>
          ) : (
            <button
              className="btn-secondary w-full"
              disabled={!canBank || busy}
              onClick={() => {
                if (canBank) act({ type: "pull_out" });
              }}
            >
              {pot === 0 ? "Bank out" : `Bank ${pot} · sit out`}
            </button>
          )}
        </section>
      )}

      {partyPrompt && !partyPrompt.resolved && (
        <section className="panel space-y-2">
          <p className="font-bold">
            {partyPrompt.targetPlayerIds
              .map((id) => state.players.find((p) => p.id === id)?.name)
              .join(", ")}{" "}
            · optional sip
          </p>
          {canResolveParty && (
            <div className="flex gap-2">
              <button
                className="btn-primary flex-1"
                onClick={() => send({ type: "party_resolve", choice: "done" })}
              >
                Done
              </button>
              <button
                className="btn-secondary flex-1"
                onClick={() => send({ type: "party_resolve", choice: "pass" })}
              >
                Pass
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
