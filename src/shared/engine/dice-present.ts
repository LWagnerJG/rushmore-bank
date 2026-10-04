/**
 * Fail-proof dice presentation phases.
 *
 * Contract (hard invariant):
 * - While tumbling, clients may show scramble faces (anticipation only).
 * - Scramble must never be treated as settled — tray auth d1/d2 stay empty.
 * - Settled faces come only from authoritative server d1/d2 after reveal.
 * - The first frame that looks "settled" must equal those server faces.
 * - Hard cut scramble → auth (no coast, no morph, no late jump).
 * - BEAN BUSTER / result readout must use the same revealed rollId as the tray.
 */
import type { DiceSubphase, PublicDiceBroadcast } from "../types";
import { rollNetBeansAdded } from "./dice";

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

/** Snapshot of a revealed roll for sticky scramble gaps + settle readout. */
export type DiceReadoutRoll = {
  rollId: string;
  rollerId: string;
  d1: number;
  d2: number;
  gain: number;
  busted: boolean;
  note?: string;
};

export type DiceReadout = {
  /** Authoritative faces for this paint (null while tumbling / idle-clear). */
  d1: number | null;
  d2: number | null;
  rollId: string | null;
  rollerId: string | null;
  showBust: boolean;
  showTotal: boolean;
  gain: number | null;
  busted: boolean;
  /** Sticky prior total is fine during tumble; never a prior bust banner. */
  resultStale: boolean;
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
 * Live revealed roll from the server broadcast (same frame as tray settle).
 * null while faces are secret or absent — callers may keep a sticky prior.
 */
export function liveReadoutRoll(
  broadcast: PublicDiceBroadcast | null | undefined,
): DiceReadoutRoll | null {
  const faces = authoritativeFaces(broadcast);
  if (!broadcast || !faces) return null;
  const potAfter = broadcast.potAfter ?? broadcast.potBefore;
  const busted = !!broadcast.busted;
  return {
    rollId: broadcast.rollId,
    rollerId: broadcast.rollerId,
    d1: faces.d1,
    d2: faces.d2,
    gain: rollNetBeansAdded(broadcast.potBefore, potAfter, busted),
    busted,
    note: broadcast.note,
  };
}

/**
 * Result banner / total for DicePanel.
 *
 * Invariants:
 * - While SETTLED with a revealed broadcast, always use that roll (never sticky).
 * - BEAN BUSTER only when that roll is busted and faces sum to 7.
 * - During COMMITTED tumble, sticky may keep a prior non-bust total; never a bust.
 * - Faces in the readout always match the rollId being shown.
 */
export function resolveDiceReadout(
  diceSubphase: DiceSubphase,
  broadcast: PublicDiceBroadcast | null | undefined,
  sticky: DiceReadoutRoll | null,
): DiceReadout {
  const settling = diceSubphase === "SETTLED";
  const rolling = diceSubphase === "COMMITTED";
  const live = liveReadoutRoll(broadcast);

  // Settle / READY with faces: authoritative live roll wins over sticky.
  const shown = live ?? (rolling && sticky && !sticky.busted ? sticky : null);

  if (settling && live) {
    const isSeven = live.d1 + live.d2 === 7;
    const showBust = live.busted && isSeven;
    return {
      d1: live.d1,
      d2: live.d2,
      rollId: live.rollId,
      rollerId: live.rollerId,
      showBust,
      showTotal: !showBust && !live.busted,
      gain: showBust ? 0 : live.gain,
      busted: live.busted,
      resultStale: false,
    };
  }

  // Tumble / gaps: optional sticky prior total only (never a lingering bust).
  if (shown && !shown.busted) {
    return {
      d1: shown.d1,
      d2: shown.d2,
      rollId: shown.rollId,
      rollerId: shown.rollerId,
      showBust: false,
      showTotal: true,
      gain: shown.gain,
      busted: false,
      resultStale: rolling,
    };
  }

  return {
    d1: null,
    d2: null,
    rollId: null,
    rollerId: null,
    showBust: false,
    showTotal: false,
    gain: null,
    busted: false,
    resultStale: false,
  };
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
