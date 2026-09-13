"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { DiceScene } from "@/components/dice/DiceScene";
import { classifyPullOut } from "@/shared/engine/banking";
import { haptic } from "@/lib/haptics";
import { RULES } from "@/shared/rules";
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

/**
 * Always-mounted roll/Bank decision clock.
 * When idle (rolling / settled / between seats), keep the slot and show — so
 * the stage never jumps when the 15s window appears or clears.
 */
function DecisionTimer({
  until,
  label,
  urgent,
  idle,
}: {
  until: number | null;
  label: string;
  urgent?: boolean;
  idle?: boolean;
}) {
  const left = useSecondsLeft(until);
  const active = !!until && !idle;
  return (
    <div
      className={`dice-timer ${active && (urgent || left <= 5) ? "dice-timer-urgent" : ""} ${active ? "" : "dice-timer-idle"}`}
      role="timer"
      aria-live="polite"
      aria-label={active ? `${label}: ${left} seconds` : "Timer idle"}
      aria-hidden={!active}
    >
      <span className="dice-timer-label">{active ? label : "Timer"}</span>
      <span className="dice-timer-value tabular-nums">
        {active ? left : "—"}
      </span>
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

type StickyRoll = {
  rollId: string;
  d1: number;
  d2: number;
  total: number;
  name: string;
  busted: boolean;
  note?: string;
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
          <span className="dice-turn-chip-name" title={seat.name}>
            {seat.name}
            {seat.you ? " · you" : ""}
          </span>
          <span className="dice-turn-chip-meta">
            <span className="dice-turn-chip-badge">{BADGE[seat.kind]}</span>
            <span className="dice-turn-chip-split tabular-nums" aria-label={`${seat.safe} safe${seat.kind === "banked" || seat.kind === "busted" ? "" : `, ${seat.pot} risking`}`}>
              {seat.kind === "banked" || seat.kind === "busted" ? (
                <span className="dice-turn-chip-safe">
                  <span className="dice-turn-chip-num">{seat.safe}</span>
                </span>
              ) : (
                <>
                  <span className="dice-turn-chip-safe">
                    <span className="dice-turn-chip-num">{seat.safe}</span>
                  </span>
                  <span className="dice-turn-chip-pot">
                    <span className="dice-turn-chip-num">{seat.pot}</span>
                  </span>
                </>
              )}
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
  const safeBeans = state.protectedStones[youId] ?? you.stones;
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
  /** Keep last revealed faces across scramble so the total never blanks. */
  const [stickyRoll, setStickyRoll] = useState<StickyRoll | null>(null);
  const [bankConfirm, setBankConfirm] = useState(false);

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

  // Sticky last-roll readout: update on reveal; clear when server nulls lastDice
  // (next seat) so BEAN BUSTER never lingers.
  useEffect(() => {
    if (!last) {
      setStickyRoll(null);
      return;
    }
    if (last.revealed && last.d1 != null && last.d2 != null) {
      setStickyRoll({
        rollId: last.rollId,
        d1: last.d1,
        d2: last.d2,
        total: last.d1 + last.d2,
        name: lastName,
        busted: !!last.busted,
        note: last.note,
      });
    }
  }, [last, lastName]);

  // BEAN BUSTER / settle pop only while SETTLED. Server clears lastDice on the
  // next seat — never extend a client timer past the settle beat.
  useEffect(() => {
    if (state.diceSubphase !== "SETTLED") return;
    if (!last?.revealed || !last.rollId) return;
    if (revealSeen.current === last.rollId) return;
    revealSeen.current = last.rollId;
    const hold = last.busted ? RULES.diceBustHoldMs : 900;
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

  function openBankConfirm() {
    if (!canBank || busy || bankConfirm) return;
    setBankConfirm(true);
    send({ type: "bank_confirm_open" });
  }

  function cancelBankConfirm() {
    if (!bankConfirm) return;
    setBankConfirm(false);
    send({ type: "bank_confirm_cancel" });
  }

  async function confirmBank() {
    if (!canBank || busy) return;
    setBankConfirm(false);
    haptic("bank");
    try {
      const ctx = await ensureDiceAudio();
      playBankChime(ctx);
    } catch {
      /* ignore */
    }
    act({ type: "pull_out" });
  }

  // Honest 15s idle bank window — freeze while Bank confirm modal is open.
  const timerUntil = bankConfirm
    ? (state.diceIdlePauseRemainingMs != null
        ? Date.now() + state.diceIdlePauseRemainingMs
        : null)
    : state.diceSubphase === "READY"
      ? state.diceIdleDeadlineAt
      : null;
  const timerLabel = myTurn ? "Your roll" : "Decision";
  const timerLive = timerUntil != null && !rolling && !settling;

  const bustMoment = settling && !!stickyRoll?.busted;
  const statusLine = rolling
    ? "Rolling…"
    : bustMoment
      ? "Pot wiped"
      : settling
        ? "Settling…"
        : myTurn && canRoll
          ? "TAP TO ROLL"
          : myTurn
            ? "Your turn"
            : "Watching";

  // Fresh settle uses live faces; otherwise sticky keeps the prior total through
  // scramble / READY so the readout never blanks mid-turn.
  const showBust = bustMoment && stickyRoll != null;
  const showTotal =
    !showBust && stickyRoll != null && !stickyRoll.busted;
  const resultFresh = settling && !!last?.revealed;
  const resultStale = showTotal && rolling;
  const drama = (heroReveal && settling) || rolling || settling;

  return (
    <div
      className={`dice-layout ${heroReveal && settling ? "dice-hero-mode" : ""} ${bustMoment ? "dice-bust-linger" : ""} ${!active && you.role === "player" ? "dice-spectator" : ""}`}
    >
      {/* Zone 1 — turn strip (table context, outside the soft stage) */}
      <section
        className={`dice-zone dice-zone-strip ${drama ? "dice-table-dim" : ""}`}
        aria-label="Turn order"
      >
        <TurnStrip seats={seats} />
      </section>

      {/* Zone 2 — one soft cream panel: role + timer + dice + TAP + last roll + pot/Bank */}
      <section
        className={`dice-zone dice-zone-stage ${drama && !myTurn ? "dice-stage-dim" : ""}`}
        aria-label="Dice stage"
      >
        <div className="dice-stage-panel">
          <header className="dice-stage-chrome">
            <div className="dice-stage-role">
              <h2 className="dice-up-title">
                {bustMoment
                  ? "BEAN BUSTER"
                  : myTurn
                    ? "Your roll"
                    : `${roller?.name ?? "Player"} is up`}
              </h2>
              <p className="dice-up-status" aria-live="polite">
                {bustMoment
                  ? `${stickyRoll?.name ?? lastName} · pot wiped`
                  : statusLine}
              </p>
            </div>
            <div
              className={`dice-stage-timer ${timerLive ? "dice-stage-timer-live" : "dice-stage-timer-idle"}`}
              aria-label="Turn timer"
            >
              <DecisionTimer
                until={timerUntil}
                label={timerLabel}
                idle={!timerLive}
              />
            </div>
          </header>

          <div className="dice-stage-tray">
            <DiceScene
              broadcast={last}
              reducedMotion={reducedMotion}
              canRoll={canRoll && !busy}
              busted={!!last?.busted && settling}
              firstRollHint={
                canRoll && (state.personalRollCounts[youId] ?? 0) === 0
              }
              onRoll={() => {
                if (canRoll) act({ type: "roll" });
              }}
            />
          </div>

          <div
            className={[
              "dice-result-readout",
              showBust || showTotal ? "dice-result-readout-on" : "",
              showBust ? "dice-result-bust" : "",
              resultFresh && showTotal ? "dice-result-fresh" : "",
              resultStale ? "dice-result-stale" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="status"
            aria-live="assertive"
          >
            {showBust && stickyRoll ? (
              <>
                <p className="dice-result-bust-title">BEAN BUSTER</p>
                <p className="dice-result-note">Pot gone</p>
              </>
            ) : showTotal && stickyRoll ? (
              <p className="dice-result-gain tabular-nums">
                +{stickyRoll.total} {RULES.currencyName}
              </p>
            ) : (
              <p className="dice-result-gain dice-result-idle tabular-nums">—</p>
            )}
          </div>

          {you.role === "player" ? (
            <div className="dice-stage-actions" aria-label="Pot and Bank">
              <div className="dice-pot-row">
                <div className="dice-pot-stack">
                  <p className="dice-pot-label">
                    {active ? "Your pot" : "Your beans"}
                  </p>
                  <p className="dice-pot-value tabular-nums">
                    {active ? pot : you.stones}
                  </p>
                  {active ? (
                    <p className="dice-pot-hint">at risk</p>
                  ) : (
                    <p className="dice-pot-hint">banked</p>
                  )}
                </div>
                <div
                  className={`dice-pot-safe ${active ? "" : "dice-pot-safe-muted"}`}
                >
                  <p className="dice-pot-label">Your safe</p>
                  <p className="dice-pot-safe-value tabular-nums">
                    <strong>{safeBeans}</strong>
                  </p>
                </div>
              </div>

              <div className="dice-cta-slot">
                {!active ? (
                  <div className="dice-spectator-status" role="status">
                    <p className="dice-spectator-kicker">Spectator</p>
                    <p className="dice-watch-note">
                      {roller?.name
                        ? `Watching ${roller.name} roll`
                        : "Watching this round"}
                    </p>
                  </div>
                ) : myTurn ? (
                  <button
                    type="button"
                    className={[
                      "dice-bank-cta dice-bank-cta-secondary",
                      canBank && !busy && !settling
                        ? "dice-bank-cta-ready"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={!canBank || busy || settling}
                    onClick={() => openBankConfirm()}
                  >
                    {pot === 0 ? "Bank" : `Bank ${pot}`}
                  </button>
                ) : (
                  <div
                    className="dice-bank-cta dice-bank-cta-secondary dice-bank-cta-ghost"
                    aria-hidden="true"
                  >
                    Bank
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Zone 3 — party prompt: reserved slot, expands smoothly */}
      <div
        className={`dice-party-slot ${partyPrompt && !partyPrompt.resolved ? "dice-party-slot-open" : ""}`}
        aria-hidden={!partyPrompt || partyPrompt.resolved}
      >
        <div className="dice-party-slot-inner">
          {partyPrompt && !partyPrompt.resolved ? (
            <section className="panel space-y-2">
              <p className="font-bold">
                {partyPrompt.kind === "bust_redo" ? (
                  <>
                    BEAN BUSTER ·{" "}
                    {partyPrompt.targetPlayerIds
                      .map((id) => state.players.find((p) => p.id === id)?.name)
                      .join(", ")}
                  </>
                ) : (
                  <>
                    Lowest beans ·{" "}
                    {partyPrompt.targetPlayerIds
                      .map((id) => state.players.find((p) => p.id === id)?.name)
                      .join(", ")}
                  </>
                )}
              </p>
              <p className="text-sm font-semibold text-[var(--muted)]">
                {partyPrompt.kind === "bust_redo"
                  ? "Finish a drink for a one-time redo of this bust, or Pass and accept it."
                  : "Finish a drink to continue — Pass anytime is ok."}
              </p>
              {canResolveParty && (
                <div className="flex gap-2">
                  <button
                    className="btn-primary flex-1"
                    onClick={() =>
                      send({ type: "party_resolve", choice: "done" })
                    }
                  >
                    {partyPrompt.kind === "bust_redo"
                      ? "Finished drink · redo bust"
                      : "I finished my drink"}
                  </button>
                  <button
                    className="btn-secondary flex-1"
                    onClick={() =>
                      send({ type: "party_resolve", choice: "pass" })
                    }
                  >
                    Pass
                  </button>
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>


      {bankConfirm ? (
        <div className="bank-confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="bank-confirm-title">
          <div className="bank-confirm-modal panel space-y-3">
            <p id="bank-confirm-title" className="font-[family-name:var(--font-display)] text-lg font-extrabold">
              Are you sure you want to Bank?
            </p>
            <p className="text-sm font-semibold text-[var(--muted)]">
              Locks in your pot now. Timer is paused while you decide.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => void confirmBank()}
              >
                Yes, Bank{pot > 0 ? ` ${pot}` : ""}
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={cancelBankConfirm}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
