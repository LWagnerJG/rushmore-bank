"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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

/** Big, obvious roll/Bank decision clock. */
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

/** Players arranged in a circle — turn order reads clockwise. */
function PlayerCircle({ seats }: { seats: SeatInfo[] }) {
  const n = seats.length;
  return (
    <ol className="dice-circle" aria-label="Turn order around the table">
      {seats.map((seat, i) => {
        const angle = n === 0 ? 0 : (i / n) * 360 - 90;
        return (
          <li
            key={seat.pid}
            className={[
              "dice-circle-seat",
              `dice-circle-seat-${seat.kind}`,
              seat.you ? "dice-circle-seat-you" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={
              {
                "--seat-angle": `${angle}deg`,
              } as CSSProperties
            }
          >
            <div className="dice-circle-seat-card">
              <span className="dice-circle-seat-name">
                {seat.name}
                {seat.you ? " · you" : ""}
              </span>
              <span className="dice-circle-seat-meta">
                {BADGE[seat.kind]}
                {" · "}
                {seat.kind === "banked" || seat.kind === "busted"
                  ? `${seat.safe} safe`
                  : `pot ${seat.pot}`}
              </span>
            </div>
          </li>
        );
      })}
      <li className="dice-circle-hub" aria-hidden="true">
        <span>Table</span>
      </li>
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

  useEffect(() => {
    if (!last?.revealed || !last.rollId) return;
    if (revealSeen.current === last.rollId) return;
    revealSeen.current = last.rollId;
    const hold = last.busted ? 2400 : 1600;
    const on = window.setTimeout(() => setHeroReveal(true), 0);
    const off = window.setTimeout(() => setHeroReveal(false), hold);
    return () => {
      window.clearTimeout(on);
      window.clearTimeout(off);
    };
  }, [last?.revealed, last?.rollId, last?.busted]);

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

  const cooldown = state.diceSubphase === "COOLDOWN";
  const timerUntil = cooldown
    ? state.diceDecisionDeadlineAt
    : state.diceSubphase === "READY"
      ? state.diceIdleDeadlineAt
      : null;
  const timerLabel = cooldown
    ? myTurn
      ? "Your turn opens"
      : "Turn opens"
    : myTurn
      ? "Roll or Bank"
      : "Decision";

  const statusLine = rolling ? (
    "Rolling…"
  ) : settling ? (
    heroReveal && last?.busted ? (
      "BEAN BUSTER"
    ) : (
      "Settling…"
    )
  ) : myTurn && canRoll ? (
    "Tap the dice — or Bank"
  ) : myTurn && cooldown ? (
    "Bank anytime — Roll unlocks soon"
  ) : myTurn ? (
    "Your turn"
  ) : (
    `${roller?.name ?? "Player"} is up`
  );

  const revealed = !!last?.revealed;
  const total =
    revealed && last?.d1 != null && last?.d2 != null ? last.d1 + last.d2 : null;
  const drama = heroReveal || rolling || settling;

  return (
    <div className={`dice-layout ${heroReveal ? "dice-hero-mode" : ""}`}>
      {/* Zone: players in a circle */}
      <section
        className={`dice-zone dice-zone-circle ${drama ? "dice-table-dim" : ""}`}
        aria-label="Players around the table"
      >
        <PlayerCircle seats={seats} />
      </section>

      {/* Zone: prominent decision timer */}
      {timerUntil != null && !rolling && !settling && (
        <section className="dice-zone dice-zone-timer" aria-label="Turn timer">
          <DecisionTimer until={timerUntil} label={timerLabel} />
        </section>
      )}

      {/* Zone: who’s up + dice hero */}
      <header className="dice-zone dice-zone-up text-center">
        <h2 className="dice-up-title">
          {heroReveal && last?.busted
            ? "BEAN BUSTER"
            : myTurn
              ? "Your roll"
              : `${roller?.name ?? "Player"} is up`}
        </h2>
        <p className="dice-up-status" aria-live="polite">
          {heroReveal && last?.busted ? `${lastName} · pot wiped` : statusLine}
        </p>
      </header>

      <section className="dice-zone dice-zone-tray" aria-label="Dice tray">
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
          aria-live="assertive"
        >
          {revealed && total != null ? (
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
                <p className="dice-result-note">{last!.note}</p>
              </>
            )
          ) : (
            <p className="text-sm text-[var(--muted)]">
              {canRoll ? "Tap the dice" : "\u00a0"}
            </p>
          )}
        </div>
      </section>

      {/* Zone: pot + Bank */}
      {you.role === "player" && (
        <section
          className={`dice-zone dice-zone-actions ${drama && !myTurn ? "dice-action-dim" : ""}`}
          aria-label="Pot and Bank"
        >
          <div className="dice-pot-row">
            <div>
              <p className="dice-pot-label">
                {myTurn ? "Your pot" : "Your beans"}
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
            <p className="dice-watch-note">You’re out — watch the table.</p>
          ) : myTurn ? (
            <button
              className="btn-secondary w-full"
              disabled={!canBank || busy || settling}
              onClick={() => void bank()}
            >
              {pot === 0 ? "Bank" : `Bank ${pot}`}
            </button>
          ) : (
            <p className="dice-watch-note">
              Watching · {roller?.name ?? "Player"} is up
            </p>
          )}
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
