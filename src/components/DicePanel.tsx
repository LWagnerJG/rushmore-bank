"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { DiceScene } from "@/components/dice/DiceScene";
import { TimerPill } from "@/components/TimerPill";
import { classifyPullOut } from "@/shared/engine/banking";
import {
  liveReadoutRoll,
  resolveDiceReadout,
  type DiceReadoutRoll,
} from "@/shared/engine/dice-present";
import { feedback } from "@/lib/feedback";
import { cueYourTurn } from "@/lib/your-turn";
import { RULES } from "@/shared/rules";
import { youInlineSuffix } from "@/shared/you-label";

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
 * Single score surface during BANK (chrome beans are hidden).
 */
function TurnStrip({ seats }: { seats: SeatInfo[] }) {
  const upRef = useRef<HTMLLIElement | null>(null);
  const upId = seats.find((s) => s.kind === "up")?.pid ?? "";

  useEffect(() => {
    upRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [upId]);

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
            {seat.you ? youInlineSuffix(seat.name) : ""}
          </span>
          <span className="dice-turn-chip-meta">
            <span className="dice-turn-chip-badge">{BADGE[seat.kind]}</span>
            <span
              className="dice-turn-chip-split tabular-nums"
              aria-label={
                seat.kind === "banked" || seat.kind === "busted" || seat.pot === 0
                  ? `${seat.safe} safe`
                  : `${seat.pot} in pot`
              }
            >
              {/* Single figure — Pot/Safe labels live once on the stage */}
              <span
                className={
                  seat.kind === "banked" || seat.kind === "busted" || seat.pot === 0
                    ? "dice-turn-chip-safe"
                    : "dice-turn-chip-pot"
                }
              >
                <span className="dice-turn-chip-num">
                  {seat.kind === "banked" ||
                  seat.kind === "busted" ||
                  seat.pot === 0
                    ? seat.safe
                    : seat.pot}
                </span>
              </span>
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
  const [busy, setBusy] = useState(false);
  const turnHaptic = useRef<string | null>(null);
  const revealSeen = useRef<string | null>(null);
  const [heroReveal, setHeroReveal] = useState(false);
  /** Prior revealed non-secret roll — fills the total gap while the next tumble runs. */
  const [stickyRoll, setStickyRoll] = useState<DiceReadoutRoll | null>(null);
  const [bankConfirm, setBankConfirm] = useState(false);
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
    state.diceSubphase === "READY" &&
    !bankConfirm;
  const firstRoll =
    canRoll && (state.personalRollCounts[youId] ?? 0) === 0;
  const glowOn = myTurn && active && you.role === "player" && !settling;

  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setBusy(false), 1000);
    return () => clearTimeout(timer);
  }, [busy]);

  useEffect(() => {
    if (!glowOn || state.diceSubphase !== "READY") return;
    const key = `dice:${state.code}:${state.diceTurnSeat}:${state.phaseRevision}`;
    if (turnHaptic.current === key) return;
    turnHaptic.current = key;
    cueYourTurn(key);
  }, [
    glowOn,
    state.diceSubphase,
    state.diceTurnSeat,
    state.phaseRevision,
    state.code,
  ]);

  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const last = state.lastDice;
  const liveRoll = liveReadoutRoll(last);

  // Sticky prior roll for tumble gaps — adjust during render so SETTLED never
  // paints a stale sticky bust/total for one frame (React-approved pattern).
  if (!last) {
    if (stickyRoll !== null) setStickyRoll(null);
  } else if (
    liveRoll &&
    (stickyRoll?.rollId !== liveRoll.rollId ||
      stickyRoll.d1 !== liveRoll.d1 ||
      stickyRoll.d2 !== liveRoll.d2 ||
      stickyRoll.busted !== liveRoll.busted ||
      stickyRoll.gain !== liveRoll.gain)
  ) {
    setStickyRoll(liveRoll);
  }

  const stickyForReadout = !last ? null : liveRoll ?? stickyRoll;
  const readout = resolveDiceReadout(
    state.diceSubphase,
    last,
    stickyForReadout,
  );
  const nextId = Array.from(
    { length: state.seatOrder.length - 1 },
    (_, i) =>
      state.seatOrder[(state.diceTurnSeat + i + 1) % state.seatOrder.length],
  ).find((id) => id && state.diceActiveIds.includes(id));
  const partyPrompt = state.partyPrompt;
  const canResolveParty =
    partyPrompt?.targetPlayerIds.includes(youId) || you.isHost;

  // Bust / settle beat while SETTLED. Server clears lastDice on the next seat.
  useEffect(() => {
    if (state.diceSubphase !== "SETTLED") return;
    if (!liveRoll?.rollId) return;
    if (revealSeen.current === liveRoll.rollId) return;
    revealSeen.current = liveRoll.rollId;
    const hold = liveRoll.busted ? RULES.diceBustHoldMs : 900;
    const on = window.setTimeout(() => setHeroReveal(true), 0);
    const off = window.setTimeout(() => setHeroReveal(false), hold);
    // +beans land — after dice settle cue; skip on bust.
    let beansId: number | undefined;
    if (!liveRoll.busted && (liveRoll.gain ?? 0) > 0) {
      beansId = window.setTimeout(() => feedback("beans_land"), 70);
    }
    return () => {
      window.clearTimeout(on);
      window.clearTimeout(off);
      if (beansId != null) window.clearTimeout(beansId);
    };
  }, [liveRoll?.rollId, liveRoll?.busted, liveRoll?.gain, state.diceSubphase]);

  const seats: SeatInfo[] = state.seatOrder.map((pid) => {
    const player = state.players.find((p) => p.id === pid);
    const inRound = state.diceActiveIds.includes(pid);
    const bust = state.bustedPlayerIdsThisRound.includes(pid);
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

  function confirmBank() {
    if (!canBank || busy) return;
    setBankConfirm(false);
    feedback("bank");
    act({ type: "pull_out" });
  }

  // Honest 15s idle bank window. The server pauses it while the roller has
  // Bank confirm open, so everyone sees it paused rather than ticking.
  const timerPaused =
    bankConfirm ||
    (state.diceSubphase === "READY" && state.diceIdlePauseRemainingMs != null);
  const timerUntil =
    state.diceSubphase === "READY" ? state.diceIdleDeadlineAt : null;
  const timerLive =
    (timerUntil != null || timerPaused) && !rolling && !settling;
  const timerLabel = myTurn ? "Roll" : "Turn";

  // Bust banner follows the live revealed roll on SETTLED (not sticky).
  const bustMoment = readout.showBust;
  const showBust = readout.showBust;
  const showTotal = readout.showTotal;
  // One status signal merged with tray: title = role; status = Rolling/Settling
  // or Tap (after first). Bust uses the result banner only — no spectator line.
  const statusLine = bustMoment
    ? null
    : rolling
      ? "Rolling…"
      : settling
        ? "Settling…"
        : myTurn && canRoll && !firstRoll
          ? "Tap to roll"
          : null;

  const resultFresh = settling && !!liveRoll;
  const resultStale = readout.resultStale;
  const drama = (heroReveal && settling) || rolling || settling;

  return (
    <div
      className={`dice-layout ${heroReveal && settling ? "dice-hero-mode" : ""} ${bustMoment ? "dice-bust-flash" : ""} ${!active && you.role === "player" ? "dice-spectator" : ""}`}
    >
      {/* Zone 1 — turn strip = single score surface (chrome beans hidden) */}
      <section
        className={`dice-zone dice-zone-strip ${drama ? "dice-table-dim" : ""}`}
        aria-label="Turn order"
      >
        <TurnStrip seats={seats} />
      </section>

      {/* Zone 2 — one soft cream panel: role + timer + dice + result + Bank */}
      <section
        className={`dice-zone dice-zone-stage ${drama && !myTurn ? "dice-stage-dim" : ""}`}
        aria-label="Dice stage"
      >
        <div className="dice-stage-panel">
          <header className="dice-stage-chrome">
            <div className="dice-stage-role">
              <h2 className="dice-up-title">
                {myTurn ? "Your roll" : `${roller?.name ?? "Player"} is up`}
              </h2>
              {statusLine ? (
                <p className="dice-up-status" aria-live="polite">
                  {statusLine}
                </p>
              ) : (
                <p className="dice-up-status dice-up-status-empty" aria-hidden="true">
                  {"\u00a0"}
                </p>
              )}
            </div>
            <div
              className={`dice-stage-timer ${timerLive ? "dice-stage-timer-live" : "dice-stage-timer-idle"}`}
              aria-hidden={!timerLive}
            >
              <TimerPill
                until={timerUntil}
                paused={timerPaused}
                label={timerLabel}
                urgentAt={5}
                announce={myTurn && timerLive}
              />
            </div>
          </header>

          <div className="dice-stage-tray">
            <DiceScene
              broadcast={last}
              reducedMotion={reducedMotion}
              canRoll={canRoll && !busy}
              busted={readout.showBust}
              firstRollHint={firstRoll}
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
            {showBust ? (
              <p className="dice-result-bust-title">Bean Buster · Pot gone</p>
            ) : showTotal && readout.gain != null ? (
              <p className="dice-result-gain tabular-nums">
                +{readout.gain} {RULES.currencyName}
              </p>
            ) : null}
          </div>

          {you.role === "player" ? (
            <div className="dice-stage-actions" aria-label="Pot and Bank">
              {/* Pot / Safe once — chrome beans cut; strip chips stay single-figure */}
              <div className="dice-pot-row">
                {active && pot > 0 ? (
                  <>
                    <div className="dice-pot-stack">
                      <p className="dice-pot-label">Pot</p>
                      <p className="dice-pot-value tabular-nums">{pot}</p>
                    </div>
                    <div className="dice-pot-stack dice-pot-stack-end">
                      <p className="dice-pot-label">Safe</p>
                      <p className="dice-pot-value tabular-nums">{safeBeans}</p>
                    </div>
                  </>
                ) : (
                  <div className="dice-pot-stack">
                    <p className="dice-pot-label">{active ? "Safe" : "Banked"}</p>
                    <p className="dice-pot-value tabular-nums">
                      {active ? safeBeans : you.stones}
                    </p>
                  </div>
                )}
              </div>

              <div className="dice-cta-slot">
                {myTurn && active ? (
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
                    <span className="dice-bank-cta-main">
                      {pot === 0 ? "Bank" : `Bank ${pot}`}
                    </span>
                  </button>
                ) : (
                  /* Reserve Bank height — no ghost label when not your turn */
                  <div
                    className="dice-bank-cta-spacer"
                    aria-hidden="true"
                  />
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
            <section className="party-sip party-sip-quiet space-y-2">
              <p className="party-sip-kicker">Party Mode</p>
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
