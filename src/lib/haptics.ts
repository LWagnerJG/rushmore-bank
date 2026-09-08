/**
 * Best-effort haptics. iOS Safari often no-ops vibrate — never block gameplay.
 */
export type HapticKind =
  | "your_turn"
  | "tap_roll"
  | "settle"
  | "bank"
  | "bust";

const PATTERNS: Record<HapticKind, number | number[]> = {
  your_turn: [12, 40, 18],
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
