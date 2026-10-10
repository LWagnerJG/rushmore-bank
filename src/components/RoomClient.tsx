"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useGameRoom } from "@/hooks/useGameRoom";
import type { Phase } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { BrandMark } from "@/components/BrandMark";
import { SettingsSheet } from "@/components/SettingsSheet";
import { DiagPanel } from "@/components/DiagPanel";
import { RoomNotice } from "@/components/RoomNotice";
import { ErrorToast } from "@/components/ErrorToast";
import { FinalRoundCue } from "@/components/FinalRoundCue";
import { MotionSettle } from "@/components/MotionSettle";
import {
  adoptPlayerIdForRejoin,
  getLastPlayerIdForRejoin,
  recallDisplayName,
  recallRoomSession,
  wasRemovedFromRoom,
} from "@/lib/party";
import { LobbyPanel } from "@/components/LobbyPanel";
import { TopicPanel } from "@/components/TopicPanel";
import { DraftPanel } from "@/components/DraftPanel";
import { ReviewPanel } from "@/components/ReviewPanel";
import { VotePanel } from "@/components/VotePanel";
import { ScorePanel } from "@/components/ScorePanel";
import { WagerPanel } from "@/components/WagerPanel";
import { DicePanel } from "@/components/DicePanel";
import { ResultsPanel } from "@/components/ResultsPanel";
import { PlayerRail } from "@/components/PlayerRail";
import { shouldFireFinalRoundCue } from "@/shared/final-round-cue";
import { isSoundEnabled } from "@/lib/sound-prefs";
import { armGestureUnlock } from "@/lib/sfx";

