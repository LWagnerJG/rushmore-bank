"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicDiceBroadcast } from "@/shared/types";
import { resolveDicePresentPhase } from "@/shared/engine/dice-present";
import { DIE_PIPS } from "@/shared/engine/dice-geometry";
import {
  ensureDiceAudio,
  playRollStart,
  playRollTick,
  playSettle,
} from "@/lib/dice-sfx";
import { haptic } from "@/lib/haptics";

/**
 * Flat 2D pip die — no 3D projection.
 * `face` is set ONLY when settled/idle. During tumble, face is null so no
 * readable number can appear before the authoritative reveal.
 */
function PipDie({
  face,
  index,
  tumbling,
  settlePunch,
}: {
  face: number | null;
  index: 0 | 1;
  tumbling: boolean;
  settlePunch: boolean;
}) {
  const pips = face != null ? DIE_PIPS[face] ?? [] : [];
  const className = [
    "bean-pip-die",
    `bean-pip-die-${index}`,
    tumbling ? "bean-pip-die-tumbling" : "",
    settlePunch ? "bean-pip-die-settle" : "",
    face != null ? "bean-pip-die-known" : "bean-pip-die-blank",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      data-die-index={index}
      data-face={face ?? ""}
      data-tumbling={tumbling ? "1" : "0"}
      aria-hidden="true"
    >
      <svg viewBox="0 0 80 80" className="bean-pip-die-svg">
        <rect
          x="4"
          y="4"
          width="72"
          height="72"
          rx="14"
          className="bean-pip-die-body"
        />
        {face != null &&
          pips.map((pip) => {
            const col = pip % 3;
            const row = Math.floor(pip / 3);
            return (
              <circle
                key={pip}
                className="bean-pip-die-pip"
                cx={22 + col * 18}
                cy={22 + row * 18}
                r="6.5"
              />
            );
          })}
        {tumbling && (
          <g className="bean-pip-die-scramble" opacity="0.35">
            <circle cx="28" cy="28" r="5" className="bean-pip-die-pip" />
            <circle cx="52" cy="40" r="5" className="bean-pip-die-pip" />
            <circle cx="34" cy="54" r="5" className="bean-pip-die-pip" />
          </g>
        )}
      </svg>
    </div>
  );
}

/**
 * Fail-proof dice tray.
 *
 * Presentation contract:
 * - Tumble shows blank/blurred shells only — never a readable settled face.
 * - The first frame that looks settled paints server d1/d2 exactly once.
 * - No 3D cube orientation, no seed-driven rest pose, no morph into faces.
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

  const phase = useMemo(
    () => resolveDicePresentPhase(broadcast),
    [broadcast],
  );
  const rolling = phase.kind === "tumbling";
  const revealed = phase.kind === "settled";
  const rollId = phase.kind === "idle" ? null : phase.rollId;

  // Authoritative faces only when idle/settled — never invent during tumble.
  const d1 =
    phase.kind === "settled" || phase.kind === "idle" ? phase.d1 : null;
  const d2 =
    phase.kind === "settled" || phase.kind === "idle" ? phase.d2 : null;
  const total = revealed && d1 != null && d2 != null ? d1 + d2 : null;

  // Settle punch / haptics once per rollId.
  useEffect(() => {
    if (!revealed || !rollId || d1 == null || d2 == null) return;
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
  }, [revealed, rollId, d1, d2, reducedMotion, busted]);

  // Tumble SFX only — no face painting.
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
      if (now - lastTick.current > 160) {
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
    if (d1 == null || d2 == null) return;
    sounded.current = rollId;
    void ensureDiceAudio().then((ctx) => {
      audio.current = ctx;
      playSettle(ctx, { busted: !!busted });
    });
  }, [revealed, rollId, d1, d2, busted]);

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
        ? `Dice show ${d1} and ${d2}, total ${total}`
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
        data-dice-d1={d1 ?? ""}
        data-dice-d2={d2 ?? ""}
      >
        <div className="bean-dice-pair" role="img" aria-hidden="true">
          <PipDie
            face={rolling ? null : d1}
            index={0}
            tumbling={rolling && !reducedMotion}
            settlePunch={punch && revealed}
          />
          <PipDie
            face={rolling ? null : d2}
            index={1}
            tumbling={rolling && !reducedMotion}
            settlePunch={punch && revealed}
          />
        </div>
        {canRoll && <span className="bean-dice-hint">Tap to roll</span>}
        {rolling && (
          <span className="absolute bottom-3 left-0 right-0 text-center text-xs font-bold text-white/85">
            Rolling…
          </span>
        )}
      </button>
    </div>
  );
}
