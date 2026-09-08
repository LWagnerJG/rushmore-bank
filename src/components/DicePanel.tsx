"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { DiceScene } from "@/components/dice/DiceScene";
import { RULES } from "@/shared/rules";
import { classifyPullOut } from "@/shared/engine/banking";
import { haptic } from "@/lib/haptics";
import { ensureDiceAudio, playBankChime } from "@/lib/dice-sfx";

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

const BADGE: Record<SeatKind, string> = {
  up: "Up",
  next: "Next",
  in: "In",
  banked: "Banked",
  busted: "Bust",
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
  const glowOn = myTurn && active && you.role === "player";
  const [busy, setBusy] = useState(false);
  const turnHaptic = useRef<string | null>(null);
  const revealSeen = useRef<string | null>(null);
  const [heroReveal, setHeroReveal] = useState(false);

  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setBusy(false), 1000);
    return () => clearTimeout(timer);
  }, [busy]);

  // Soft haptic when your turn becomes READY.
  useEffect(() => {
    if (!glowOn || state.diceSubphase !== "READY") return;
    const key = `${state.diceTurnSeat}-${state.diceSubphase}-${state.phaseRevision}`;
    if (turnHaptic.current === key) return;
    turnHaptic.current = key;
    haptic("your_turn");
  }, [glowOn, state.diceSubphase, state.diceTurnSeat, state.phaseRevision]);

  // Full-phone perimeter glow on <html> so it isn’t trapped by transform parents.
  useEffect(() => {
    const root = document.documentElement;
    if (glowOn) root.classList.add("dice-your-turn");
    else root.classList.remove("dice-your-turn");
    return () => root.classList.remove("dice-your-turn");
  }, [glowOn]);

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

  // Dramatic result beat when faces first reveal.
  useEffect(() => {
    if (!last?.revealed || !last.rollId) return;
    if (revealSeen.current === last.rollId) return;
    revealSeen.current = last.rollId;
    const on = window.setTimeout(() => setHeroReveal(true), 0);
    const off = window.setTimeout(() => setHeroReveal(false), 1600);
    return () => {
      window.clearTimeout(on);
      window.clearTimeout(off);
    };
  }, [last?.revealed, last?.rollId]);

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

  async function bank() {
    if (!canBank || busy) return;
    haptic(pot === 0 ? "bank" : "bank");
    try {
      const ctx = await ensureDiceAudio();
      playBankChime(ctx);
    } catch {
      /* ignore */
    }
    act({ type: "pull_out" });
  }

  const statusLine = rolling ? (
    "Rolling…"
  ) : state.diceSubphase === "COOLDOWN" ? (
    <>
      Opens in <Countdown until={state.diceDecisionDeadlineAt} />
    </>
  ) : myTurn && canRoll ? (
    <>
      Tap the dice · <Countdown until={state.diceIdleDeadlineAt} />
    </>
  ) : myTurn ? (
    <>
      <Countdown until={state.diceIdleDeadlineAt} />
    </>
  ) : (
    "Watch the table"
  );

  const revealed = !!last?.revealed;
  const total =
    revealed && last?.d1 != null && last?.d2 != null ? last.d1 + last.d2 : null;

  return (
    <div className={`space-y-4 ${heroReveal ? "dice-hero-mode" : ""}`}>
      <ol
        className={`dice-turn-strip ${heroReveal || rolling ? "dice-table-dim" : ""}`}
        aria-label="Turn order"
      >
        {seats.map((seat) => (
          <li
            key={seat.pid}
            className={[
              "dice-turn-chip",
              seat.kind === "up" ? "dice-turn-chip-up" : "",
              seat.kind === "next" ? "dice-turn-chip-next" : "",
              seat.kind === "banked" || seat.kind === "busted"
                ? "dice-turn-chip-out"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="dice-turn-chip-name">
              {seat.name}
              {seat.you ? " · you" : ""}
            </span>
            <span className="dice-turn-chip-meta">
              {BADGE[seat.kind]}
              {" · "}
              {seat.kind === "banked" || seat.kind === "busted"
                ? `${seat.safe} safe`
                : `pot ${seat.pot}`}
            </span>
          </li>
        ))}
      </ol>

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
        canRoll={canRoll && !busy}
        busted={!!last?.busted}
        onRoll={() => {
          if (canRoll) act({ type: "roll" });
        }}
      />

      <div
        className={`dice-result-readout ${revealed ? "dice-result-readout-on" : ""} ${last?.busted ? "dice-result-bust" : ""}`}
        role="status"
        aria-live="polite"
      >
        {revealed && total != null ? (
          <>
            <p className="dice-result-faces">
              {lastName} · {last!.d1} + {last!.d2}
            </p>
            <p className="dice-result-total tabular-nums">
              {last!.busted ? "BUST" : total}
            </p>
            <p className="dice-result-note">
              {last!.busted ? "Pot gone" : last!.note}
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            {canRoll ? "Tap the dice" : "\u00a0"}
          </p>
        )}
      </div>

      {you.role === "player" && (
        <section
          className={`space-y-3 ${heroReveal || rolling ? "dice-action-dim" : ""}`}
        >
          <div className="flex items-end justify-between gap-3 px-0.5">
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
          ) : (
            <button
              className="btn-secondary w-full"
              disabled={!canBank || busy}
              onClick={() => void bank()}
            >
              {pot === 0
                ? "Bank out"
                : myTurn
                  ? `Bank ${pot}`
                  : `Bank ${pot} · sit out`}
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
