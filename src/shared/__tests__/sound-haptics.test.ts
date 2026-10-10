import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
const listeners = new Map<string, Set<EventListener>>();
const docListeners = new Map<string, Set<EventListener>>();

function dispatch(type: string, detail?: unknown) {
  const set = listeners.get(type);
  if (!set) return;
  const ev = { type, detail } as unknown as Event;
  for (const fn of set) fn(ev);
}

vi.stubGlobal("window", {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  },
  addEventListener: (
    type: string,
    fn: EventListener,
    _opts?: unknown,
  ) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(fn);
  },
  removeEventListener: (type: string, fn: EventListener) => {
    listeners.get(type)?.delete(fn);
  },
  dispatchEvent: (ev: Event) => {
    dispatch(ev.type, (ev as CustomEvent).detail);
    return true;
  },
  AudioContext: undefined as unknown,
  webkitAudioContext: undefined as unknown,
});

let visibility: DocumentVisibilityState = "visible";
const docRoot = {
  appendChild: vi.fn(),
  removeChild: vi.fn(),
};
vi.stubGlobal("document", {
  get visibilityState() {
    return visibility;
  },
  documentElement: docRoot,
  createElement: (tag: string) => {
    if (tag === "audio") {
      return {
        setAttribute: vi.fn(),
        play: vi.fn(() => Promise.resolve()),
        style: {},
        src: "",
        volume: 1,
        currentTime: 0,
        parentNode: docRoot,
      };
    }
    return {};
  },
  addEventListener: (type: string, fn: EventListener) => {
    if (!docListeners.has(type)) docListeners.set(type, new Set());
    docListeners.get(type)!.add(fn);
  },
  removeEventListener: (type: string, fn: EventListener) => {
    docListeners.get(type)?.delete(fn);
  },
});

vi.stubGlobal(
  "CustomEvent",
  class CustomEvent<T = unknown> {
    type: string;
    detail: T;
    constructor(type: string, init?: { detail?: T }) {
      this.type = type;
      this.detail = init?.detail as T;
    }
  },
);

vi.stubGlobal("navigator", {
  audioSession: { type: "auto" },
});

import {
  isSoundEnabled,
  setSoundEnabled,
  SOUND_ENABLED_KEY,
  subscribeSoundEnabled,
} from "@/lib/sound-prefs";
import {
  playSfx,
  resetSfxState,
  sfxDebounceMs,
  primeAudioSync,
  enableSoundFromUserGesture,
  isAudioUnlocked,
  armGestureUnlock,
  type SfxKind,
} from "@/lib/sfx";
import { haptic, hapticPattern } from "@/lib/haptics";
import { feedback } from "@/lib/feedback";
import { cueYourTurn, resetYourTurnCue } from "@/lib/your-turn";

const settings = readFileSync(
  resolve(__dirname, "../../components/SettingsSheet.tsx"),
  "utf8",
);
const diceScene = readFileSync(
  resolve(__dirname, "../../components/dice/DiceScene.tsx"),
  "utf8",
);
const dicePanel = readFileSync(
  resolve(__dirname, "../../components/DicePanel.tsx"),
  "utf8",
);
const results = readFileSync(
  resolve(__dirname, "../../components/ResultsRevealList.tsx"),
  "utf8",
);
const sfxSrc = readFileSync(resolve(__dirname, "../../lib/sfx.ts"), "utf8");

class FakeOscillator {
  type = "sine";
  frequency = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}

