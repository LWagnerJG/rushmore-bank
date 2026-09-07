"use client";

import { useState } from "react";
import {
  BANK_ACTIONS,
  type BankAction,
  type ClientMessage,
  type RoomState,
} from "@/shared/types";

export function BankPanel({
  state,
  youId,
  send,
}: {
  state: RoomState;
  youId: string;
  send: (msg: ClientMessage) => void;
}) {
  const you = state.players.find((p) => p.id === youId);
  const existing = state.bankWagers.find((w) => w.playerId === youId);
  const [action, setAction] = useState<BankAction>(existing?.action ?? "pot_shot");
  const [amount, setAmount] = useState(existing?.amount ?? 2);
  const meta = BANK_ACTIONS.find((a) => a.id === action)!;

  const waiting = state.players
    .filter((p) => p.connected || p.isBot)
    .filter((p) => !state.bankWagers.some((w) => w.playerId === p.id));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-900/40 to-transparent p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">
            BANK table
          </p>
          <h3 className="font-[family-name:var(--font-display)] text-3xl text-emerald-100">
            Place your wager
          </h3>
        <p className="mt-1 text-sm text-emerald-100/70">
          One 2d6 resolves everyone. Pot sits at {state.pot}. You have{" "}
          {you?.chips ?? 0} chips. ~30 seconds — pick a wager.
        </p>
      </div>

      {!existing ? (
        <>
          <div className="grid gap-2">
            {BANK_ACTIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  action === a.id
                    ? "border-emerald-300 bg-emerald-400/15 text-emerald-100"
                    : "border-white/10 bg-white/5 text-[var(--foam)]"
                }`}
                onClick={() => {
                  setAction(a.id);
                  setAmount(a.defaultAmount);
                }}
              >
                <div className="font-semibold">{a.label}</div>
                <div className="text-sm opacity-75">{a.blurb}</div>
              </button>
            ))}
          </div>

          {meta.maxAmount > meta.minAmount && (
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-[var(--muted)]">
                Wager amount ({meta.minAmount}–{meta.maxAmount})
              </span>
              <input
                type="number"
                className="field w-full"
                min={meta.minAmount}
                max={Math.min(meta.maxAmount, you?.chips ?? 0)}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </label>
          )}

          <button
            type="button"
            className="btn-primary w-full"
            onClick={() =>
              send({
                type: "submit_bank",
                action,
                amount: action === "skip" ? 0 : amount,
              })
            }
          >
            Lock wager
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <p className="rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-[var(--muted)]">
            You locked <span className="text-[var(--foam)]">{existing.action}</span>
            {existing.amount > 0 ? ` (${existing.amount})` : ""}. Waiting on{" "}
            {waiting.map((p) => p.name).join(", ") || "the dice…"}
          </p>
          {you?.isHost && waiting.length > 0 && (
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => send({ type: "roll_bank" })}
            >
              Force roll now
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function BankRevealPanel({
  state,
  youId,
  send,
}: {
  state: RoomState;
  youId: string;
  send: (msg: ClientMessage) => void;
}) {
  const you = state.players.find((p) => p.id === youId);
  const result = state.bankResult;
  if (!result) return null;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Dice
        </p>
        <div className="mt-2 flex items-center justify-center gap-3">
          {result.dice.map((d, i) => (
            <div
              key={i}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--foam)] font-[family-name:var(--font-display)] text-3xl text-[var(--ink)] shadow-lg"
            >
              {d}
            </div>
          ))}
        </div>
        <p className="mt-3 font-[family-name:var(--font-display)] text-4xl text-[var(--gold)]">
          Total {result.total}
        </p>
      </div>

      <div className="space-y-2">
        {result.outcomes.map((o) => {
          const name =
            state.players.find((p) => p.id === o.playerId)?.name ?? "Player";
          return (
            <div
              key={o.playerId}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{name}</div>
                <div
                  className={`tabular-nums font-semibold ${
                    o.delta > 0
                      ? "text-emerald-300"
                      : o.delta < 0
                        ? "text-rose-300"
                        : "text-[var(--muted)]"
                  }`}
                >
                  {o.delta > 0 ? `+${o.delta}` : o.delta}
                </div>
              </div>
              <p className="text-sm text-[var(--muted)]">{o.note}</p>
            </div>
          );
        })}
      </div>

      <p className="text-center text-sm text-[var(--muted)]">
        Table pot now {state.pot}
      </p>

      {you?.isHost && (
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => send({ type: "advance" })}
        >
          Next Rushmore round
        </button>
      )}
      {!you?.isHost && (
        <p className="text-center text-sm text-[var(--muted)]">
          Waiting for host…
        </p>
      )}
    </div>
  );
}
