/**
 * Dice SFX entry points — thin wrappers over shared WebAudio sfx.
 * Sound only (no haptics) so spectators don't buzz on every remote roll.
 * Prefer `feedback()` when the local player should also feel a cue.
 */

import { ensureAudio, playSfx } from "@/lib/sfx";

/** @deprecated use ensureAudio */
export async function ensureDiceAudio(): Promise<AudioContext | null> {
  return ensureAudio();
}

/** Soft cue when a roll commits. */
export function playRollStart(_ctx?: AudioContext | null) {
  playSfx("dice_tick");
}

/** Brief tick while tumbling (throttled by caller). */
export function playRollTick(_ctx?: AudioContext | null) {
  playSfx("dice_tick");
}

/** Settle land — bust uses soft thud. */
export function playSettle(
  _ctx?: AudioContext | null,
  opts?: { busted?: boolean },
) {
  playSfx(opts?.busted ? "bust" : "dice_settle");
}

export function playBankChime(_ctx?: AudioContext | null) {
  playSfx("bank");
}
