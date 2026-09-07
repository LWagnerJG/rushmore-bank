"use client";

import { useEffect, useRef, useState } from "react";
import { useGameRoom } from "../hooks/useGameRoom";
import { PhaseBanner } from "./PhaseBanner";
import { PlayerRail } from "./PlayerRail";
import { LobbyPanel } from "./LobbyPanel";
import { CategoryPanel } from "./CategoryPanel";
import { BuildPanel } from "./BuildPanel";
import { RankPanel } from "./RankPanel";
import { RevealPanel } from "./RevealPanel";
import { BankPanel, BankRevealPanel } from "./BankPanel";

export function RoomClient({ code }: { code: string }) {
  const {
    state,
    youId,
    you,
    error,
    setError,
    connected,
    joined,
    join,
    send,
    defaultName,
  } = useGameRoom(code);
  const [name, setName] = useState(defaultName);
  const autoTried = useRef(false);

  useEffect(() => {
    if (autoTried.current || joined || !connected || !defaultName) return;
    autoTried.current = true;
    join(defaultName);
  }, [joined, connected, defaultName, join]);


  if (!joined || !state || !you) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--gold)]">
            Join room
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-5xl text-[var(--foam)]">
            Rushmore Bank
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            Room <span className="text-[var(--gold)]">{code.toUpperCase()}</span>
            {" · "}
            {connected ? "connected" : "connecting…"}
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-[var(--muted)]">
            Display name
          </span>
          <input
            className="field w-full"
            value={name}
            maxLength={18}
            placeholder="What should we call you?"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") join(name);
            }}
          />
        </label>
        <button
          type="button"
          className="btn-primary w-full"
          disabled={!connected}
          onClick={() => join(name)}
        >
          Enter lobby
        </button>
        {error && (
          <p className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-4 px-4 py-5 pb-10">
      <PhaseBanner phase={state.phase} round={state.round} pot={state.pot} />
      <PlayerRail players={state.players} youId={youId} />

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
          <span>{error}</span>
          <button
            type="button"
            className="shrink-0 underline"
            onClick={() => setError(null)}
          >
            dismiss
          </button>
        </div>
      )}

      <div className="animate-rise flex-1">
        {state.phase === "lobby" && (
          <LobbyPanel state={state} youId={youId} send={send} />
        )}
        {state.phase === "category" && (
          <CategoryPanel state={state} youId={youId} send={send} />
        )}
        {state.phase === "build" && (
          <BuildPanel state={state} youId={youId} send={send} />
        )}
        {state.phase === "rank" && (
          <RankPanel state={state} youId={youId} send={send} />
        )}
        {state.phase === "reveal" && (
          <RevealPanel state={state} youId={youId} send={send} />
        )}
        {state.phase === "bank" && (
          <BankPanel state={state} youId={youId} send={send} />
        )}
        {state.phase === "bank_reveal" && (
          <BankRevealPanel state={state} youId={youId} send={send} />
        )}
      </div>
    </div>
  );
}
