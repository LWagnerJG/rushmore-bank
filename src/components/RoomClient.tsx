"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useGameRoom } from "@/hooks/useGameRoom";
import { phaseLabel, type Phase } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { BrandMark } from "@/components/BrandMark";
import { getPartyHost } from "@/lib/party";
import { LobbyPanel } from "@/components/LobbyPanel";
import { TopicPanel } from "@/components/TopicPanel";
import { PrepPanel } from "@/components/PrepPanel";
import { DraftPanel } from "@/components/DraftPanel";
import { ReviewPanel } from "@/components/ReviewPanel";
import { VotePanel } from "@/components/VotePanel";
import { ScorePanel } from "@/components/ScorePanel";
import { WagerPanel } from "@/components/WagerPanel";
import { DicePanel } from "@/components/DicePanel";
import { ResultsPanel } from "@/components/ResultsPanel";
import { PlayerRail } from "@/components/PlayerRail";

export function RoomClient(props: { code: string; presetName: string; preferSpectate: boolean }) {
  if (!getPartyHost()) return <main className="mx-auto max-w-md space-y-5 px-5 py-12">
    <BrandMark />
    <h1 className="text-2xl font-extrabold">Almost ready for friends.</h1>
    <p>This test build is waiting for its own game server. The live game stays separate.</p>
    <Link href="/" className="btn-secondary inline-flex items-center">Back to Beans</Link>
  </main>;
  return <ConnectedRoomClient {...props} />;
}

function ConnectedRoomClient({
  code,
  presetName,
  preferSpectate,
}: {
  code: string;
  presetName: string;
  preferSpectate: boolean;
}) {
  const {
    state,
    you,
    youId,
    error,
    setError,
    connected,
    joined,
    join,
    send,
    defaultName,
  } = useGameRoom(code, {
    preferredName: presetName,
    preferSpectate,
  });
  const [name, setName] = useState(presetName || defaultName);
  const autoJoinAttempted = useRef(false);

  // One-shot: when connected with a URL/preset nickname, join explicitly so we
  // do not rely on shared localStorage for the display name.
  useEffect(() => {
    if (autoJoinAttempted.current) return;
    const clean = presetName.trim();
    if (!connected || joined || !clean) return;
    autoJoinAttempted.current = true;
    join(clean, preferSpectate ? "spectator" : "player");
  }, [connected, joined, presetName, preferSpectate, join]);

  // AI judging is server-authoritative — no host browser fetch/submit.

  const phase: Phase | null = state?.phase ?? null;

  const body = useMemo(() => {
    if (!state || !you) return null;
    switch (state.phase) {
      case "LOBBY":
        return <LobbyPanel state={state} you={you} send={send} />;
      case "TOPIC_SELECTION":
        return <TopicPanel state={state} you={you} send={send} />;
      case "PREP":
        return (
          <PrepPanel state={state} you={you} youId={youId} send={send} />
        );
      case "DRAFT":
      case "CORRECTION":
        return (
          <DraftPanel key={state.selectedTopic?.id} state={state} you={you} youId={youId} send={send} />
        );
      case "REVIEW":
        return <ReviewPanel state={state} you={you} send={send} />;
      case "VOTING_AND_JUDGING":
        return <VotePanel state={state} you={you} youId={youId} send={send} />;
      case "SCORE_REVEAL":
        return <ScorePanel state={state} you={you} send={send} />;
      case "WAGER_SELECTION":
        return <WagerPanel state={state} you={you} youId={youId} send={send} />;
      case "DICE":
        return <DicePanel state={state} you={you} youId={youId} send={send} />;
      case "ROUND_RESULTS":
      case "GAME_RESULTS":
        return <ResultsPanel state={state} you={you} send={send} />;
      default:
        return null;
    }
  }, [state, you, youId, send]);

  if (!joined || !you) {
    // Keep manual Join form when there is no preset nickname.
    if (presetName.trim()) {
      return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
          <BrandMark />
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
            Room {code}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {connected ? `Joining as ${presetName.trim()}…` : "Connecting…"}
          </p>
          {error && <p className="text-sm text-[var(--coral)]">{error}</p>}
          <Link href="/" className="text-sm font-semibold text-[var(--coral)]">
            ← Home
          </Link>
        </main>
      );
    }

    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
        <BrandMark />
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
          Room {code}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {connected ? "Connected — enter nickname" : "Connecting…"}
        </p>
        <input
          className="field"
          value={name}
          maxLength={18}
          placeholder="Nickname"
          aria-label="Your nickname"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") join(name, preferSpectate ? "spectator" : "player");
          }}
        />
        <button
          type="button"
          className="btn-primary"
          disabled={!connected || !name.trim()}
          onClick={() => join(name, preferSpectate ? "spectator" : "player")}
        >
          Join
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => join(name || "Spectator", "spectator")}
        >
          Watch (TV / spectator)
        </button>
        {error && <p className="text-sm text-[var(--coral)]">{error}</p>}
        <Link href="/" className="text-sm font-semibold text-[var(--coral)]">
          ← Home
        </Link>
      </main>
    );
  }

  return (
    <main className={`mx-auto flex min-h-dvh flex-col px-4 pb-8 pt-3 ${phase === "DRAFT" || phase === "CORRECTION" ? "max-w-3xl" : "max-w-md"}`}>
      <header className="sticky top-0 z-20 -mx-4 mb-3 border-b border-[rgba(35,72,62,0.08)] bg-[rgba(245,240,231,0.92)] px-4 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <BrandMark />
          <div className="text-right text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            <div>{phase === "VOTING_AND_JUDGING" && state?.seatOrder.length === 2 ? "Judging" : phase ? phaseLabel(phase) : "…"}</div>
            <div className="text-[var(--text)]">
              {you.stones} {RULES.currencyName}
            </div>
          </div>
        </div>
        {state && phase !== "LOBBY" && phase !== "DRAFT" && phase !== "CORRECTION" && phase !== "DICE" && <PlayerRail state={state} youId={youId} />}
        {state?.notice && (
          <p className="mt-1 text-xs font-semibold text-[var(--coral)]">
            {state.notice}
          </p>
        )}
      </header>

      {!connected && (
        <p className="mb-2 text-sm font-semibold text-[var(--coral)]">
          Reconnecting…
        </p>
      )}
      {error && (
        <p className="mb-2 text-sm text-[var(--coral)]" role="alert">
          {error}{" "}
          <button type="button" className="underline" onClick={() => setError(null)}>
            dismiss
          </button>
        </p>
      )}

      <div className="animate-rise flex-1">{body}</div>
    </main>
  );
}
