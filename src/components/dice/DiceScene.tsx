"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { PublicDiceBroadcast } from "@/shared/types";
import { tumblePose } from "@/shared/engine/dice-sync";
import {
  resolveDicePresentPhase,
  tumbleDisplayProgress,
} from "@/shared/engine/dice-present";
import {
  DIE_PIPS,
  projectDie,
  type DieProjection,
} from "@/shared/engine/dice-geometry";
import {
  ensureDiceAudio,
  playRollStart,
  playRollTick,
  playSettle,
} from "@/lib/dice-sfx";
import { haptic } from "@/lib/haptics";

function DieShell({
  elementRef,
  index,
}: {
  elementRef: RefObject<SVGSVGElement | null>;
  index: 0 | 1;
}) {
  return (
    <svg
      ref={elementRef}
      className={`bean-die bean-die-${index}`}
      viewBox="-62 -82 124 150"
      aria-hidden="true"
    >
      <ellipse cx="0" cy="46" rx="39" ry="8" fill="#102d25" opacity="0.25" />
      <polygon
        data-outline="true"
        points=""
        className="bean-die-body"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      {[1, 2, 3, 4, 5, 6].map((value) => (
        <g
          key={value}
          data-face-value={value}
          className="bean-die-face"
          style={{ display: "none" }}
        >
          <rect
            x="-32"
            y="-32"
            width="64"
            height="64"
            rx="5"
            className="bean-die-body"
            strokeWidth="0.7"
          />
          <rect
            data-shade="true"
            x="-32"
            y="-32"
            width="64"
            height="64"
            rx="5"
            fill="#23483e"
            opacity="0"
          />
          {DIE_PIPS[value].map((pip) => (
            <circle
              key={pip}
              className="bean-pip"
              cx={(pip % 3 - 1) * 17}
              cy={(Math.floor(pip / 3) - 1) * 17}
              r="5"
              fill="#23483e"
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

function paint(element: SVGSVGElement | null, projection: DieProjection) {
  if (!element) return;
  element.dataset.frontFace = String(projection.front);
  element
    .querySelector("[data-outline]")
    ?.setAttribute("points", projection.outline);
  for (const face of projection.faces) {
    const group = element.querySelector<SVGGElement>(
      `[data-face-value="${face.value}"]`,
    );
    if (!group) continue;
    group.style.display = face.visible ? "" : "none";
    group.setAttribute("transform", face.transform);
    group
      .querySelector("[data-shade]")
      ?.setAttribute("opacity", String(face.shade));
    if (face.visible) element.appendChild(group);
  }
}

function paintRest(
  dieA: SVGSVGElement | null,
  dieB: SVGSVGElement | null,
  d1: number,
  d2: number,
) {
  paint(dieA, projectDie({ face: d1, index: 0 }));
  paint(dieB, projectDie({ face: d2, index: 1 }));
}

/**
 * Dice tray — cosmetic tumble until reveal, then ONE authoritative settle.
 * Never paints a rest face from local/seed guesses (that caused the jump).
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
  const dieA = useRef<SVGSVGElement>(null);
  const dieB = useRef<SVGSVGElement>(null);
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
  const seed = phase.kind === "tumbling" ? phase.seed : 0;
  const started = phase.kind === "tumbling" ? phase.startedAt : 0;
  const settledAt = phase.kind === "tumbling" ? phase.settleAt : 0;
  const d1 =
    phase.kind === "settled" || phase.kind === "idle" ? phase.d1 : undefined;
  const d2 =
    phase.kind === "settled" || phase.kind === "idle" ? phase.d2 : undefined;
  const total = revealed && d1 != null && d2 != null ? d1 + d2 : null;

  // Authoritative settle only — snap once per rollId, no morph from tumble.
  useLayoutEffect(() => {
    if (!revealed || !rollId || d1 == null || d2 == null) return;
    if (settleRollId.current === rollId) {
      paintRest(dieA.current, dieB.current, d1, d2);
      return;
    }
    settleRollId.current = rollId;
    paintRest(dieA.current, dieB.current, d1, d2);

    if (reducedMotion) return;

    const kick = window.setTimeout(() => {
      setPunch(true);
      haptic(busted ? "bust" : "settle");
      for (const el of [dieA.current, dieB.current]) {
        el?.classList.remove("bean-die-settle");
        void el?.getBoundingClientRect();
        el?.classList.add("bean-die-settle");
      }
    }, 0);
    const clearPunch = window.setTimeout(() => setPunch(false), 780);
    return () => {
      window.clearTimeout(kick);
      window.clearTimeout(clearPunch);
    };
  }, [revealed, rollId, d1, d2, reducedMotion, busted]);
  // Idle / tumble paint. Settled paint owned by settle effect above.
  useLayoutEffect(() => {
    if (!dieA.current || !dieB.current) return;

    if (phase.kind === "idle") {
      paintRest(dieA.current, dieB.current, d1 ?? 1, d2 ?? 1);
      return;
    }

    if (phase.kind === "settled") {
      if (reducedMotion && d1 != null && d2 != null) {
        paintRest(dieA.current, dieB.current, d1, d2);
      }
      return;
    }

    if (reducedMotion) {
      // No fake rest faces while waiting — keep neutral until auth settle.
      paintRest(dieA.current, dieB.current, 1, 1);
      return;
    }

    let frame = 0;
    if (rollStarted.current !== rollId) {
      rollStarted.current = rollId;
      void ensureDiceAudio().then((ctx) => {
        audio.current = ctx;
        playRollStart(ctx);
      });
    }
    const tick = () => {
      const progress = tumbleDisplayProgress(Date.now(), started, settledAt);
      const now = Date.now();
      if (now - lastTick.current > 160 && progress < TUMBLE_TICK_STOP) {
        lastTick.current = now;
        playRollTick(audio.current);
      }
      for (const index of [0, 1] as const) {
        const pose = tumblePose(progress, seed, index);
        paint(
          index ? dieB.current : dieA.current,
          projectDie({ face: 1, index, tumble: pose, settle: 0 }),
        );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase.kind, rollId, seed, started, settledAt, reducedMotion, d1, d2]);

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
      >
        <div className="bean-dice-pair" role="img" aria-hidden="true">
          <DieShell elementRef={dieA} index={0} />
          <DieShell elementRef={dieB} index={1} />
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

/** Stop tick SFX before display-cap coast; keep motion until reveal. */
const TUMBLE_TICK_STOP = 0.55;
