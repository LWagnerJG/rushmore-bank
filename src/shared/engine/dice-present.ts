/**
 * Fail-proof dice presentation phases.
 *
 * Contract (hard invariant):
 * - While tumbling, clients may show scramble faces (anticipation only).
 * - Scramble must never be treated as settled — tray auth d1/d2 stay empty.
 * - Settled faces come only from authoritative server d1/d2 after reveal.
 * - The first frame that looks "settled" must equal those server faces.
 * - Hard cut scramble → auth (no coast, no morph, no late jump).
 */
import type { PublicDiceBroadcast } from "../types";

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

/**
 * What the UI may paint as *settled* faces for this broadcast.
 * null ⇒ tumble mode (scramble OK; never invent a settled face).
 */
export function displayFaces(
  broadcast: PublicDiceBroadcast | null | undefined,
): { d1: number; d2: number } | null {
  if (!broadcast) return { d1: 1, d2: 1 };
  return authoritativeFaces(broadcast);
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

/** @deprecated Kept for older tests; 2D tray no longer uses progress caps. */
export const TUMBLE_DISPLAY_CAP = 0.62;

/** @deprecated 2D tray does not drive faces from tumble progress. */
export function tumbleDisplayProgress(
  now: number,
  startedAt: number,
  settleAt: number,
): number {
  if (settleAt <= startedAt) return TUMBLE_DISPLAY_CAP;
  const t = Math.min(1, Math.max(0, (now - startedAt) / (settleAt - startedAt)));
  return Math.min(TUMBLE_DISPLAY_CAP, t);
}
