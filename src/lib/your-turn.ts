import { haptic } from "@/lib/haptics";

/** Deduped your-turn cue: one ~20ms vibrate per logical turn key. */
let lastKey = "";

export function cueYourTurn(key: string): void {
  if (!key || lastKey === key) return;
  lastKey = key;
  haptic("your_turn");
}

/** Test helper — reset dedupe between cases. */
export function resetYourTurnCue(): void {
  lastKey = "";
}