class FakeGain {
  gain = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeBufferSource {
  buffer: unknown = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  onended: (() => void) | null = null;
}

class FakeAudioContext {
  state: AudioContextState = "suspended";
  currentTime = 0;
  sampleRate = 22050;
  destination = {};
  createOscillator = vi.fn(() => new FakeOscillator());
  createGain = vi.fn(() => new FakeGain());
  createBuffer = vi.fn(
    (_ch: number, _len: number, _rate: number) => ({}),
  );
  createBufferSource = vi.fn(() => new FakeBufferSource());
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  resume = vi.fn(async () => {
    this.state = "running";
  });
}

describe("sound prefs — off by default", () => {
  beforeEach(() => {
    store.clear();
    resetSfxState();
    visibility = "visible";
  });

  it("defaults to disabled", () => {
    expect(isSoundEnabled()).toBe(false);
  });

  it("persists enable/disable in localStorage", () => {
    setSoundEnabled(true);
    expect(store.get(SOUND_ENABLED_KEY)).toBe("1");
    expect(isSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(store.get(SOUND_ENABLED_KEY)).toBe("0");
    expect(isSoundEnabled()).toBe(false);
  });

  it("notifies subscribers", () => {
    const spy = vi.fn();
    const unsub = subscribeSoundEnabled(spy);
    setSoundEnabled(true);
    expect(spy).toHaveBeenCalledWith(true);
    unsub();
  });

  it("settings sheet has Sound toggle with clear off-by-default copy", () => {
    expect(settings).toMatch(/>Sound</);
    expect(settings).not.toMatch(/Sound FX/);
    expect(settings).toMatch(/isSoundEnabled/);
    expect(settings).toMatch(/enableSoundFromUserGesture/);
    expect(settings).toMatch(/aria-checked=\{soundOn\}/);
    expect(settings).toMatch(/Off by default|tap to enable/i);
  });
});

describe("iOS unlock + WebAudio sfx", () => {
  beforeEach(() => {
    store.clear();
    resetSfxState();
    visibility = "visible";
    listeners.clear();
    docListeners.clear();
    (navigator as unknown as { audioSession: { type: string } }).audioSession =
      { type: "auto" };
    (window as unknown as { AudioContext: unknown }).AudioContext =
      FakeAudioContext;
    vi.stubGlobal("AudioContext", FakeAudioContext);
  });

  afterEach(() => {
    resetSfxState();
    store.clear();
  });

  it("does not create AudioContext when sound is off", () => {
    let built = 0;
    class SpyAC extends FakeAudioContext {
      constructor() {
        super();
        built += 1;
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = SpyAC;
    playSfx("bank");
    expect(isSoundEnabled()).toBe(false);
    expect(built).toBe(0);
  });

  it("never plays when document is hidden", () => {
    setSoundEnabled(true);
    visibility = "hidden";
    let built = 0;
    class SpyAC extends FakeAudioContext {
      constructor() {
        super();
        built += 1;
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = SpyAC;
    playSfx("winner");
    expect(built).toBe(0);
  });

  it("primes sync inside a gesture: resume, silent buffer, silent html audio", () => {
    setSoundEnabled(true);
    const contexts: FakeAudioContext[] = [];
    class SpyAC extends FakeAudioContext {
      constructor() {
        super();
        contexts.push(this);
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = SpyAC;

    const audio = primeAudioSync();
    expect(audio).not.toBeNull();
    expect(contexts.length).toBe(1);
    expect(contexts[0]?.resume).toHaveBeenCalled();
    expect(contexts[0]?.createBufferSource).toHaveBeenCalled();
    expect(contexts[0]?.createBufferSource.mock.results[0]?.value.start).toHaveBeenCalled();
    expect(isAudioUnlocked()).toBe(true);
    expect(
      (navigator as unknown as { audioSession: { type: string } }).audioSession
        .type,
    ).toBe("playback");
  });

  it("enableSoundFromUserGesture plays an immediate confirm chime", () => {
    setSoundEnabled(true);
    const contexts: FakeAudioContext[] = [];
    class SpyAC extends FakeAudioContext {
      constructor() {
        super();
        this.state = "running";
        contexts.push(this);
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = SpyAC;

    enableSoundFromUserGesture();
    expect(contexts.length).toBe(1);
    expect(isAudioUnlocked()).toBe(true);
    // confirm = 2 oscillators (sine + triangle)
    expect(contexts[0]!.createOscillator).toHaveBeenCalled();
    expect(contexts[0]!.createOscillator.mock.calls.length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("arms pointerup/touchend/click listeners for unlock", () => {
    armGestureUnlock();
    expect(listeners.has("pointerup")).toBe(true);
    expect(listeners.has("touchend")).toBe(true);
    expect(listeners.has("click")).toBe(true);
  });

  it("plays when unlocked, and debounces identical kinds", () => {
    setSoundEnabled(true);
    const contexts: FakeAudioContext[] = [];
    class SpyAC extends FakeAudioContext {
      constructor() {
        super();
        this.state = "running";
        contexts.push(this);
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = SpyAC;
    primeAudioSync();
    playSfx("dice_tick");
    playSfx("dice_tick");
    playSfx("dice_tick");
    expect(contexts.length).toBe(1);
    const oscCalls = contexts[0]?.createOscillator.mock.calls.length ?? 0;
    // prime may not osc; one tick = one oscillator
    expect(oscCalls).toBe(1);
  });

  it("keeps every cue under 250ms in the synthesizer source", () => {
    const durs = [...sfxSrc.matchAll(/dur:\s*(0\.\d+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(durs.length).toBeGreaterThan(5);
    for (const d of durs) {
      expect(d).toBeLessThanOrEqual(0.25);
    }
  });

  it("covers required cue kinds including confirm", () => {
    const kinds: SfxKind[] = [
      "your_turn",
      "dice_tick",
      "dice_settle",
      "beans_land",
      "bust",
      "bank",
      "winner",
      "confirm",
    ];
    for (const k of kinds) {
      expect(sfxDebounceMs(k)).toBeGreaterThan(0);
    }
  });

  it("uses silent html audio + playback session for iOS silent switch", () => {
    expect(sfxSrc).toMatch(/audioSession/);
    expect(sfxSrc).toMatch(/playback/);
    expect(sfxSrc).toMatch(/SILENT_WAV|data:audio\/wav/);
    expect(sfxSrc).toMatch(/createBufferSource/);
    expect(sfxSrc).toMatch(/pointerup|touchend/);
    expect(sfxSrc).toMatch(/visibilitychange/);
    expect(sfxSrc).toMatch(/interrupted/);
    expect(sfxSrc).toMatch(/enableSoundFromUserGesture/);
  });
});

describe("haptics — short pulses", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses 10–20ms patterns for all feedback kinds", () => {
    const kinds = [
      "your_turn",
      "dice_tick",
      "dice_settle",
      "beans_land",
      "bust",
      "bank",
      "winner",
    ] as const;
    for (const k of kinds) {
      const ms = hapticPattern(k);
      expect(ms).toBeGreaterThanOrEqual(10);
      expect(ms).toBeLessThanOrEqual(20);
    }
  });

  it("fails silently when vibrate is missing", () => {
    vi.stubGlobal("navigator", {});
    expect(() => haptic("bank")).not.toThrow();
  });

  it("calls vibrate when supported", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    haptic("bust");
    expect(vibrate).toHaveBeenCalledWith(20);
  });
});

describe("wiring", () => {
  afterEach(() => {
    resetYourTurnCue();
    resetSfxState();
    store.clear();
  });

  it("cueYourTurn fires feedback once per key", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    cueYourTurn("dice:AB:0:1");
    cueYourTurn("dice:AB:0:1");
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("feedback plays haptic even when sound is off", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    expect(isSoundEnabled()).toBe(false);
    feedback("bank");
    expect(vibrate).toHaveBeenCalled();
  });

  it("dice scene uses playSfx / feedback (lazy)", () => {
    expect(diceScene).toMatch(/playSfx/);
    expect(diceScene).toMatch(/ensureAudio|feedback/);
  });

  it("dice panel banks +beans via feedback", () => {
    expect(dicePanel).toMatch(/feedback\("bank"\)/);
    expect(dicePanel).toMatch(/feedback\("beans_land"\)/);
  });

  it("winner reveal fires feedback", () => {
    expect(results).toMatch(/feedback\("winner"\)/);
  });
});
