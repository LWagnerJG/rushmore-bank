/**
 * Best-effort haptics via navigator.vibrate (10–20ms).
 * iOS Safari ignores vibrate — fail silently. Never block gameplay.
 */

export type HapticKind =
  | "your_turn"
  | "dice_tick"
  | "dice_settle"
  | "beans_land"
  | "bust"
  | "bank"
  | "winner"
  /** @deprecated use dice_tick */
  | "tap_roll"
  /** @deprecated use dice_settle */
  | "settle";

const PATTERNS: Record<HapticKind, number | number[]> = {
  your_turn: 18,
  dice_tick: 10,
  dice_settle: 16,
  beans_land: 14,
  // Double-hit stamp pulse (Android; iOS ignores vibrate).
  bust: [18, 40, 22],
  bank: 16,
  winner: 20,
  tap_roll: 10,
  settle: 16,
};

export function haptic(kind: HapticKind): void {
  if (typeof navigator === "undefined") return;
  const vibrate = navigator.vibrate?.bind(navigator);
  if (!vibrate) return;
  try {
    vibrate(PATTERNS[kind]);
  } catch {
    // Unsupported or blocked — ignore.
  }
}

/** First pulse duration (ms) — used by tests that assert 10–20ms cues. */
export function hapticPattern(kind: HapticKind): number {
  const p = PATTERNS[kind];
  return Array.isArray(p) ? p[0]! : p;
}
