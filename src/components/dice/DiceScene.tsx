"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { PublicDiceBroadcast } from "@/shared/types";
import { animProgress, tumblePose } from "@/shared/engine/dice-sync";
import { DIE_PIPS, projectDie, type DieProjection } from "@/shared/engine/dice-geometry";

function Die({ elementRef, value, index }: {
  elementRef: RefObject<SVGSVGElement | null>; value: number; index: 0 | 1;
}) {
  const projection = projectDie({ face: value, index });
  return <svg ref={elementRef} className={`bean-die bean-die-${index}`} viewBox="-62 -82 124 150" aria-hidden="true" data-face={value} data-front-face={projection.front}>
    <ellipse cx="0" cy="46" rx="39" ry="8" fill="#102d25" opacity="0.25" />
    <polygon data-outline="true" points={projection.outline} className="bean-die-body" strokeLinejoin="round" strokeWidth="3" />
    {projection.faces.map((face) => <g key={face.value} data-face-value={face.value} className="bean-die-face" transform={face.transform} style={{ display: face.visible ? "" : "none" }}>
      <rect x="-32" y="-32" width="64" height="64" rx="5" className="bean-die-body" strokeWidth="0.7" />
      <rect data-shade="true" x="-32" y="-32" width="64" height="64" rx="5" fill="#23483e" opacity={face.shade} />
      {DIE_PIPS[face.value].map((pip) => <circle key={pip} className="bean-pip" cx={(pip % 3 - 1) * 17} cy={(Math.floor(pip / 3) - 1) * 17} r="5" fill="#23483e" />)}
    </g>)}
  </svg>;
}

function paint(element: SVGSVGElement | null, projection: DieProjection) {
  if (!element) return;
  element.dataset.frontFace = String(projection.front);
  element.querySelector("[data-outline]")?.setAttribute("points", projection.outline);
  for (const face of projection.faces) {
    const group = element.querySelector<SVGGElement>(`[data-face-value="${face.value}"]`);
    if (!group) continue;
    group.style.display = face.visible ? "" : "none";
    group.setAttribute("transform", face.transform);
    group.querySelector("[data-shade]")?.setAttribute("opacity", String(face.shade));
    // Painter's order: closest faces last. No CSS 3D compositing required.
    element.appendChild(group);
  }
}

/** Shared 3D geometry projected into SVG, including on Safari without GPU layers. */
export function DiceScene({ broadcast, reducedMotion, isHost }: {
  broadcast: PublicDiceBroadcast | null; reducedMotion: boolean; isHost: boolean;
}) {
  const dieA = useRef<SVGSVGElement>(null), dieB = useRef<SVGSVGElement>(null);
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const sounded = useRef<string | null>(null);
  const rolling = !!broadcast && !broadcast.revealed;
  const rollId = broadcast?.rollId;
  const seed = broadcast?.animSeed ?? 0;
  const started = broadcast?.animStartedAt ?? 0, settled = broadcast?.animSettleAt ?? 0;
  const d1 = broadcast?.revealed ? broadcast.d1 ?? 1 : 1;
  const d2 = broadcast?.revealed ? broadcast.d2 ?? 1 : 1;

  useEffect(() => {
    if (!rolling || reducedMotion) {
      paint(dieA.current, projectDie({ face: d1, index: 0 }));
      paint(dieB.current, projectDie({ face: d2, index: 1 }));
      return;
    }
    let frame = 0;
    const tick = () => {
      const progress = Math.min(0.97, animProgress(Date.now(), started, settled));
      for (const index of [0, 1] as const) paint(index ? dieB.current : dieA.current, projectDie({ face: 1, index, tumble: tumblePose(progress, seed, index) }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rolling, reducedMotion, rollId, seed, started, settled, d1, d2]);

  useEffect(() => {
    if (!broadcast?.revealed || !sound || !isHost || sounded.current === broadcast.rollId) return;
    sounded.current = broadcast.rollId;
    const ctx = audio.current;
    if (!ctx || ctx.state !== "running") return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
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
  return <div className="bean-dice-tray">
    <div className="bean-dice-pair" role="img" aria-label={rolling ? "Dice rolling; result pending" : broadcast ? `Dice show ${d1} and ${d2}, total ${d1 + d2}` : "Two dice ready to roll"}>
      <Die elementRef={dieA} value={d1} index={0} />
      <Die elementRef={dieB} value={d2} index={1} />
    </div>
    {rolling && <span className="absolute bottom-3 left-0 right-0 text-center text-xs font-bold text-white/85">Rolling…</span>}
    {isHost && <button type="button" className="absolute right-2 top-2 min-h-11 rounded-full px-3 text-xs font-bold text-white/85" aria-pressed={sound} onClick={() => void toggleSound()}>{sound ? "Sound on" : "Sound off"}</button>}
  </div>;
}
