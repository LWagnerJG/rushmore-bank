/**
 * Best-effort haptics. iOS Safari often no-ops vibrate — never block gameplay.
 * Never rely on vibrate for game logic (Android-only in practice).
 */
export type HapticKind =
  | "your_turn"
  | "tap_roll"
  | "settle"
  | "bank"
  | "bust";

const PATTERNS: Record<HapticKind, number | number[]> = {
  /** Single short buzz — ~20ms; iOS ignores navigator.vibrate. */
  your_turn: 20,
  tap_roll: 10,
  settle: [8, 30, 24],
  bank: [14, 28, 14],
  bust: [30, 40, 50],
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

export function hapticPattern(kind: HapticKind): number | number[] {
  return PATTERNS[kind];
}
