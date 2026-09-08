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
  const atRisk = clamped;

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

  return (
    <div className="space-y-4">
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
          Earned {earned}{banked > 0 ? ` · banked ${banked}` : ""}
        </p>
      </header>

      <section
        className="panel grid grid-cols-2 gap-3 text-center"
        aria-live="polite"
      >
        <div className="rounded-xl bg-[rgba(167,215,194,0.35)] px-3 py-3">
          <p className="text-xs font-bold uppercase text-[var(--muted)]">
            Safe
          </p>
          <p className="text-3xl font-extrabold">{protectedBal}</p>
        </div>
        <div className="rounded-xl bg-[rgba(231,111,78,0.18)] px-3 py-3">
          <p className="text-xs font-bold uppercase text-[var(--muted)]">
            Risk
          </p>
          <p className="text-3xl font-extrabold">{atRisk}</p>
        </div>
      </section>

      <section className="panel space-y-3">
        <label htmlFor={sliderId} className="block text-sm font-bold">
          Risk 0–{max}
        </label>
        <input
          id={sliderId}
          className="wager-slider w-full"
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
        <div className="flex justify-between text-xs font-bold text-[var(--muted)]">
          <span>0</span>
          <span className="text-base text-[var(--text)] tabular-nums">
            {clamped}
          </span>
          <span>{max}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { label: "Keep all", value: 0 },
              {
                label: "Half new",
                value: wagerFromPreset("half_new", earned, banked),
              },
              {
                label: "All new",
                value: wagerFromPreset("all_new", earned, banked),
              },
            ] as const
          ).map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={
                "btn-secondary !min-h-12 !px-2 text-sm " +
                (clamped === preset.value ? "ring-2 ring-[var(--text)]" : "")
              }
              aria-pressed={clamped === preset.value}
              onClick={() => setAmount(preset.value)}
            >
              <span className="block">{preset.label}</span>
              <span className="mt-0.5 block text-lg font-extrabold">
                {preset.value}
              </span>
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
