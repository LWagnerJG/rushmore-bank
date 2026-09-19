"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
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

/** Paint pip circles into an SVG without React re-render (scramble path). */
function paintPips(svg: SVGSVGElement | null, face: number | null) {
  if (!svg) return;
  const existing = svg.querySelectorAll(".bean-pip-die-pip");
  existing.forEach((n) => n.remove());
  const body = svg.querySelector(".bean-pip-die-body");
  if (face == null) {
    svg.parentElement?.classList.add("bean-pip-die-blank");
    return;
  }
  svg.parentElement?.classList.remove("bean-pip-die-blank");
  const pips = DIE_PIPS[face] ?? [];
  const ns = "http://www.w3.org/2000/svg";
  for (const pip of pips) {
    const col = pip % 3;
    const row = Math.floor(pip / 3);
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("class", "bean-pip-die-pip");
    c.setAttribute("cx", String(22 + col * 18));
    c.setAttribute("cy", String(22 + row * 18));
    c.setAttribute("r", "7");
    svg.appendChild(c);
  }
  if (body) {
    /* keep body as first child */
  }
}

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
  svgRef,
}: {
  face: number | null;
  index: 0 | 1;
  tumbling: boolean;
  scrambling: boolean;
  settled: boolean;
  settlePunch: boolean;
  svgRef?: RefObject<SVGSVGElement | null>;
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
      <svg ref={svgRef} viewBox="0 0 80 80" className="bean-pip-die-svg">
        <rect
          x="3"
          y="3"
          width="74"
          height="74"
          rx="12"
          className="bean-pip-die-body"
        />
        {/* During scramble, pips are painted via DOM; React paints auth faces. */}
        {!scrambling &&
          face != null &&
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
  const svg0 = useRef<SVGSVGElement | null>(null);
  const svg1 = useRef<SVGSVGElement | null>(null);
  const [punch, setPunch] = useState(false);

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

  // Scramble via DOM paints — avoid ~10Hz React setState during tumble.
  useEffect(() => {
    if (!rolling || reducedMotion) return;
    const started = performance.now();
    const tick = () => {
      const n = Math.max(
        1,
        Math.floor((performance.now() - started) / SCRAMBLE_TICK_MS),
      );
      paintPips(svg0.current, scrambleFaceAt(scrambleSeed, 0, n));
      paintPips(svg1.current, scrambleFaceAt(scrambleSeed, 1, n));
    };
    tick();
    const id = window.setInterval(tick, SCRAMBLE_TICK_MS);
    return () => window.clearInterval(id);
  }, [rolling, rollId, reducedMotion, scrambleSeed]);

  // Paint: blank during tumble (DOM scramble fills pips); auth faces on settle.
  const paintD1 = rolling ? null : authD1;
  const paintD2 = rolling ? null : authD2;

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
            svgRef={svg0}
          />
          <PipDie
            face={paintD2}
            index={1}
            tumbling={rolling && !reducedMotion}
            scrambling={rolling}
            settled={!rolling && paintD2 != null}
            settlePunch={punch && revealed}
            svgRef={svg1}
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
