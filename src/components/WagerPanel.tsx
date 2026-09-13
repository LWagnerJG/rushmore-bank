"use client";

import { useEffect, useId, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { clampWager, maxWager, wagerFromPreset } from "@/shared/engine/wager";
import { WagerSlider } from "@/components/WagerSlider";

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
    <div className="wager-flow space-y-4">
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

      <section className="wager-hero" aria-live="polite">
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
        </div>

        <WagerSlider
          id={sliderId}
          min={min}
          max={max}
          value={clamped}
          onChange={setAmount}
          valuetext={`${clamped} beans at risk, ${protectedBal} protected`}
        />
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
