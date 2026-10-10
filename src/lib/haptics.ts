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

const PATTERNS: Record<HapticKind, number> = {
  your_turn: 18,
  dice_tick: 10,
  dice_settle: 16,
  beans_land: 14,
  bust: 20,
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

export function hapticPattern(kind: HapticKind): number {
  return PATTERNS[kind];
}
