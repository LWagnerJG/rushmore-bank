"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { DiceScene } from "@/components/dice/DiceScene";
import { classifyPullOut } from "@/shared/engine/banking";
import { haptic } from "@/lib/haptics";
import { ensureDiceAudio, playBankChime } from "@/lib/dice-sfx";

function useSecondsLeft(until: number | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () =>
      setLeft(until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0);
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
  }, [until]);
  return left;
}

/** Honest roll/Bank decision clock — only while READY (can act). */
function DecisionTimer({
  until,
  label,
  urgent,
}: {
  until: number | null;
  label: string;
  urgent?: boolean;
}) {
  const left = useSecondsLeft(until);
  if (!until) return null;
  return (
    <div
      className={`dice-timer ${urgent || left <= 5 ? "dice-timer-urgent" : ""}`}
      role="timer"
      aria-live="polite"
      aria-label={`${label}: ${left} seconds`}
    >
      <span className="dice-timer-label">{label}</span>
      <span className="dice-timer-value tabular-nums">{left}</span>
      <span className="dice-timer-unit">sec</span>
    </div>
  );
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

type SeatInfo = {
  pid: string;
  name: string;
  kind: SeatKind;
  pot: number;
  safe: number;
  you: boolean;
};

/**
 * Compact phone turn strip — seat order left→right.
 * Clearer than a circle on small screens; no “TABLE” hub.
 */
function TurnStrip({ seats }: { seats: SeatInfo[] }) {
  const upRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    upRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [seats]);

  return (
    <ol className="dice-turn-strip" aria-label="Turn order">
      {seats.map((seat) => (
        <li
          key={seat.pid}
          ref={seat.kind === "up" ? upRef : undefined}
          className={[
            "dice-turn-chip",
            `dice-turn-chip-${seat.kind}`,
            seat.you ? "dice-turn-chip-you" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="dice-turn-chip-name">
            {seat.name}
            {seat.you ? " · you" : ""}
          </span>
          <span className="dice-turn-chip-meta">
            <span className="dice-turn-chip-badge">{BADGE[seat.kind]}</span>
            <span className="dice-turn-chip-pot tabular-nums">
              {seat.kind === "banked" || seat.kind === "busted"
                ? `${seat.safe} safe`
                : `pot ${seat.pot}`}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
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
  const active = state.diceActiveIds.includes(youId);
  const rolling = state.diceSubphase === "COMMITTED";
  const settling = state.diceSubphase === "SETTLED";
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
  const glowOn = myTurn && active && you.role === "player" && !settling;
  const [busy, setBusy] = useState(false);
  const turnHaptic = useRef<string | null>(null);
  const revealSeen = useRef<string | null>(null);
  const [heroReveal, setHeroReveal] = useState(false);

  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setBusy(false), 1000);
    return () => clearTimeout(timer);
  }, [busy]);

  useEffect(() => {
    if (!glowOn || state.diceSubphase !== "READY") return;
    const key = `${state.diceTurnSeat}-${state.diceSubphase}-${state.phaseRevision}`;
    if (turnHaptic.current === key) return;
    turnHaptic.current = key;
    haptic("your_turn");
  }, [glowOn, state.diceSubphase, state.diceTurnSeat, state.phaseRevision]);

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

  // BEAN BUSTER / settle pop only while SETTLED. Server clears lastDice on the
  // next seat — never extend a client timer past the settle beat.
  useEffect(() => {
    if (state.diceSubphase !== "SETTLED") return;
    if (!last?.revealed || !last.rollId) return;
    if (revealSeen.current === last.rollId) return;
    revealSeen.current = last.rollId;
    const hold = Math.min(
      last.busted ? 1100 : 900,
      /* stay inside server settle hold */ 1100,
    );
    const on = window.setTimeout(() => setHeroReveal(true), 0);
    const off = window.setTimeout(() => setHeroReveal(false), hold);
    return () => {
      window.clearTimeout(on);
      window.clearTimeout(off);
    };
  }, [last?.revealed, last?.rollId, last?.busted, state.diceSubphase]);

  const seats: SeatInfo[] = state.seatOrder.map((pid) => {
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
    haptic("bank");
    try {
      const ctx = await ensureDiceAudio();
      playBankChime(ctx);
    } catch {
      /* ignore */
    }
    act({ type: "pull_out" });
  }

  // Only the honest 15s idle bank window — never a pre-roll “opens in” clock.
  const timerUntil =
    state.diceSubphase === "READY" ? state.diceIdleDeadlineAt : null;
  const timerLabel = myTurn ? "Roll or Bank" : "Decision";

  const bustMoment = settling && !!last?.busted && !!last?.revealed;
  const statusLine = rolling
    ? "Rolling…"
    : bustMoment
      ? "Pot wiped"
      : settling
        ? "Settling…"
        : myTurn && canRoll
          ? "Tap the dice — or Bank"
          : myTurn
            ? "Your turn"
            : null;

  const revealed = !!last?.revealed;
  const total =
    revealed && last?.d1 != null && last?.d2 != null ? last.d1 + last.d2 : null;
  // Result / BEAN BUSTER only during the settle beat — never into next seat.
  const showResult = settling && revealed && total != null;
  const drama = (heroReveal && settling) || rolling || settling;

  return (
    <div
      className={`dice-layout ${heroReveal && settling ? "dice-hero-mode" : ""}`}
    >
      {/* Who’s up / next / banked — compact turn strip */}
      <section
        className={`dice-zone dice-zone-strip ${drama ? "dice-table-dim" : ""}`}
        aria-label="Turn order"
      >
        <TurnStrip seats={seats} />
      </section>

      {/* Who’s up → timer → dice hero */}
      <section className="dice-zone dice-zone-stage" aria-label="Dice stage">
        <header className="dice-stage-head text-center">
          <h2 className="dice-up-title">
            {bustMoment
              ? "BEAN BUSTER"
              : myTurn
                ? "Your roll"
                : `${roller?.name ?? "Player"} is up`}
          </h2>
          {statusLine ? (
            <p className="dice-up-status" aria-live="polite">
              {bustMoment ? `${lastName} · pot wiped` : statusLine}
            </p>
          ) : null}
        </header>

        {timerUntil != null && !rolling && !settling && (
          <div className="dice-stage-timer" aria-label="Turn timer">
            <DecisionTimer until={timerUntil} label={timerLabel} />
          </div>
        )}

        <DiceScene
          broadcast={last}
          reducedMotion={reducedMotion}
          canRoll={canRoll && !busy}
          busted={!!last?.busted && settling}
          onRoll={() => {
            if (canRoll) act({ type: "roll" });
          }}
        />

        <div
          className={`dice-result-readout ${showResult ? "dice-result-readout-on" : ""} ${last?.busted && showResult ? "dice-result-bust" : ""}`}
          role="status"
          aria-live="assertive"
        >
          {showResult ? (
            last!.busted ? (
              <>
                <p className="dice-result-faces">
                  {lastName} · {last!.d1} + {last!.d2}
                </p>
                <p className="dice-result-bust-title">BEAN BUSTER</p>
                <p className="dice-result-note">Pot gone</p>
              </>
            ) : (
              <>
                <p className="dice-result-faces">
                  {lastName} · {last!.d1} + {last!.d2}
                </p>
                <p className="dice-result-total tabular-nums">{total}</p>
                {last!.note ? (
                  <p className="dice-result-note">{last!.note}</p>
                ) : null}
              </>
            )
          ) : null}
        </div>
      </section>

      {/* Personal safe beans + Bank CTA (when you’re up) */}
      {you.role === "player" && (
        <section
          className={`dice-zone dice-zone-actions ${drama && !myTurn ? "dice-action-dim" : ""}`}
          aria-label="Pot and Bank"
        >
          <div className="dice-pot-row">
            <div>
              <p className="dice-pot-label">
                {myTurn && active ? "Your pot" : "Your beans"}
              </p>
              <p className="dice-pot-value tabular-nums">
                {active ? pot : you.stones}
              </p>
            </div>
            {active && (
              <p className="dice-pot-safe">
                <strong>{state.protectedStones[youId] ?? you.stones}</strong>{" "}
                safe
              </p>
            )}
          </div>

          {!active ? (
            <p className="dice-watch-note">You’re out — watch the round.</p>
          ) : myTurn ? (
            <button
              type="button"
              className={[
                "dice-bank-cta",
                canBank && !busy && !settling ? "dice-bank-cta-armed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={!canBank || busy || settling}
              onClick={() => void bank()}
            >
              {pot === 0 ? "Bank" : `Bank ${pot}`}
            </button>
          ) : null}
        </section>
      )}

      {partyPrompt && !partyPrompt.resolved && (
        <section className="panel space-y-2">
          <p className="font-bold">
            {partyPrompt.kind === "bust_sip" ? (
              <>
                BEAN BUSTER ·{" "}
                {partyPrompt.targetPlayerIds
                  .map((id) => state.players.find((p) => p.id === id)?.name)
                  .join(", ")}{" "}
                · optional sip
              </>
            ) : (
              <>
                {partyPrompt.targetPlayerIds
                  .map((id) => state.players.find((p) => p.id === id)?.name)
                  .join(", ")}{" "}
                · optional sip
              </>
            )}
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
