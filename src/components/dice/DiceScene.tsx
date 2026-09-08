"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { PublicDiceBroadcast } from "@/shared/types";
import { animProgress, tumblePose } from "@/shared/engine/dice-sync";
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

const SETTLE_MS = 520;
const SOUND_KEY = "beans:dice-sound";

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
  const [sound, setSound] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(SOUND_KEY) === "1";
    } catch {
      return false;
    }
  });
  const audio = useRef<AudioContext | null>(null);
  const sounded = useRef<string | null>(null);
  const rollStarted = useRef<string | null>(null);
  const lastTick = useRef(0);
  const lastTumble = useRef<
    [
      { rx: number; ry: number; rz: number; x: number; y: number },
      { rx: number; ry: number; rz: number; x: number; y: number },
    ]
  >([
    { rx: 0, ry: 0, rz: 0, x: -1.15, y: 0.55 },
    { rx: 0, ry: 0, rz: 0, x: 1.15, y: 0.55 },
  ]);
  const settleFrom = useRef(0);
  const settleRollId = useRef<string | null>(null);
  const [settleTick, setSettleTick] = useState(0);
  const [punch, setPunch] = useState(false);

  const rolling = !!broadcast && !broadcast.revealed;
  const revealed = !!broadcast?.revealed;
  const rollId = broadcast?.rollId;
  const seed = broadcast?.animSeed ?? 0;
  const started = broadcast?.animStartedAt ?? 0;
  const settled = broadcast?.animSettleAt ?? 0;
  const d1 = revealed ? (broadcast?.d1 ?? 1) : 1;
  const d2 = revealed ? (broadcast?.d2 ?? 1) : 1;
  const total = d1 + d2;

  useLayoutEffect(() => {
    if (!revealed || !rollId || reducedMotion) return;
    if (settleRollId.current === rollId) return;
    settleRollId.current = rollId;
    settleFrom.current = Date.now();
    const kick = window.setTimeout(() => {
      setSettleTick((n) => n + 1);
      setPunch(true);
      haptic(busted ? "bust" : "settle");
    }, 0);
    const clearPunch = window.setTimeout(() => setPunch(false), 700);
    for (const el of [dieA.current, dieB.current]) {
      el?.classList.remove("bean-die-settle");
      void el?.getBoundingClientRect();
      el?.classList.add("bean-die-settle");
    }
    return () => {
      window.clearTimeout(kick);
      window.clearTimeout(clearPunch);
    };
  }, [revealed, rollId, reducedMotion, busted]);

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
      if (sound && !audio.current) {
        void ensureDiceAudio().then((ctx) => {
          audio.current = ctx;
        });
      }
      if (rollStarted.current !== rollId) {
        rollStarted.current = rollId ?? null;
        if (sound) playRollStart(audio.current);
      }
      let frame = 0;
      const tick = () => {
        const raw = animProgress(Date.now(), started, settled);
        const progress = Math.min(0.9, raw);
        const now = Date.now();
        if (sound && now - lastTick.current > 160 && progress < 0.85) {
          lastTick.current = now;
          playRollTick(audio.current);
        }
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
    sound,
  ]);

  useEffect(() => {
    if (!broadcast?.revealed || !sound || sounded.current === broadcast.rollId)
      return;
    sounded.current = broadcast.rollId;
    playSettle(audio.current, { busted: !!busted });
  }, [broadcast, sound, busted]);

  useEffect(
    () => () => {
      // Keep shared AudioContext for the session; no forced close.
    },
    [],
  );

  async function toggleSound() {
    if (!sound) {
      const ctx = await ensureDiceAudio();
      if (!ctx) return;
      audio.current = ctx;
      try {
        window.sessionStorage.setItem(SOUND_KEY, "1");
      } catch {
        /* ignore */
      }
      setSound(true);
      return;
    }
    try {
      window.sessionStorage.setItem(SOUND_KEY, "0");
    } catch {
      /* ignore */
    }
    setSound(false);
  }

  async function handleRoll() {
    if (!canRoll) return;
    haptic("tap_roll");
    if (sound) {
      const ctx = await ensureDiceAudio();
      audio.current = ctx;
      playRollStart(ctx);
    }
    onRoll();
  }

  const label = rolling
    ? "Dice rolling; result pending"
    : canRoll
      ? "Tap dice to roll"
      : revealed
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
    .join(" ");

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
      <button
        type="button"
        className="absolute right-2 top-2 z-10 min-h-11 rounded-full bg-black/25 px-3 text-xs font-bold text-white/90"
        aria-pressed={sound}
        onClick={() => void toggleSound()}
      >
        {sound ? "Sound on" : "Sound off"}
      </button>
    </div>
  );
}
