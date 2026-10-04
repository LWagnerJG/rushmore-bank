"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicDiceBroadcast } from "@/shared/types";
import { resolveDicePresentPhase } from "@/shared/engine/dice-present";
import {
  DIE_PIP_CLASS,
  diePaintModel,
  resolveTrayPaint,
  scramblePaintPair,
  type DieFace,
} from "@/shared/engine/die-face";
import { SCRAMBLE_TICK_MS } from "@/shared/engine/dice-scramble";
import {
  ensureDiceAudio,
  playRollStart,
  playRollTick,
  playSettle,
} from "@/lib/dice-sfx";
import { haptic } from "@/lib/haptics";

/**
 * Flat 2D pip die — one validated face (1–6) or blank.
 *
 * Pips are derived purely from `normalizeDieFace(face)` each render.
 * React replaces the circle children — never appends / never stacks.
 */
function PipDie({
  face,
  index,
  tumbling,
  scrambling,
  settled,
  settlePunch,
}: {
  face: DieFace | null;
  index: 0 | 1;
  tumbling: boolean;
  scrambling: boolean;
  settled: boolean;
  settlePunch: boolean;
}) {
  const paint = diePaintModel(face);
  const className = [
    "bean-pip-die",
    `bean-pip-die-${index}`,
    tumbling ? "bean-pip-die-tumbling" : "",
    settlePunch ? "bean-pip-die-settle" : "",
    settled ? "bean-pip-die-known" : "",
    scrambling ? "bean-pip-die-scrambling" : "",
    paint.face == null ? "bean-pip-die-blank" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      data-die-index={index}
      data-face={paint.face ?? ""}
      data-pip-count={paint.pipCount}
      data-tumbling={tumbling ? "1" : "0"}
      data-settled={settled ? "1" : "0"}
      data-scrambling={scrambling ? "1" : "0"}
      aria-hidden="true"
    >
      <svg viewBox="0 0 80 80" className="bean-pip-die-svg">
        <rect
          x="3"
          y="3"
          width="74"
          height="74"
          rx="12"
          className="bean-pip-die-body"
        />
        {/* Replace-only: map from one validated face. Keys force full remount on face change. */}
        {paint.pipSlots.map((pip) => {
          const col = pip % 3;
          const row = Math.floor(pip / 3);
          return (
            <circle
              key={`${paint.face}-${pip}`}
              className={DIE_PIP_CLASS}
              cx={22 + col * 18}
              cy={22 + row * 18}
              r="7"
              data-pip-slot={pip}
            />
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Beautiful 2D dice tray with scramble anticipation.
 *
 * Presentation contract (hard invariant):
 * - Settled faces only from server authoritative d1/d2 for the current rollId.
 * - Scramble faces go through the same 1–6 validated renderer (no DOM pip stack).
 * - Pip count always equals the face value (1–6) or 0 when blank.
 * - Hard cut scramble → auth (no coast, no morph, no late jump).
 */
export function DiceScene({
  broadcast,
  reducedMotion,
  canRoll,
  onRoll,
  busted,
  firstRollHint = false,
}: {
  broadcast: PublicDiceBroadcast | null;
  reducedMotion: boolean;
  canRoll: boolean;
  onRoll: () => void;
  busted?: boolean;
  /** Stronger pulse / TAP on the first roll of a turn. */
  firstRollHint?: boolean;
}) {
  const audio = useRef<AudioContext | null>(null);
  const sounded = useRef<string | null>(null);
  const rollStarted = useRef<string | null>(null);
  const lastTick = useRef(0);
  const settleRollId = useRef<string | null>(null);
  const [punch, setPunch] = useState(false);
  const [scramble, setScramble] = useState<{ d1: DieFace; d2: DieFace } | null>(
    null,
  );

  const phase = useMemo(
    () => resolveDicePresentPhase(broadcast),
    [broadcast],
  );
  const rolling = phase.kind === "tumbling";
  const revealed = phase.kind === "settled";
  const rollId = phase.kind === "idle" ? null : phase.rollId;
  const scrambleSeed = phase.kind === "tumbling" ? phase.seed : 0;

  // Scramble via React state + validated faces — never imperative SVG appends.
  // When not tumbling, tray ignores scramble (no sync setState clear → no cascade).
  useEffect(() => {
    if (!rolling || reducedMotion) return;
    const started = performance.now();
    const tick = () => {
      const n = Math.max(
        1,
        Math.floor((performance.now() - started) / SCRAMBLE_TICK_MS),
      );
      setScramble(scramblePaintPair(scrambleSeed, n));
    };
    tick();
    const id = window.setInterval(tick, SCRAMBLE_TICK_MS);
    return () => window.clearInterval(id);
  }, [rolling, rollId, reducedMotion, scrambleSeed]);

  const tray = resolveTrayPaint(
    phase,
    rolling && !reducedMotion ? scramble : null,
  );
  const authD1 = tray.authD1;
  const authD2 = tray.authD2;
  const total = tray.total;
  const paintD1 = tray.paintD1;
  const paintD2 = tray.paintD2;

  // Settle punch / haptics once per rollId.
  useEffect(() => {
    if (!revealed || !rollId || authD1 == null || authD2 == null) return;
    if (settleRollId.current === rollId) return;
    settleRollId.current = rollId;
    if (reducedMotion) return;

    const kick = window.setTimeout(() => {
      setPunch(true);
      haptic(busted ? "bust" : "settle");
    }, 0);
    const clearPunch = window.setTimeout(() => setPunch(false), 700);
    return () => {
      window.clearTimeout(kick);
      window.clearTimeout(clearPunch);
    };
  }, [revealed, rollId, authD1, authD2, reducedMotion, busted]);

  // Tumble SFX — setInterval instead of perpetual rAF.
  useEffect(() => {
    if (phase.kind !== "tumbling" || !rollId || reducedMotion) return;

    if (rollStarted.current !== rollId) {
      rollStarted.current = rollId;
      void ensureDiceAudio().then((ctx) => {
        audio.current = ctx;
        playRollStart(ctx);
      });
    }

    const id = window.setInterval(() => {
      const now = Date.now();
      if (now - lastTick.current > 150) {
        lastTick.current = now;
        playRollTick(audio.current);
      }
    }, 150);
    return () => window.clearInterval(id);
  }, [phase.kind, rollId, reducedMotion]);

  useEffect(() => {
    if (!revealed || !rollId || sounded.current === rollId) return;
    if (authD1 == null || authD2 == null) return;
    sounded.current = rollId;
    void ensureDiceAudio().then((ctx) => {
      audio.current = ctx;
      playSettle(ctx, { busted: !!busted });
    });
  }, [revealed, rollId, authD1, authD2, busted]);

  async function handleRoll() {
    if (!canRoll) return;
    haptic("tap_roll");
    const ctx = await ensureDiceAudio();
    audio.current = ctx;
    playRollStart(ctx);
    onRoll();
  }

  const label = rolling
    ? "Dice rolling; result pending"
    : canRoll
      ? "TAP TO ROLL"
      : revealed && total != null
        ? `Dice show ${authD1} and ${authD2}, total ${total}`
        : "Two dice ready";

  const trayClass = [
    "bean-dice-tray",
    canRoll ? "bean-dice-tray-armed" : "",
    canRoll && firstRollHint ? "bean-dice-tray-first-hint" : "",
    rolling ? "bean-dice-tray-rolling" : "",
    punch ? "bean-dice-tray-punch" : "",
    busted && revealed ? "bean-dice-tray-bust" : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <div className="relative">
      <button
        type="button"
        className={trayClass}
        disabled={!canRoll}
        onClick={() => void handleRoll()}
        aria-label={label}
        aria-disabled={!canRoll}
        data-dice-phase={phase.kind}
        data-dice-d1={authD1 ?? ""}
        data-dice-d2={authD2 ?? ""}
        data-dice-total={total ?? ""}
        data-dice-scrambling={tray.scrambling ? "1" : "0"}
        data-dice-roll-id={tray.rollId ?? ""}
      >
        <div className="bean-dice-pair" role="img" aria-hidden="true">
          <PipDie
            face={paintD1}
            index={0}
            tumbling={rolling && !reducedMotion}
            scrambling={tray.scrambling}
            settled={!tray.scrambling && paintD1 != null}
            settlePunch={punch && revealed}
          />
          <PipDie
            face={paintD2}
            index={1}
            tumbling={rolling && !reducedMotion}
            scrambling={tray.scrambling}
            settled={!tray.scrambling && paintD2 != null}
            settlePunch={punch && revealed}
          />
        </div>
        {canRoll && (
          <span className={`bean-dice-hint ${firstRollHint ? "bean-dice-hint-first" : ""}`} aria-hidden="true">
            TAP
          </span>
        )}
        {rolling && (
          <span className="bean-dice-hint bean-dice-hint-rolling">
            Rolling…
          </span>
        )}
      </button>
    </div>
  );
}
