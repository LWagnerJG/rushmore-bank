"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicDiceBroadcast } from "@/shared/types";
import { resolveDicePresentPhase } from "@/shared/engine/dice-present";
import { DIE_PIPS } from "@/shared/engine/dice-geometry";
import {
  scrambleFaceAt,
  SCRAMBLE_TICK_MS,
} from "@/shared/engine/dice-scramble";
import {
  ensureDiceAudio,
  playRollStart,
  playRollTick,
  playSettle,
} from "@/lib/dice-sfx";
import { haptic } from "@/lib/haptics";

/**
 * Flat 2D pip die — calculator-clear layout, Beans cream/ink palette.
 *
 * `face` during tumble is a scramble value (anticipation only).
 * `settled` is true ONLY for authoritative idle/settled faces.
 */
function PipDie({
  face,
  index,
  tumbling,
  scrambling,
  settled,
  settlePunch,
}: {
  face: number | null;
  index: 0 | 1;
  tumbling: boolean;
  scrambling: boolean;
  settled: boolean;
  settlePunch: boolean;
}) {
  const pips = face != null ? DIE_PIPS[face] ?? [] : [];
  const className = [
    "bean-pip-die",
    `bean-pip-die-${index}`,
    tumbling ? "bean-pip-die-tumbling" : "",
    settlePunch ? "bean-pip-die-settle" : "",
    settled ? "bean-pip-die-known" : "",
    scrambling ? "bean-pip-die-scrambling" : "",
    face == null ? "bean-pip-die-blank" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      data-die-index={index}
      data-face={face ?? ""}
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
        {face != null &&
          pips.map((pip) => {
            const col = pip % 3;
            const row = Math.floor(pip / 3);
            return (
              <circle
                key={`${face}-${pip}`}
                className="bean-pip-die-pip"
                cx={22 + col * 18}
                cy={22 + row * 18}
                r="7"
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
 * - During tumble: rapidly changing scramble faces (never tray d1/d2).
 * - The first frame that looks settled paints server d1/d2 exactly once.
 * - No coast from scramble → fake rest → jump. Hard cut on settle.
 */
export function DiceScene({
  broadcast,
  reducedMotion,
  canRoll,
  onRoll,
  busted,
}: {
  broadcast: PublicDiceBroadcast | null;
  reducedMotion: boolean;
  canRoll: boolean;
  onRoll: () => void;
  busted?: boolean;
}) {
  const audio = useRef<AudioContext | null>(null);
  const sounded = useRef<string | null>(null);
  const rollStarted = useRef<string | null>(null);
  const lastTick = useRef(0);
  const settleRollId = useRef<string | null>(null);
  const [punch, setPunch] = useState(false);
  const [scrambleTick, setScrambleTick] = useState(0);

  const phase = useMemo(
    () => resolveDicePresentPhase(broadcast),
    [broadcast],
  );
  const rolling = phase.kind === "tumbling";
  const revealed = phase.kind === "settled";
  const rollId = phase.kind === "idle" ? null : phase.rollId;
  const scrambleSeed = phase.kind === "tumbling" ? phase.seed : 0;

  // Authoritative faces only when idle/settled — never invent during tumble.
  const authD1 =
    phase.kind === "settled" || phase.kind === "idle" ? phase.d1 : null;
  const authD2 =
    phase.kind === "settled" || phase.kind === "idle" ? phase.d2 : null;
  const total =
    revealed && authD1 != null && authD2 != null ? authD1 + authD2 : null;

  // Scramble ticks only while tumbling — stops dead on settle (no coast).
  useEffect(() => {
    if (!rolling || reducedMotion) {
      setScrambleTick(0);
      return;
    }
    setScrambleTick(0);
    const started = performance.now();
    const id = window.setInterval(() => {
      setScrambleTick(
        Math.max(1, Math.floor((performance.now() - started) / SCRAMBLE_TICK_MS)),
      );
    }, SCRAMBLE_TICK_MS);
    return () => window.clearInterval(id);
  }, [rolling, rollId, reducedMotion]);

  const scrambleD1 =
    rolling && !reducedMotion
      ? scrambleFaceAt(scrambleSeed, 0, scrambleTick)
      : null;
  const scrambleD2 =
    rolling && !reducedMotion
      ? scrambleFaceAt(scrambleSeed, 1, scrambleTick)
      : null;

  // Paint: scramble during tumble; auth faces the instant we settle.
  // Reduced-motion tumble stays blank (no fake settled face).
  const paintD1 = rolling ? scrambleD1 : authD1;
  const paintD2 = rolling ? scrambleD2 : authD2;

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

  // Tumble SFX.
  useEffect(() => {
    if (phase.kind !== "tumbling" || !rollId || reducedMotion) return;

    if (rollStarted.current !== rollId) {
      rollStarted.current = rollId;
      void ensureDiceAudio().then((ctx) => {
        audio.current = ctx;
        playRollStart(ctx);
      });
    }

    let frame = 0;
    const tick = () => {
      const now = Date.now();
      if (now - lastTick.current > 150) {
        lastTick.current = now;
        playRollTick(audio.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
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
      ? "Tap dice to roll"
      : revealed && total != null
        ? `Dice show ${authD1} and ${authD2}, total ${total}`
        : "Two dice ready";

  const trayClass = [
    "bean-dice-tray",
    canRoll ? "bean-dice-tray-armed" : "",
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
        data-dice-scrambling={rolling ? "1" : "0"}
      >
        <div className="bean-dice-pair" role="img" aria-hidden="true">
          <PipDie
            face={paintD1}
            index={0}
            tumbling={rolling && !reducedMotion}
            scrambling={rolling}
            settled={!rolling && paintD1 != null}
            settlePunch={punch && revealed}
          />
          <PipDie
            face={paintD2}
            index={1}
            tumbling={rolling && !reducedMotion}
            scrambling={rolling}
            settled={!rolling && paintD2 != null}
            settlePunch={punch && revealed}
          />
        </div>
        {canRoll && <span className="bean-dice-hint">Tap to roll</span>}
        {rolling && (
          <span className="bean-dice-hint bean-dice-hint-rolling">
            Rolling…
          </span>
        )}
      </button>
    </div>
  );
}
