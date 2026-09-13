"use client";

import { useEffect, useId, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { clampWager, maxWager, wagerFromPreset } from "@/shared/engine/wager";

export function WagerPanel({
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
  const earned = state.earnedThisRound[youId] ?? 0;
  const banked = you.stones;
  const max = maxWager(earned, banked);
  const min = max >= 1 ? 1 : 0;
  const locked = state.wagers[youId];
  const defaultAmt = clampWager(
    wagerFromPreset("half_new", earned, banked),
    earned,
    banked,
  );
  const [amount, setAmount] = useState<number | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const sliderId = useId();

  const clamped =
    amount == null
      ? defaultAmt
      : clampWager(amount, earned, banked);
  const protectedBal = banked + earned - clamped;
  const readyCast = Object.keys(state.wagers).filter((pid) =>
    state.seatOrder.includes(pid),
  ).length;
  const readyNeeded = state.seatOrder.length;
  const nothingToRisk = max <= 0;
  const urgent = left !== null && left <= 5;
  const pileTotal = Math.max(1, clamped + protectedBal);
  const riskPct = Math.round((clamped / pileTotal) * 100);

  useEffect(() => {
    const tick = () =>
      setLeft(
        state.wagerDeadlineAt
          ? Math.max(0, Math.ceil((state.wagerDeadlineAt - Date.now()) / 1000))
          : null,
      );
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [state.wagerDeadlineAt]);

  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setBusy(false), 1200);
    return () => clearTimeout(timer);
  }, [busy]);

  if (you.role !== "player") {
    return (
      <section className="panel space-y-2 text-center">
        <p>Everyone is choosing how many beans to risk.</p>
        <p className="text-sm font-bold tabular-nums text-[var(--muted)]">
          {readyCast}/{readyNeeded} ready
        </p>
      </section>
    );
  }

  if (locked !== undefined) {
    return (
      <section className="panel space-y-3 text-center" aria-live="polite">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-extrabold">
          {locked === 0 ? "Nothing to risk." : "You’re in."}
        </h2>
        <p className="text-sm">
          {locked === 0
            ? "No beans available — you’ll pass the bank table."
            : `${locked} beans ready for your bank turn.`}
        </p>
        <p className="text-sm font-bold tabular-nums text-[var(--muted)]">
          {readyCast}/{readyNeeded} ready
        </p>
      </section>
    );
  }

  if (nothingToRisk) {
    return (
      <div className="wager-flow space-y-5">
        <header className="space-y-1 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
            No beans to risk
          </h2>
          <p className="text-sm text-[var(--muted)]">
            You’ll auto-pass the bank table this topic.
          </p>
        </header>
        <button
          type="button"
          className="btn-danger w-full text-lg"
          disabled={busy}
          onClick={() => {
            if (busy) return;
            setBusy(true);
            send({ type: "submit_wager", amount: 0 });
          }}
        >
          {busy ? "Locking…" : "Continue"}
        </button>
      </div>
    );
  }

  return (
    <div className="wager-flow space-y-5">
      <header className="wager-header">
        <div className="wager-header-copy">
          <h2 className="font-[family-name:var(--font-display)] text-[1.65rem] font-extrabold leading-tight tracking-tight">
            Risk how many?
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Earned {earned}
            {banked > 0 ? ` · banked ${banked}` : ""}
          </p>
        </div>
        {left !== null && (
          <div
            className={`wager-timer ${urgent ? "wager-timer-urgent" : ""}`}
            role="timer"
            aria-live="polite"
            aria-label={`${left} seconds left`}
          >
            <span className="wager-timer-label">Time</span>
            <span className="wager-timer-value tabular-nums">{left}</span>
            <span className="wager-timer-unit">s</span>
          </div>
        )}
      </header>

      <section className="wager-hero space-y-5" aria-live="polite">
        <div
          className="wager-piles"
          aria-label={`${clamped} at risk, ${protectedBal} stay safe`}
        >
          <div className="wager-pile wager-pile-risk">
            <p className="wager-pile-label">At risk</p>
            <p className="wager-pile-value tabular-nums">{clamped}</p>
          </div>
          <div className="wager-pile wager-pile-safe">
            <p className="wager-pile-label">Stay safe</p>
            <p className="wager-pile-value tabular-nums">{protectedBal}</p>
          </div>
          <div
            className="wager-split-bar"
            role="img"
            aria-hidden="true"
          >
            <span
              className="wager-split-risk"
              style={{ flexGrow: Math.max(riskPct, 2) }}
            />
            <span
              className="wager-split-safe"
              style={{ flexGrow: Math.max(100 - riskPct, 2) }}
            />
          </div>
        </div>

        <div className="wager-slider-block">
          <label htmlFor={sliderId} className="sr-only">
            Beans at risk, {min} to {max}
          </label>
          <input
            id={sliderId}
            className="wager-slider w-full"
            type="range"
            min={min}
            max={max}
            step={1}
            value={clamped}
            onChange={(e) => setAmount(Number(e.target.value))}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={clamped}
            aria-valuetext={`${clamped} beans at risk, ${protectedBal} protected`}
          />
          <div className="mt-2 flex justify-between px-0.5 text-[0.7rem] font-bold tabular-nums text-[var(--muted)]">
            <span>{min} min</span>
            <span>{max} max</span>
          </div>
        </div>
      </section>

      <button
        type="button"
        className="btn-danger w-full text-lg"
        disabled={busy}
        onClick={() => {
          if (busy) return;
          setBusy(true);
          send({ type: "submit_wager", amount: clamped });
        }}
      >
        {busy
          ? "Locking…"
          : `Risk ${clamped} bean${clamped === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
