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
import { BeanBusterStamp } from "@/components/BeanBusterStamp";
import { feedback } from "@/lib/feedback";
import { cueYourTurn } from "@/lib/your-turn";
import { RULES } from "@/shared/rules";
import { railYouLabel } from "@/shared/you-label";

type SeatKind = "up" | "next" | "in" | "banked" | "busted";

/** Quiet bean glyph — same mark as BrandMark, sized for the dice beans row. */
function BeanGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 128 128"
      width={size}
      height={size}
      aria-hidden="true"
      className="dice-bean-glyph"
      shapeRendering="auto"
    >
      <path
        d="M85 13C109 15 122 39 112 60C106 73 92 71 89 85C85 110 61 123 38 111C11 97 10 61 25 38C40 17 63 10 85 13Z"
        fill="#E76F4E"
        stroke="#23483E"
        strokeWidth="6"
      />
      <path
        d="M41 36C50 27 59 24 69 24"
        fill="none"
        stroke="#FFDFA5"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <ellipse cx="47" cy="62" rx="4" ry="6" fill="#23483E" />
      <ellipse cx="65" cy="58" rx="4" ry="6" fill="#23483E" />
      <path
        d="M49 78Q60 87 69 74"
        fill="none"
        stroke="#23483E"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Total beans for a seat: pot + safe while in the round, else banked stones. */
function seatBeanTotal(
  pid: string,
  state: PublicRoomState,
  stonesFallback: number,
): number {
  const inRound = state.diceActiveIds.includes(pid);
  if (!inRound) return stonesFallback;
  const pot = state.pots[pid] ?? 0;
  const safe = state.protectedStones[pid] ?? stonesFallback;
  return pot + safe;
}

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

type SeatInfo = {
  pid: string;
  name: string;
  kind: SeatKind;
  pot: number;
  safe: number;
  total: number;
  you: boolean;
};

function seatLabel(seat: Pick<SeatInfo, "name" | "you">): string {
  return seat.you ? railYouLabel() : seat.name;
}

/**
 * Slow seamless score ticker — translateX only, duplicated set, edge fade.
 * Pauses while touched; reduced-motion shows a static wrapped list.
 */
function ScoreTicker({
  seats,
  reducedMotion,
}: {
  seats: SeatInfo[];
  reducedMotion: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const durationSec = Math.max(22, seats.length * 7);

  const items = seats.map((seat) => (
    <li
      key={seat.pid}
      className={[
        "dice-ticker-item",
        `dice-ticker-item-${seat.kind}`,
        seat.you ? "dice-ticker-item-you" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="dice-ticker-name">{seatLabel(seat)}</span>
      <span className="dice-ticker-beans tabular-nums">{seat.total}</span>
    </li>
  ));

  return (
    <div
      className={[
        "dice-ticker",
        reducedMotion ? "dice-ticker-static" : "",
        paused ? "dice-ticker-paused" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Player scores"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerCancel={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      <div
        className="dice-ticker-track"
        style={
          reducedMotion
            ? undefined
            : { animationDuration: `${durationSec}s` }
        }
      >
        <ul className="dice-ticker-set">{items}</ul>
        {!reducedMotion ? (
          <ul className="dice-ticker-set" aria-hidden="true">
            {seats.map((seat) => (
              <li
                key={`dup-${seat.pid}`}
                className={[
                  "dice-ticker-item",
                  `dice-ticker-item-${seat.kind}`,
                  seat.you ? "dice-ticker-item-you" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="dice-ticker-name">{seatLabel(seat)}</span>
                <span className="dice-ticker-beans tabular-nums">
                  {seat.total}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** Pinned current roller — name, total, live pot. Coral, calm, always visible. */
function PinnedRoller({
  seat,
}: {
  seat: SeatInfo | null;
}) {
  if (!seat) return null;
  const label = seatLabel(seat);

  return (
    <div
      className={[
        "dice-pinned-roller",
        seat.you ? "dice-pinned-roller-you" : "",
        seat.kind === "busted" ? "dice-pinned-roller-busted" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-live="polite"
      aria-label={`${label}, ${seat.total} beans, ${seat.pot} at risk`}
    >
      <div className="dice-pinned-roller-who">
        <p className="dice-pinned-roller-kicker">Now rolling</p>
        <p className="dice-pinned-roller-name">{label}</p>
      </div>
      <div className="dice-pinned-roller-scores">
        <p className="dice-pinned-roller-total">
          <BeanGlyph size={16} />
          <span className="tabular-nums">{seat.total}</span>
        </p>
        <p className="dice-pinned-roller-pot">
          <span className="dice-pinned-roller-pot-label">At risk</span>
          <span className="dice-pinned-roller-pot-value tabular-nums">
            {seat.pot}
          </span>
        </p>
      </div>
    </div>
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
  const yourBeans = seatBeanTotal(youId, state, you.stones);
  // Under-tray Your beans only when watching — pinned card owns the roller
  // (and your totals) on your turn, so no number shows twice.
  const showYourBeansUnder = you.role === "player" && !myTurn;
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
    const safe = inRound
      ? (state.protectedStones[pid] ?? player?.stones ?? 0)
      : (player?.stones ?? 0);
    const seatPot = state.pots[pid] ?? 0;
    return {
      pid,
      name: player?.name ?? "Player",
      kind,
      pot: seatPot,
      safe,
      total: seatBeanTotal(pid, state, player?.stones ?? 0),
      you: pid === youId,
    };
  });
  const rollerSeat = seats.find((s) => s.pid === rollerId) ?? null;

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
  const bustRollerId = readout.rollerId ?? liveRoll?.rollerId ?? null;
  const bustRoller =
    bustRollerId != null
      ? state.players.find((p) => p.id === bustRollerId)
      : null;
  const bustRollerName = bustRoller?.name ?? roller?.name ?? "Player";
  const bustIsYou = bustRollerId === youId;
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
      {/* Zone 1 — score ticker + pinned roller (replaces swipe strip) */}
      <section
        className={`dice-zone dice-zone-strip ${drama ? "dice-table-dim" : ""}`}
        aria-label="Scores"
      >
        <ScoreTicker seats={seats} reducedMotion={reducedMotion} />
        <PinnedRoller seat={rollerSeat} />
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
            <div className="dice-stage-actions" aria-label="Bank">
              {/*
                Your beans under the tray only while watching — on your turn
                the pinned roller card already shows You + total + at risk.
              */}
              {showYourBeansUnder ? (
                <div className="dice-beans-row">
                  <div
                    className="dice-your-beans"
                    aria-label={`Your beans ${yourBeans}`}
                  >
                    <p className="dice-your-beans-label">Your beans</p>
                    <p className="dice-your-beans-value">
                      <BeanGlyph size={18} />
                      <span className="tabular-nums">{yourBeans}</span>
                    </p>
                  </div>
                </div>
              ) : null}

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

      <BeanBusterStamp
        active={showBust}
        rollId={showBust ? readout.rollId : null}
        rollerName={bustRollerName}
        isYou={bustIsYou}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
