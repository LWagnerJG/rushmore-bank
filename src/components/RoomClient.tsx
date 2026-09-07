"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useGameRoom } from "@/hooks/useGameRoom";
import { phaseLabel, type Phase } from "@/shared/types";
import { RULES } from "@/shared/rules";
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

function BrandMark() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className="stone-tile !h-5 !w-5 !text-[0.55rem]">
            {n}
          </span>
        ))}
      </div>
      <span className="font-[family-name:var(--font-display)] text-lg font-extrabold">
        {RULES.displayName}
      </span>
    </div>
  );
}

export function RoomClient({
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
  } = useGameRoom(code);
  const [name, setName] = useState(presetName || defaultName);
  const judgedRev = useRef<number>(-1);

  // Trigger AI judge once when voting starts (host)
  useEffect(() => {
    if (!state || !you?.isHost) return;
    if (state.phase !== "VOTING_AND_JUDGING") return;
    if (state.scores.length > 0 || state.scoresLocked) return;
    if (judgedRev.current === state.phaseRevision) return;
    judgedRev.current = state.phaseRevision;

    const topic = state.selectedTopic;
    if (!topic) return;

    const rosters = state.seatOrder.map((pid) => {
      const p = state.players.find((x) => x.id === pid);
      const picks = state.picks
        .filter((pk) => pk.playerId === pid)
        .sort((a, b) => a.pickIndex - b.pickIndex)
        .map((pk) => pk.text);
      return { playerId: pid, name: p?.name ?? "?", picks };
    });

    void (async () => {
      try {
        const res = await fetch("/api/judge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: topic.text,
            scopeBoundary: topic.scopeBoundary,
            rosters,
          }),
        });
        const data = (await res.json()) as {
          judgments: Array<{
            playerId: string;
            topicFit: number;
            pickStrength: number;
            rosterQuality: number;
            explanation: string;
          }>;
          fallback?: boolean;
        };
        send({
          type: "submit_ai_judgments",
          judgments: data.judgments,
          fallback: !!data.fallback,
        });
      } catch {
        send({
          type: "submit_ai_judgments",
          judgments: [],
          fallback: true,
        });
      }
    })();
  }, [state, you?.isHost, send]);

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
          <DraftPanel state={state} you={you} youId={youId} send={send} />
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
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") join(name, preferSpectate ? "spectator" : "player");
          }}
        />
        <button
          type="button"
          className="btn-primary"
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-8 pt-3">
      <header className="sticky top-0 z-20 -mx-4 mb-3 border-b border-[rgba(35,72,62,0.08)] bg-[rgba(245,240,231,0.92)] px-4 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <BrandMark />
          <div className="text-right text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            <div>{phase ? phaseLabel(phase) : "…"}</div>
            <div className="text-[var(--text)]">
              {you.stones} {RULES.currencyName}
            </div>
          </div>
        </div>
        {state && <PlayerRail state={state} youId={youId} />}
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