function DraftBannerClock({
  until,
  paused,
}: {
  until: number | null;
  paused: boolean;
}) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () =>
      setLeft(until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0);
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [until]);
  const urgent = !paused && left > 0 && left <= 10;
  return (
    <span
      className={
        "draft-timer-pill tabular-nums" +
        (urgent ? " draft-timer-pill-urgent" : "")
      }
      aria-live="polite"
    >
      {paused ? "‖" : `${left}s`}
    </span>
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
  // Reclaim prior seat id BEFORE opening the socket so soft-disconnect grace
  // cancels on the matching connection — no hunt for Rejoin after app switch.
  const [sessionResume] = useState(() => {
    if (typeof window === "undefined") return null;
    if (presetName.trim()) return null;
    const session = recallRoomSession(code);
    if (session?.playerId) adoptPlayerIdForRejoin(code, session.playerId);
    return session;
  });

  const {
    state,
    you,
    youId,
    error,
    setError,
    connected,
    joined,
    removed,
    seatContested,
    join,
    send,
    defaultName,
  } = useGameRoom(code, {
    preferredName: presetName || sessionResume?.name || "",
    preferSpectate: preferSpectate || sessionResume?.role === "spectator",
  });
  const [name, setName] = useState(presetName || defaultName);
  const [rejoinId] = useState(() => getLastPlayerIdForRejoin(code));

  function handleRejoin() {
    const id = getLastPlayerIdForRejoin(code);
    if (!id) return;
    adoptPlayerIdForRejoin(code, id);
    const n = (name.trim() || recallDisplayName()).trim();
    const q = n ? `?name=${encodeURIComponent(n)}` : "";
    window.location.assign(`/room/${code}${q}`);
  }

  // Retry join on every connected rising edge (lost first join / flap).
  useEffect(() => {
    if (removed || wasRemovedFromRoom(code) || seatContested) return;
    const clean = (presetName.trim() || sessionResume?.name || "").trim();
    if (!connected || joined || !clean) return;
    join(
      clean,
      preferSpectate || sessionResume?.role === "spectator"
        ? "spectator"
        : "player",
    );
  }, [
    connected,
    joined,
    removed,
    seatContested,
    code,
    presetName,
    preferSpectate,
    join,
    sessionResume?.name,
    sessionResume?.role,
  ]);

  const phase: Phase | null = state?.phase ?? null;
  const partyOn = state?.settings.partyMode === true;
  // If Sound was left on, arm the next tap to unlock AudioContext (iOS).
  useEffect(() => {
    if (isSoundEnabled()) armGestureUnlock();
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("diag") === "1",
  );
  const [finalCueActive, setFinalCueActive] = useState(false);
  const prevPhaseRef = useRef<Phase | null | undefined>(undefined);
  const finalCueShownKeyRef = useRef<string | null>(null);
  const logoTapRef = useRef(0);
  const logoTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleLogoTap() {
    logoTapRef.current += 1;
    if (logoTapTimerRef.current) clearTimeout(logoTapTimerRef.current);
    if (logoTapRef.current >= 5) {
      logoTapRef.current = 0;
      setDiagOpen((o) => !o);
      return;
    }
    logoTapTimerRef.current = setTimeout(() => {
      logoTapRef.current = 0;
    }, 1500);
    setSettingsOpen(true);
  }

  useEffect(() => {
    return () => {
      if (logoTapTimerRef.current) clearTimeout(logoTapTimerRef.current);
    };
  }, []);

  const drafting = phase === "DRAFT" || phase === "CORRECTION";

  useEffect(() => {
    const root = document.documentElement;
    if (partyOn) root.classList.add("party-on");
    else root.classList.remove("party-on");
    return () => root.classList.remove("party-on");
  }, [partyOn]);

  useEffect(() => {
    if (!state) return;
    const key = `${state.configuredTopicRounds}:${state.topicRound}`;
    const fire = shouldFireFinalRoundCue({
      phase: state.phase,
      topicRound: state.topicRound,
      configuredTopicRounds: state.configuredTopicRounds,
      prevPhase: prevPhaseRef.current,
    });
    prevPhaseRef.current = state.phase;
    if (!fire) return;
    if (finalCueShownKeyRef.current === key) return;
    finalCueShownKeyRef.current = key;
    setFinalCueActive(true);
  }, [state]);

  const body = useMemo(() => {
    if (!state || !you) return null;
    switch (state.phase) {
      case "LOBBY":
        return <LobbyPanel state={state} you={you} send={send} />;
      case "TOPIC_SELECTION":
        return <TopicPanel state={state} you={you} send={send} />;
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
    if (presetName.trim() && !removed) {
      return (
        <main className="app-shell app-shell-lock mx-auto flex max-w-md flex-col pt-0">
          <div className="app-safe-top" aria-hidden="true" />
          <div className="app-shell-scroll flex min-h-0 flex-1 flex-col gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
            <BrandMark chrome shimmer={false} onLogoTap={handleLogoTap} />
            <h1 className="type-display">Room {code}</h1>
            <p className="type-meta text-[var(--muted)]">
              {connected ? `Joining as ${presetName.trim()}…` : "Connecting…"}
            </p>
            {error && <p className="text-sm text-[var(--coral)]">{error}</p>}
            {!connected && (
              <p className="text-sm font-semibold text-[var(--muted)]">
                Reconnecting…
              </p>
            )}
            <Link href="/" className="text-sm font-semibold text-[var(--coral)]">
              ← Home
            </Link>
          </div>
        </main>
      );
    }

    return (
      <main className="app-shell app-shell-lock mx-auto flex max-w-md flex-col pt-0">
        <div className="app-safe-top" aria-hidden="true" />
        <div className="app-shell-scroll flex min-h-0 flex-1 flex-col gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          <BrandMark chrome shimmer={false} onLogoTap={handleLogoTap} />
          <h1 className="type-display">Room {code}</h1>
          <p className="type-meta text-[var(--muted)]">
            {removed
              ? "The host removed this seat. You can join again below."
              : connected
                ? "Connected — enter a nickname"
                : "Connecting…"}
          </p>
          <input
            className="field"
            value={name}
            maxLength={18}
            placeholder="Nickname"
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                join(name, preferSpectate ? "spectator" : "player");
            }}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => join(name, preferSpectate ? "spectator" : "player")}
          >
            Join game
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => join(name || "Spectator", "spectator")}
          >
            Watch only
          </button>
          {rejoinId && !removed && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleRejoin}
            >
              Rejoin this room
            </button>
          )}
          {error && <p className="type-meta text-[var(--coral)]">{error}</p>}
          {!connected && (
            <p className="type-meta font-semibold text-[var(--muted)]">
              Reconnecting…
            </p>
          )}
          <Link href="/" className="type-meta font-semibold text-[var(--coral)]">
            ← Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className={
        // Lock the shell; scroll lives in .room-phase-scroll below the chrome.
        // Scrolling the whole flex main + shrinkable animate-rise child let the
        // cream safe-area padding read as an opaque band over Topic vibes.
        "app-shell app-shell-lock mx-auto flex max-w-md flex-col px-4 pt-0"
      }
    >
      <header
        className={
          "room-chrome shrink-0 -mx-4 mb-3 " +
          (partyOn ? "room-chrome-party" : "")
        }
      >
        <div className="room-chrome-safe" aria-hidden="true" />
        <div className="room-chrome-body px-4 pb-2 pt-1">
          {/*
            Stable chrome row: brand (quiet) + end slot always same height so
            timer appear/disappear never shifts the topic hero below.
          */}
          <div className="room-chrome-top">
            <div className="room-chrome-brand min-w-0">
              <BrandMark chrome shimmer={false} onLogoTap={handleLogoTap} />
            </div>
            <div className="room-chrome-end">
              {drafting && state ? (
                <DraftBannerClock
                  until={state.pickDeadlineAt}
                  paused={state.pickPaused}
                />
              ) : phase === "LOBBY" ? (
                <div className="room-chrome-phase type-meta">
                  {partyOn ? (
                    <span className="room-chrome-pill normal-case tracking-normal">
                      Party
                    </span>
                  ) : null}
                  <span>Lobby</span>
                </div>
              ) : partyOn ? (
                <span className="room-chrome-pill">Party</span>
              ) : (
                <span className="room-chrome-end-spacer" aria-hidden="true" />
              )}
            </div>
          </div>
          {drafting && state?.selectedTopic ? (
            <h1 className="type-display room-chrome-topic">
              {state.selectedTopic.text}
            </h1>
          ) : null}
          <RoomNotice notice={state?.notice} hostOnly isHost={you.isHost} />
        </div>
      </header>

      {/*
        PlayerRail sits OUTSIDE .room-chrome so up-seat glow/transform never
        forces overflow:visible (or an expanded compositing layer) on the
        brand/BANK row — a remaining soft-rasterize path on iPhone after #88.
      */}
      {/* GAME_RESULTS: reveal list is the only score surface — hide the rail. */}
      {/*
        No standings mid-vote: hidden (not unmounted) during voting so the
        chips' score-land still fires when Score reveal brings them back.
      */}
      {state &&
        phase !== "LOBBY" &&
        phase !== "DICE" &&
        phase !== "GAME_RESULTS" && (
        <div
          className="room-rail-slot -mx-4 mb-2 px-4"
          hidden={phase === "VOTING_AND_JUDGING"}
        >
          <PlayerRail state={state} youId={youId} />
        </div>
      )}
      {phase === "SCORE_REVEAL" && you.role === "player" && state ? (
        <div className="ready-wager-row -mx-4 mb-2 px-4">
          <div className="ready-wager-meta" aria-live="polite">
            {state.bankBeansReadyCast}/{state.bankBeansReadyNeeded} ready
          </div>
          <button
            type="button"
            className={
              "ready-wager-cta " +
              (state.myBankBeansReady ? "ready-wager-cta-done" : "pulse-soft")
            }
            disabled={state.myBankBeansReady}
            onClick={() => send({ type: "bank_the_beans" })}
          >
            {state.myBankBeansReady ? "Ready" : "Ready to wager"}
          </button>
        </div>
      ) : null}

      <div className="room-phase-scroll min-h-0 flex-1">
        {!connected && (
          <p
            className="mb-1.5 text-xs font-semibold tracking-wide text-[var(--muted)] opacity-80"
            aria-live="polite"
          >
            Reconnecting…
          </p>
        )}
        {phase === "SCORE_REVEAL" ? (
          <div className="phase-panel flex min-h-full flex-col pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {body}
          </div>
        ) : (
          // key=phase remounts MotionSettle so enter runs once, then
          // .motion-settled strips transform/will-change (iOS soft-raster fix).
          // min-h-full lets sticky primary CTAs pin to the scrollport bottom.
          <MotionSettle
            key={phase ?? "none"}
            motionClass="phase-enter"
            className="phase-panel flex min-h-full flex-col pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            {body}
          </MotionSettle>
        )}
      </div>
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomCode={code}
        isHost={you?.isHost ?? false}
        partyOn={partyOn}
        hostAiJudge={you?.isHost ? state?.hostAiJudge : undefined}
        onPartyChange={
          you?.isHost
            ? (next) =>
                send({ type: "update_settings", settings: { partyMode: next } })
            : undefined
        }
        send={send}
        currentPhase={phase}
        playerCount={
          state?.players.filter((p) => p.role === "player").length ?? 0
        }
        botCountInRoom={
          state?.players.filter((p) => p.id.startsWith("bot-")).length ?? 0
        }
        drafting={drafting}
        pickPaused={state?.pickPaused ?? false}
      />
      {diagOpen && <DiagPanel onClose={() => setDiagOpen(false)} />}
      <ErrorToast error={error} onDismiss={() => setError(null)} />
      <FinalRoundCue
        active={finalCueActive}
        onDone={() => setFinalCueActive(false)}
      />
    </main>
  );
}
