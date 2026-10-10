/**
 * Tiny warm WebAudio SFX — lazy-init only when Sound is enabled.
 * Unlocks AudioContext on first user gesture (iOS). Never plays when hidden.
 * Ambient session by default (respects iOS silent switch; no HTML audio hacks).
 */

import { isSoundEnabled } from "@/lib/sound-prefs";

export type SfxKind =
  | "your_turn"
  | "dice_tick"
  | "dice_settle"
  | "beans_land"
  | "bust"
  | "bank"
  | "winner";

/** Per-kind debounce so identical events never stack (ticks/settles/etc.). */
const KIND_DEBOUNCE_MS: Record<SfxKind, number> = {
  your_turn: 400,
  dice_tick: 120,
  dice_settle: 200,
  beans_land: 200,
  bust: 250,
  bank: 300,
  winner: 800,
};

let ctx: AudioContext | null = null;
let gestureBound = false;
const lastKindAt: Partial<Record<SfxKind, number>> = {};

function hidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function canPlay(kind: SfxKind): boolean {
  if (!isSoundEnabled()) return false;
  if (hidden()) return false;
  const t = nowMs();
  const prev = lastKindAt[kind] ?? 0;
  if (t - prev < KIND_DEBOUNCE_MS[kind]) return false;
  lastKindAt[kind] = t;
  return true;
}

/** Attach one-shot gesture listeners to resume AudioContext (iOS). */
export function unlockAudioOnGesture(): void {
  if (typeof window === "undefined" || gestureBound) return;
  gestureBound = true;
  const unlock = () => {
    if (!isSoundEnabled()) return;
    void ensureAudio();
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
}

/**
 * Lazy AudioContext — created only after Sound is enabled + first need/gesture.
 * Keeps the default ambient routing so the hardware silent switch is honored.
 */
export async function ensureAudio(): Promise<AudioContext | null> {
  if (typeof window === "undefined") return null;
  if (!isSoundEnabled()) return null;
  unlockAudioOnGesture();
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  audio: AudioContext,
  opts: {
    type?: OscillatorType;
    freq: number;
    freqEnd?: number;
    start: number;
    dur: number;
    gain: number;
    gainEnd?: number;
  },
) {
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = opts.type ?? "triangle";
  osc.frequency.setValueAtTime(opts.freq, opts.start);
  if (opts.freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, opts.freqEnd),
      opts.start + opts.dur,
    );
  }
  g.gain.setValueAtTime(opts.gain, opts.start);
  g.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, opts.gainEnd ?? 0.0001),
    opts.start + opts.dur,
  );
  osc.connect(g);
  g.connect(audio.destination);
  osc.start(opts.start);
  osc.stop(opts.start + opts.dur + 0.02);
  osc.onended = () => {
    try {
      osc.disconnect();
      g.disconnect();
    } catch {
      /* ignore */
    }
  };
}

/** All durations under 250ms. Warm / soft / short. */
function synthesize(audio: AudioContext, kind: SfxKind): void {
  const t = audio.currentTime;
  switch (kind) {
    case "your_turn":
      tone(audio, {
        type: "sine",
        freq: 440,
        freqEnd: 660,
        start: t,
        dur: 0.12,
        gain: 0.028,
      });
      tone(audio, {
        type: "triangle",
        freq: 660,
        start: t + 0.06,
        dur: 0.1,
        gain: 0.018,
      });
      break;
    case "dice_tick":
      tone(audio, {
        type: "triangle",
        freq: 500 + Math.random() * 160,
        freqEnd: 220,
        start: t,
        dur: 0.04,
        gain: 0.011,
      });
      break;
    case "dice_settle":
      tone(audio, {
        type: "triangle",
        freq: 280,
        freqEnd: 110,
        start: t,
        dur: 0.11,
        gain: 0.045,
      });
      tone(audio, {
        type: "sine",
        freq: 620,
        freqEnd: 400,
        start: t + 0.035,
        dur: 0.12,
        gain: 0.022,
      });
      break;
    case "beans_land":
      tone(audio, {
        type: "sine",
        freq: 520,
        start: t,
        dur: 0.08,
        gain: 0.03,
      });
      tone(audio, {
        type: "triangle",
        freq: 780,
        freqEnd: 640,
        start: t + 0.05,
        dur: 0.12,
        gain: 0.022,
      });
      break;
    case "bust":
      // Soft low thud
      tone(audio, {
        type: "sine",
        freq: 95,
        freqEnd: 48,
        start: t,
        dur: 0.18,
        gain: 0.055,
      });
      tone(audio, {
        type: "triangle",
        freq: 70,
        freqEnd: 40,
        start: t + 0.02,
        dur: 0.16,
        gain: 0.03,
      });
      break;
    case "bank":
      tone(audio, {
        type: "sine",
        freq: 500,
        start: t,
        dur: 0.09,
        gain: 0.028,
      });
      tone(audio, {
        type: "sine",
        freq: 750,
        start: t + 0.07,
        dur: 0.12,
        gain: 0.024,
      });
      break;
    case "winner":
      tone(audio, {
        type: "sine",
        freq: 523,
        start: t,
        dur: 0.1,
        gain: 0.03,
      });
      tone(audio, {
        type: "sine",
        freq: 659,
        start: t + 0.08,
        dur: 0.1,
        gain: 0.028,
      });
      tone(audio, {
        type: "triangle",
        freq: 784,
        start: t + 0.15,
        dur: 0.12,
        gain: 0.022,
      });
      break;
  }
}

/**
 * Play a short SFX when Sound is on, document visible, and debounce allows.
 * Fail-soft — never throws into gameplay.
 */
export function playSfx(kind: SfxKind): void {
  if (!canPlay(kind)) return;
  void ensureAudio().then((audio) => {
    if (!audio || audio.state !== "running") return;
    if (hidden() || !isSoundEnabled()) return;
    try {
      synthesize(audio, kind);
    } catch {
      /* ignore */
    }
  });
}

/** Test helpers */
export function resetSfxState(): void {
  for (const k of Object.keys(lastKindAt) as SfxKind[]) {
    delete lastKindAt[k];
  }
  ctx = null;
  gestureBound = false;
}

export function sfxDebounceMs(kind: SfxKind): number {
  return KIND_DEBOUNCE_MS[kind];
}
