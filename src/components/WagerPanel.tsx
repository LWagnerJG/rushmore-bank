"use client";

import { useEffect, useId, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { maxWager, wagerFromPreset } from "@/shared/engine/wager";

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
  const locked = state.wagers[youId];
  const defaultAmt = Math.min(max, wagerFromPreset("half_new", earned, banked));
  const [amount, setAmount] = useState<number | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const sliderId = useId();

  const clamped =
    amount == null
      ? defaultAmt
      : Math.min(max, Math.max(0, Math.floor(amount)));
  const protectedBal = banked + earned - clamped;
  const readyCast = Object.keys(state.wagers).filter((pid) =>
    state.seatOrder.includes(pid),
  ).length;
  const readyNeeded = state.seatOrder.length;

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
          {locked === 0 ? "Beans locked safe." : "You’re in."}
        </h2>
        <p className="text-sm">
          {locked === 0
            ? "Sit this bank out."
            : `${locked} beans ready for your bank turn.`}
        </p>
        <p className="text-sm font-bold tabular-nums text-[var(--muted)]">
          {readyCast}/{readyNeeded} ready
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
            Risk how many?
          </h2>
          {left !== null && (
            <span className="text-sm font-bold tabular-nums text-[var(--muted)]">
              {left}s
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--muted)]">
          Earned {earned}
          {banked > 0 ? ` · banked ${banked}` : ""}
        </p>
      </header>

      <section className="wager-hero space-y-4 text-center" aria-live="polite">
        <div className="space-y-1">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--muted)]">
            At risk
          </p>
          <p className="font-[family-name:var(--font-display)] text-6xl font-extrabold tabular-nums leading-none tracking-tight">
            {clamped}
          </p>
        </div>
        <p className="text-base font-bold text-[var(--text)]">
          {clamped === 0 ? (
            <span className="text-[var(--muted)]">everything stays safe</span>
          ) : (
            <>
              <span className="tabular-nums text-[var(--mint)]">{protectedBal}</span>
              {" stay safe"}
            </>
          )}
        </p>

        <label htmlFor={sliderId} className="sr-only">
          Beans at risk, 0 to {max}
        </label>
        <input
          id={sliderId}
          className="wager-slider mt-2 w-full"
          type="range"
          min={0}
          max={max}
          step={1}
          value={clamped}
          onChange={(e) => setAmount(Number(e.target.value))}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={clamped}
          aria-valuetext={`${clamped} beans at risk, ${protectedBal} protected`}
        />
        <div className="flex justify-between px-0.5 text-[0.7rem] font-bold tabular-nums text-[var(--muted)]">
          <span>0 safe</span>
          <span>{max} max</span>
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
          : clamped === 0
            ? "Lock in — stay safe"
            : `Lock in ${clamped}`}
      </button>
    </div>
  );
}
