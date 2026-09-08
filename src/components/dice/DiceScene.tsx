"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { PublicDiceBroadcast } from "@/shared/types";
import { animProgress, tumblePose } from "@/shared/engine/dice-sync";
import { DIE_PIPS, projectDie, type DieProjection } from "@/shared/engine/dice-geometry";

const SETTLE_MS = 300;

function DieShell({
  elementRef,
  index,
}: {
  elementRef: RefObject<SVGSVGElement | null>;
  index: 0 | 1;
}) {
  // Static shell — faces painted imperatively to avoid React/RAF flicker.
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

/** Shared 3D geometry projected into SVG, including on Safari without GPU layers. */
export function DiceScene({
  broadcast,
  reducedMotion,
  isHost,
}: {
  broadcast: PublicDiceBroadcast | null;
  reducedMotion: boolean;
  isHost: boolean;
}) {
  const dieA = useRef<SVGSVGElement>(null);
  const dieB = useRef<SVGSVGElement>(null);
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const sounded = useRef<string | null>(null);
  const lastTumble = useRef<
    [{ rx: number; ry: number; rz: number; x: number; y: number }, { rx: number; ry: number; rz: number; x: number; y: number }]
  >([
    { rx: 0, ry: 0, rz: 0, x: -1.15, y: 0.55 },
    { rx: 0, ry: 0, rz: 0, x: 1.15, y: 0.55 },
  ]);
  const settleFrom = useRef(0);
  const settleRollId = useRef<string | null>(null);
  const [settleTick, setSettleTick] = useState(0);

  const rolling = !!broadcast && !broadcast.revealed;
  const revealed = !!broadcast?.revealed;
  const rollId = broadcast?.rollId;
  const seed = broadcast?.animSeed ?? 0;
  const started = broadcast?.animStartedAt ?? 0;
  const settled = broadcast?.animSettleAt ?? 0;
  const d1 = revealed ? (broadcast?.d1 ?? 1) : 1;
  const d2 = revealed ? (broadcast?.d2 ?? 1) : 1;

  // Kick soft settle animation when faces arrive (avoids abrupt snap).
  useLayoutEffect(() => {
    if (!revealed || !rollId || reducedMotion) return;
    if (settleRollId.current === rollId) return;
    settleRollId.current = rollId;
    settleFrom.current = Date.now();
    setSettleTick((n) => n + 1);
    for (const el of [dieA.current, dieB.current]) {
      el?.classList.remove("bean-die-settle");
      // force reflow for restart
      void el?.getBoundingClientRect();
      el?.classList.add("bean-die-settle");
    }
  }, [revealed, rollId, reducedMotion]);

  useLayoutEffect(() => {
    if (!dieA.current || !dieB.current) return;

    if (!broadcast) {
      paint(dieA.current, projectDie({ face: 1, index: 0 }));
      paint(dieB.current, projectDie({ face: 1, index: 1 }));
      return;
    }

    if (reducedMotion) {
      paint(dieA.current, projectDie({ face: d1, index: 0 }));
      paint(dieB.current, projectDie({ face: d2, index: 1 }));
      return;
    }

    if (rolling) {
      let frame = 0;
      const tick = () => {
        // Hold near the end with a soft wobble until authoritative reveal.
        const raw = animProgress(Date.now(), started, settled);
        const progress = Math.min(0.92, raw);
        for (const index of [0, 1] as const) {
          const pose = tumblePose(progress, seed, index);
          lastTumble.current[index] = pose;
          paint(
            index ? dieB.current : dieA.current,
            projectDie({ face: 1, index, tumble: pose }),
          );
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }

    // Revealed: blend last tumble → rest over SETTLE_MS, then hold rest.
    let frame = 0;
    const from = settleFrom.current || Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - from) / SETTLE_MS);
      const ease = 1 - Math.pow(1 - t, 3);
      for (const index of [0, 1] as const) {
        const face = index ? d2 : d1;
        const tumble = lastTumble.current[index];
        paint(
          index ? dieB.current : dieA.current,
          projectDie({
            face,
            index,
            tumble: t < 1 ? tumble : undefined,
            settle: ease,
          }),
        );
      }
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    broadcast,
    rolling,
    revealed,
    reducedMotion,
    rollId,
    seed,
    started,
    settled,
    d1,
    d2,
    settleTick,
  ]);

  useEffect(() => {
    if (!broadcast?.revealed || !sound || !isHost || sounded.current === broadcast.rollId)
      return;
    sounded.current = broadcast.rollId;
    const ctx = audio.current;
    if (!ctx || ctx.state !== "running") return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(230, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.11);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }, [broadcast, sound, isHost]);

  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );

  async function toggleSound() {
    if (!sound) {
      try {
        audio.current ??= new AudioContext();
        await audio.current.resume();
      } catch {
        return;
      }
    }
    setSound(!sound);
  }

  const label = rolling
    ? "Dice rolling; result pending"
    : broadcast?.revealed
      ? `Dice show ${d1} and ${d2}, total ${d1 + d2}`
      : "Two dice ready to roll";

  return (
    <div className="bean-dice-tray">
      <div className="bean-dice-pair" role="img" aria-label={label}>
        <DieShell elementRef={dieA} index={0} />
        <DieShell elementRef={dieB} index={1} />
      </div>
      {rolling && (
        <span className="absolute bottom-3 left-0 right-0 text-center text-xs font-bold text-white/85">
          Rolling…
        </span>
      )}
      {isHost && (
        <button
          type="button"
          className="absolute right-2 top-2 min-h-11 rounded-full px-3 text-xs font-bold text-white/85"
          aria-pressed={sound}
          onClick={() => void toggleSound()}
        >
          {sound ? "Sound on" : "Sound off"}
        </button>
      )}
    </div>
  );
}
