"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { PublicDiceBroadcast } from "@/shared/types";
import { animProgress, tumblePose } from "@/shared/engine/dice-sync";

const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
// CSS cube faces: front, top, right, left, bottom, back. Opposites sum to seven.
const FACE_ROTATIONS = ["", "rotateX(90deg)", "rotateY(90deg)", "rotateY(-90deg)", "rotateX(-90deg)", "rotateY(180deg)"];
const SETTLED_ROTATIONS = ["rotateX(0deg)", "rotateX(-90deg)", "rotateY(-90deg)", "rotateY(90deg)", "rotateX(90deg)", "rotateY(180deg)"];

function Die({ elementRef, value, index }: {
  elementRef: React.RefObject<HTMLDivElement | null>; value: number; index: number;
}) {
  return <div className={`bean-die-space bean-die-space-${index}`}>
    <div ref={elementRef} className="bean-die" data-face={value} style={{ transform: `rotateX(-12deg) rotateY(-14deg) rotateZ(${index ? 8 : -8}deg) ${SETTLED_ROTATIONS[value - 1]}` }} aria-hidden="true">
      {Array.from({ length: 6 }, (_, face) => <div key={face} className="bean-die-face" style={{ transform: `${FACE_ROTATIONS[face]} translateZ(var(--die-half))` }}>
        {Array.from({ length: 9 }, (_, position) => <span key={position} className={PIPS[face + 1].includes(position) ? "bean-pip" : ""} />)}
      </div>)}
    </div>
  </div>;
}

/** Real six-face CSS cubes; no WebGL dependency or renderer reset on room updates. */
export function DiceScene({ broadcast, reducedMotion, isHost }: {
  broadcast: PublicDiceBroadcast | null; reducedMotion: boolean; isHost: boolean;
}) {
  const dieA = useRef<HTMLDivElement>(null);
  const dieB = useRef<HTMLDivElement>(null);
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const sounded = useRef<string | null>(null);
  const rolling = !!broadcast && !broadcast.revealed;
  const rollId = broadcast?.rollId;
  const seed = broadcast?.animSeed ?? 0;
  const started = broadcast?.animStartedAt ?? 0;
  const settled = broadcast?.animSettleAt ?? 0;
  const d1 = broadcast?.revealed ? broadcast.d1 ?? 1 : 1;
  const d2 = broadcast?.revealed ? broadcast.d2 ?? 1 : 1;

  useEffect(() => {
    if (!rolling || reducedMotion) return;
    let frame = 0;
    const tick = () => {
      // The same seed and timestamps give every phone the same tumble.
      const progress = animProgress(Date.now(), started, settled);
      [dieA.current, dieB.current].forEach((element, index) => {
        if (!element) return;
        const pose = tumblePose(Math.min(progress, 0.97), seed, index);
        const baseline = index === 0 ? -1.1 : 1.1;
        const drift = Math.max(-18, Math.min(18, (pose.x - baseline) * 18));
        const lift = Math.max(-45, Math.min(8, -(pose.y - 0.55) * 20));
        element.style.transform = `translate(${drift}px, ${lift}px) rotateX(${pose.rx}rad) rotateY(${pose.ry}rad) rotateZ(${pose.rz}rad)`;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rolling, reducedMotion, rollId, seed, started, settled]);

  useEffect(() => {
    if (rolling) return;
    [dieA.current, dieB.current].forEach((element, index) => {
      if (element) element.style.transform = `rotateX(-12deg) rotateY(-14deg) rotateZ(${index ? 8 : -8}deg) ${SETTLED_ROTATIONS[(index ? d2 : d1) - 1]}`;
    });
  }, [rolling, d1, d2]);

  useEffect(() => {
    if (!broadcast?.revealed || !sound || !isHost || sounded.current === broadcast.rollId) return;
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
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.start(); oscillator.stop(ctx.currentTime + 0.11);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }, [broadcast, sound, isHost]);
  useEffect(() => () => { void audio.current?.close(); }, []);

  async function toggleSound() {
    if (!sound) {
      try { audio.current ??= new AudioContext(); await audio.current.resume(); }
      catch { return; }
    }
    setSound(!sound);
  }

  return <div className={`bean-dice-tray ${rolling && !reducedMotion ? "is-rolling" : ""} ${reducedMotion ? "is-reduced" : ""}`} style={{ "--die-size": "64px", "--die-half": "32px" } as CSSProperties}>
    <div className="bean-dice-pair" role="img" aria-label={rolling ? "Dice rolling; result pending" : broadcast ? `Dice show ${d1} and ${d2}, total ${d1 + d2}` : "Two dice ready to roll"}>
      <Die elementRef={dieA} value={d1} index={0} />
      <Die elementRef={dieB} value={d2} index={1} />
    </div>
    {rolling && <span className="absolute bottom-3 left-0 right-0 text-center text-xs font-bold text-white/85">Rolling…</span>}
    {isHost && <button type="button" className="absolute right-2 top-2 min-h-11 rounded-full px-3 text-xs font-bold text-white/85" aria-pressed={sound} onClick={() => void toggleSound()}>{sound ? "Sound on" : "Sound off"}</button>}
  </div>;
}
