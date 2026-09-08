/**
 * Lightweight WebAudio dice SFX. Fail soft; never throw into gameplay.
 */

let sharedCtx: AudioContext | null = null;

export async function ensureDiceAudio(): Promise<AudioContext | null> {
  if (typeof window === "undefined") return null;
  try {
    sharedCtx ??= new AudioContext();
    if (sharedCtx.state === "suspended") await sharedCtx.resume();
    return sharedCtx;
  } catch {
    return null;
  }
}

function tone(
  ctx: AudioContext,
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
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
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
  g.connect(ctx.destination);
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

/** Soft rumble when a roll commits. */
export function playRollStart(ctx: AudioContext | null) {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime;
  tone(ctx, {
    type: "sawtooth",
    freq: 180,
    freqEnd: 70,
    start: t,
    dur: 0.18,
    gain: 0.035,
  });
  tone(ctx, {
    type: "square",
    freq: 420,
    freqEnd: 160,
    start: t + 0.04,
    dur: 0.12,
    gain: 0.018,
  });
}

/** Brief tick while tumbling (throttled by caller). */
export function playRollTick(ctx: AudioContext | null) {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime;
  tone(ctx, {
    type: "triangle",
    freq: 520 + Math.random() * 180,
    freqEnd: 200,
    start: t,
    dur: 0.045,
    gain: 0.012,
  });
}

/** Punchy settle / land. */
export function playSettle(
  ctx: AudioContext | null,
  opts?: { busted?: boolean },
) {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime;
  if (opts?.busted) {
    tone(ctx, {
      type: "sawtooth",
      freq: 140,
      freqEnd: 40,
      start: t,
      dur: 0.28,
      gain: 0.05,
    });
    tone(ctx, {
      type: "square",
      freq: 90,
      freqEnd: 45,
      start: t + 0.05,
      dur: 0.22,
      gain: 0.03,
    });
    return;
  }
  tone(ctx, {
    type: "triangle",
    freq: 260,
    freqEnd: 90,
    start: t,
    dur: 0.12,
    gain: 0.055,
  });
  tone(ctx, {
    type: "sine",
    freq: 660,
    freqEnd: 440,
    start: t + 0.04,
    dur: 0.16,
    gain: 0.028,
  });
}

export function playBankChime(ctx: AudioContext | null) {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime;
  tone(ctx, {
    type: "sine",
    freq: 520,
    start: t,
    dur: 0.1,
    gain: 0.03,
  });
  tone(ctx, {
    type: "sine",
    freq: 780,
    start: t + 0.08,
    dur: 0.14,
    gain: 0.025,
  });
}
