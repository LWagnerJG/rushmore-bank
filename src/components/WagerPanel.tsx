"use client";

import { useEffect, useId, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { clampWager, maxWager, wagerFromPreset } from "@/shared/engine/wager";
import { TimerPill } from "@/components/TimerPill";
import { WagerSlider } from "@/components/WagerSlider";
import { WaitingRoster } from "@/components/WaitingRoster";

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
  const [busy, setBusy] = useState(false);
  const sliderId = useId();

  const clamped =
    amount == null
      ? defaultAmt
      : clampWager(amount, earned, banked);
  const protectedBal = banked + earned - clamped;
  const wagerDoneIds = Object.keys(state.wagers).filter((pid) =>
    state.seatOrder.includes(pid),
  );
  const nothingToRisk = max <= 0;

  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setBusy(false), 1200);
    return () => clearTimeout(timer);
  }, [busy]);

  if (you.role !== "player") {
    return (
      <WaitingRoster
        state={state}
        youId={youId}
        doneIds={wagerDoneIds}
        label="Waiting on wagers"
      />
    );
  }

  if (locked !== undefined) {
    return (
      <div className="stack" aria-live="polite">
        <h2 className="type-display text-center">
          {locked === 0 ? "Nothing to risk." : "You’re in."}
        </h2>
        <WaitingRoster
          state={state}
          youId={youId}
          doneIds={wagerDoneIds}
          label="Waiting on wagers"
        />
      </div>
    );
  }

  if (nothingToRisk) {
    return (
      <div className="wager-flow space-y-5">
        <header className="space-y-1 text-center">
          <h2 className="type-display">No beans to risk</h2>
          <p className="type-meta text-[var(--muted)]">
            You’ll auto-pass the bank table this topic.
          </p>
        </header>
        <button
          type="button"
          className="btn-primary w-full"
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
          <h2 className="type-display">Risk how many?</h2>
        </div>
        {state.wagerDeadlineAt ? (
          <TimerPill until={state.wagerDeadlineAt} label="Wager" />
        ) : null}
      </header>

      <section className="wager-hero" aria-live="polite">
        {/* One stake display — safe balance stays in slider ARIA + CTA */}
        <div
          className="wager-stake"
          aria-label={`${clamped} at risk, ${protectedBal} stay safe`}
        >
          <p className="wager-stake-value tabular-nums">{clamped}</p>
          <p className="wager-stake-label">at risk</p>
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
        className="btn-primary w-full"
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
