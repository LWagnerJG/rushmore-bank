/**
 * Fail-proof dice presentation phases.
 *
 * Contract:
 * - Tumble is cosmetic only and must never look "settled".
 * - Settled faces come only from authoritative server d1/d2.
 * - Clients must never invent a rest face during roll.
 */
import type { PublicDiceBroadcast } from "../types";
import { animProgress } from "./dice-sync";

export type DicePresentPhase =
  | { kind: "idle"; d1: number; d2: number }
  | {
      kind: "tumbling";
      rollId: string;
      seed: number;
      startedAt: number;
      settleAt: number;
    }
  | {
      kind: "settled";
      rollId: string;
      d1: number;
      d2: number;
      busted: boolean;
    };

/** Authoritative faces only — undefined while still secret. */
export function authoritativeFaces(
  broadcast: PublicDiceBroadcast | null | undefined,
): { d1: number; d2: number } | null {
  if (!broadcast?.revealed) return null;
  if (broadcast.d1 == null || broadcast.d2 == null) return null;
  if (
    !Number.isInteger(broadcast.d1) ||
    !Number.isInteger(broadcast.d2) ||
    broadcast.d1 < 1 ||
    broadcast.d1 > 6 ||
    broadcast.d2 < 1 ||
    broadcast.d2 > 6
  ) {
    return null;
  }
  return { d1: broadcast.d1, d2: broadcast.d2 };
}

export function resolveDicePresentPhase(
  broadcast: PublicDiceBroadcast | null | undefined,
): DicePresentPhase {
  if (!broadcast) return { kind: "idle", d1: 1, d2: 1 };

  const faces = authoritativeFaces(broadcast);
  if (faces) {
    return {
      kind: "settled",
      rollId: broadcast.rollId,
      d1: faces.d1,
      d2: faces.d2,
      busted: !!broadcast.busted,
    };
  }

  return {
    kind: "tumbling",
    rollId: broadcast.rollId,
    seed: broadcast.animSeed,
    startedAt: broadcast.animStartedAt,
    settleAt: broadcast.animSettleAt,
  };
}

/**
 * Display progress for cosmetic tumble.
 * Hard-capped below the "nearly stopped" zone so wall-clock skew or a late
 * reveal can never leave the dice resting on a random/seed face.
 */
export const TUMBLE_DISPLAY_CAP = 0.62;

export function tumbleDisplayProgress(
  now: number,
  startedAt: number,
  settleAt: number,
): number {
  return Math.min(TUMBLE_DISPLAY_CAP, animProgress(now, startedAt, settleAt));
}

/** True when a pose still has enough spin that faces are not readable as final. */
export function tumbleStillSpinning(pose: {
  rx: number;
  ry: number;
  rz: number;
}): boolean {
  // Residual angular magnitude relative to a near-static coast.
  const mag = Math.abs(pose.rx) + Math.abs(pose.ry) + Math.abs(pose.rz);
  return mag > 0.35;
}
