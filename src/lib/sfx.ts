/**
 * Tiny warm WebAudio SFX — lazy-init only when Sound is enabled.
 *
 * iOS Safari / installed PWA requirements:
 * - Create + resume AudioContext inside a user gesture (sync path).
 * - Play a silent buffer + silent <audio> in that same gesture so the
 *   media session opens (works with the hardware silent switch).
 * - Prefer navigator.audioSession.type = "playback" when available (iOS 17+).
 * - Resume again on visibilitychange / pageshow and after "interrupted".
 * Never plays when the document is hidden.
 */

import { isSoundEnabled } from "@/lib/sound-prefs";

export type SfxKind =
  | "your_turn"
  | "dice_tick"
  | "dice_settle"
  | "beans_land"
  | "bust"
  | "bank"
  | "winner"
  | "confirm";

/** Per-kind debounce so identical events never stack (ticks/settles/etc.). */
const KIND_DEBOUNCE_MS: Record<SfxKind, number> = {
  your_turn: 400,
  dice_tick: 120,
  dice_settle: 200,
  beans_land: 200,
  bust: 250,
  bank: 300,
  winner: 800,
  confirm: 200,
};

/** Minimal silent WAV — opens the iOS media channel from a gesture. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

let ctx: AudioContext | null = null;
let gestureBound = false;
let lifecycleBound = false;
/** True after a successful in-gesture prime (required on iOS). */
let unlocked = false;
let silentEl: HTMLAudioElement | null = null;
const lastKindAt: Partial<Record<SfxKind, number>> = {};

type AudioSessionNavigator = Navigator & {
  audioSession?: { type: string };
};

function hidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function debounceOk(kind: SfxKind): boolean {
  const prev = lastKindAt[kind];
  // Important: unset must not fall back to 0 — performance.now() is often
  // < debounce window right after load, which would block the first cue.
  if (prev == null) return true;
  return nowMs() - prev >= KIND_DEBOUNCE_MS[kind];
}

function markDebounce(kind: SfxKind): void {
  lastKindAt[kind] = nowMs();
}

function audioCtor(): (typeof AudioContext) | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ||
    null
  );
}

/** Prefer playback session so cues aren't killed by the iOS silent switch. */
function preferPlaybackSession(): void {
  if (typeof navigator === "undefined") return;
  try {
    const session = (navigator as AudioSessionNavigator).audioSession;
    if (session && typeof session === "object") {
      session.type = "playback";
    }
  } catch {
    /* unsupported */
  }
}

function ensureSilentElement(): HTMLAudioElement | null {
  if (typeof document === "undefined") return null;
  if (silentEl) return silentEl;
  try {
    const el = document.createElement("audio");
    el.setAttribute("playsinline", "true");
    el.setAttribute("preload", "auto");
    el.src = SILENT_WAV;
    el.volume = 0.01;
    el.style.display = "none";
    document.documentElement.appendChild(el);
    silentEl = el;
    return el;
  } catch {
    return null;
  }
}

/** Play near-silent HTML audio — must run inside a user gesture on iOS. */
function playSilentHtmlAudio(): void {
  const el = ensureSilentElement();
  if (!el) return;
  try {
    el.currentTime = 0;
    const p = el.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        /* autoplay blocked — ignore */
      });
    }
  } catch {
    /* ignore */
  }
}

/** One-sample silent buffer — sync WebAudio unlock inside the gesture. */
function playSilentBuffer(audio: AudioContext): void {
  try {
    const buffer = audio.createBuffer(1, 1, audio.sampleRate || 22050);
    const src = audio.createBufferSource();
    src.buffer = buffer;
    src.connect(audio.destination);
    src.start(0);
    src.onended = () => {
      try {
        src.disconnect();
      } catch {
        /* ignore */
      }
    };
  } catch {
    /* ignore */
  }
}

function bindLifecycle(): void {
  if (lifecycleBound || typeof document === "undefined") return;
  lifecycleBound = true;
  const resume = () => {
    if (!isSoundEnabled() || hidden()) return;
    resumeAudioSync();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resume();
  });
  window.addEventListener("pageshow", resume);
}

function ctxState(): string {
  return ctx?.state ?? "";
}

function onContextStateChange(): void {
  if (!ctx) return;
  // iOS uses "interrupted" when backgrounded / call / Siri.
  const state = ctxState();
  if (state === "interrupted" || state === "suspended") {
    unlocked = false;
  }
  if (state === "running") {
    unlocked = true;
  }
}

/**
 * Synchronous prime — MUST be called from a user gesture on iOS.
 * Creates context, opens media channel, resumes, marks unlocked.
 */
export function primeAudioSync(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!isSoundEnabled()) return null;
  preferPlaybackSession();
  bindLifecycle();
  armGestureUnlock();
  try {
    const AC = audioCtor();
    if (!AC) return null;
    ctx ??= new AC();
    try {
      ctx.removeEventListener("statechange", onContextStateChange);
    } catch {
      /* ignore */
    }
    ctx.addEventListener("statechange", onContextStateChange);

    // Kick resume without awaiting — awaiting would leave the gesture stack.
    const state = ctxState();
    if (state === "suspended" || state === "interrupted") {
      void ctx.resume().then(() => {
        if (ctx?.state === "running") unlocked = true;
      });
    }

    playSilentHtmlAudio();
    playSilentBuffer(ctx);

    // Silent buffer + html audio ran in-gesture even if resume is still settling.
    unlocked = true;
    return ctx;
  } catch {
    return null;
  }
}

