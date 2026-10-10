import { feedback } from "@/lib/feedback";

/** Deduped your-turn cue: sound (if on) + ~18ms vibrate per logical turn key. */
let lastKey = "";

export function cueYourTurn(key: string): void {
  if (!key || lastKey === key) return;
  lastKey = key;
  feedback("your_turn");
}

/** Test helper — reset dedupe between cases. */
export function resetYourTurnCue(): void {
  lastKey = "";
}
