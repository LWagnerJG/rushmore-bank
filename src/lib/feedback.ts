/**
 * Combined sound + haptic cue for game moments.
 * Sound respects Settings toggle (off by default); haptics always attempt when supported.
 * Debounce lives in sfx; haptic uses the same kind keys so callers stay one-liners.
 */

import { haptic, type HapticKind } from "@/lib/haptics";
import { playSfx, type SfxKind, unlockAudioOnGesture } from "@/lib/sfx";

export type FeedbackKind =
  | "your_turn"
  | "dice_tick"
  | "dice_settle"
  | "beans_land"
  | "bust"
  | "bank"
  | "winner";

const HAPTIC_MAP: Record<FeedbackKind, HapticKind> = {
  your_turn: "your_turn",
  dice_tick: "dice_tick",
  dice_settle: "dice_settle",
  beans_land: "beans_land",
  bust: "bust",
  bank: "bank",
  winner: "winner",
};

/** Fire sound (if enabled) + short vibrate. Fail-soft. */
export function feedback(kind: FeedbackKind): void {
  unlockAudioOnGesture();
  playSfx(kind as SfxKind);
  haptic(HAPTIC_MAP[kind]);
}