/** Best-effort resume after backgrounding (may no-op outside a gesture). */
export function resumeAudioSync(): AudioContext | null {
  if (!isSoundEnabled() || hidden()) return ctx;
  if (!ctx) return null;
  preferPlaybackSession();
  try {
    const state = ctxState();
    if (state === "suspended" || state === "interrupted") {
      void ctx.resume().then(() => {
        if (ctx?.state === "running") unlocked = true;
      });
    }
    if (ctxState() === "running") unlocked = true;
  } catch {
    /* ignore */
  }
  return ctx;
}

/**
 * Attach capture-phase gesture listeners so the next tap unlocks audio
 * (needed when Sound was already on from a prior visit).
 */
export function armGestureUnlock(): void {
  if (typeof window === "undefined" || gestureBound) return;
  gestureBound = true;
  const unlock = () => {
    if (!isSoundEnabled()) return;
    primeAudioSync();
  };
  // touchend/pointerup/click — iOS is picky about which event carries the gesture.
  for (const type of ["pointerup", "touchend", "click"] as const) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }
}

/** @deprecated alias — prefer armGestureUnlock / primeAudioSync */
export function unlockAudioOnGesture(): void {
  armGestureUnlock();
}

/**
 * Lazy AudioContext. Prefer primeAudioSync() from a user gesture on iOS.
 * Safe to call later for resume attempts.
 */
export async function ensureAudio(): Promise<AudioContext | null> {
  if (typeof window === "undefined") return null;
  if (!isSoundEnabled()) return null;
  armGestureUnlock();
  bindLifecycle();
  if (!ctx) {
    // Creating outside a gesture often stays suspended on iOS — still try.
    try {
      const AC = audioCtor();
      if (!AC) return null;
      preferPlaybackSession();
      ctx = new AC();
      ctx.addEventListener("statechange", onContextStateChange);
    } catch {
      return null;
    }
  }
  try {
    const state = ctxState();
    if (state === "suspended" || state === "interrupted") {
      await ctx.resume();
    }
    if (ctxState() === "running") unlocked = true;
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
    case "confirm":
      tone(audio, {
        type: "sine",
        freq: 660,
        start: t,
        dur: 0.08,
        gain: 0.035,
      });
      tone(audio, {
        type: "triangle",
        freq: 880,
        start: t + 0.06,
        dur: 0.1,
        gain: 0.025,
      });
      break;
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

function playOnContext(audio: AudioContext, kind: SfxKind): void {
  try {
    synthesize(audio, kind);
  } catch {
    /* ignore */
  }
}

/**
 * Play a short SFX when Sound is on, document visible, and debounce allows.
 * Fail-soft — never throws into gameplay.
 */
export function playSfx(kind: SfxKind): void {
  if (!isSoundEnabled() || hidden()) return;
  if (!debounceOk(kind)) return;

  // Fast path: already unlocked + running.
  if (ctx && unlocked && ctx.state === "running") {
    markDebounce(kind);
    playOnContext(ctx, kind);
    return;
  }

  // Try sync resume / prime leftovers, then play if running.
  resumeAudioSync();
  if (ctx && ctx.state === "running") {
    unlocked = true;
    markDebounce(kind);
    playOnContext(ctx, kind);
    return;
  }

  // Last resort async resume (works on desktop; iOS needs a later gesture).
  markDebounce(kind);
  void ensureAudio().then((audio) => {
    if (!audio || hidden() || !isSoundEnabled()) return;
    if (audio.state !== "running") return;
    unlocked = true;
    try {
      synthesize(audio, kind);
    } catch {
      /* ignore */
    }
  });
}

/**
 * Call from the Sound toggle click — persists on, primes iOS audio sync,
 * and plays an immediate confirmation chime in the same gesture.
 */
export function enableSoundFromUserGesture(): void {
  // Caller should persist prefs; this primes + confirms.
  preferPlaybackSession();
  const audio = primeAudioSync();
  if (!audio) return;
  // Prefer confirm even if a prior cue just fired — this is an explicit tap.
  lastKindAt.confirm = undefined;
  if (debounceOk("confirm")) markDebounce("confirm");
  playOnContext(audio, "confirm");
  void audio.resume().then(() => {
    unlocked = true;
  });
}

/** Test / diagnostics */
export function isAudioUnlocked(): boolean {
  return unlocked;
}

export function resetSfxState(): void {
  for (const k of Object.keys(lastKindAt) as SfxKind[]) {
    delete lastKindAt[k];
  }
  if (ctx) {
    try {
      ctx.removeEventListener("statechange", onContextStateChange);
    } catch {
      /* ignore */
    }
  }
  ctx = null;
  gestureBound = false;
  lifecycleBound = false;
  unlocked = false;
  if (silentEl?.parentNode) {
    try {
      silentEl.parentNode.removeChild(silentEl);
    } catch {
      /* ignore */
    }
  }
  silentEl = null;
}

export function sfxDebounceMs(kind: SfxKind): number {
  return KIND_DEBOUNCE_MS[kind];
}
