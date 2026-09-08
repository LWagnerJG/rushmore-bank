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
      <p className="panel">Everyone is choosing how many beans to risk.</p>
    );
  }

  if (locked !== undefined) {
    return (
      <section className="panel space-y-2 text-center" aria-live="polite">
        <h2 className="text-xl font-extrabold">
          {locked === 0 ? "Beans locked safe." : "You’re in."}
        </h2>
        <p>
          {locked === 0
            ? "Sit this bank out."
            : `${locked} beans ready for your bank turn.`}
        </p>
        <p className="text-sm text-[var(--muted)]">Waiting for the others…</p>
      </section>
    );
  }

  const presets = [
    { label: "Keep", value: 0 },
    {
      label: "Half",
      value: wagerFromPreset("half_new", earned, banked),
    },
    {
      label: "All",
      value: wagerFromPreset("all_new", earned, banked),
    },
  ] as const;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
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

      <section className="space-y-3 text-center" aria-live="polite">
        <p className="font-[family-name:var(--font-display)] text-5xl font-extrabold tabular-nums leading-none">
          {clamped}
        </p>
        <p className="text-sm font-bold text-[var(--muted)]">
          {clamped === 0
            ? "keeping everything safe"
            : `${protectedBal} stay safe`}
        </p>

        <label htmlFor={sliderId} className="sr-only">
          Beans at risk, 0 to {max}
        </label>
        <input
          id={sliderId}
          className="wager-slider mt-1 w-full"
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

        <div className="flex justify-center gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={
                "min-h-11 rounded-full px-4 text-sm font-bold " +
                (clamped === preset.value
                  ? "bg-[var(--text)] text-[#f5f0e7]"
                  : "bg-white/70 text-[var(--text)]")
              }
              aria-pressed={clamped === preset.value}
              onClick={() => setAmount(preset.value)}
            >
              {preset.label}
            </button>
          ))}
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
            ? "Keep all beans safe"
            : `Lock in ${clamped} at risk`}
      </button>
    </div>
  );
}
