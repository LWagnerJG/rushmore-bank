import { RULES } from "../rules";
import type { DraftPick } from "../types";

/**
 * Snake draft order for `passes` rounds over `n` seats.
 * Passes alternate forward / reverse.
 * `starterOffset` rotates who picks first (mod n).
 */
export function snakeDraftOrder(
  n: number,
  passes: number = RULES.picksPerPlayer,
  starterOffset: number = 0,
): number[] {
  if (n < 1) return [];
  const order: number[] = [];
  for (let pass = 0; pass < passes; pass++) {
    const forward = pass % 2 === 0;
    if (forward) {
      for (let i = 0; i < n; i++) {
        order.push((i + starterOffset) % n);
      }
    } else {
      for (let i = n - 1; i >= 0; i--) {
        order.push((i + starterOffset) % n);
      }
    }
  }
  return order;
}

/** Total picks in a full snake draft. */
export function totalDraftPicks(n: number): number {
  return n * RULES.picksPerPlayer;
}

/**
 * Stable unique column seats for the draft board: one column per seat, rotated
 * by starterOffset so the first drafter of this round is always leftmost.
 * Never derive columns from a snake `draftOrder` prefix — that prefix repeats
 * seats on reverse passes and duplicates headers when seatOrder grows mid-draft
 * (admin add-bots) without a matching draftOrder.
 */
export function draftBoardSeats(
  seatCount: number,
  starterOffset: number = 0,
): number[] {
  if (seatCount < 1) return [];
  return Array.from(
    { length: seatCount },
    (_, i) => (i + starterOffset) % seatCount,
  );
}

/**
 * Turn index in `draftOrder` for a seat's Nth roster pick (0-based pickIndex).
 * Returns -1 when that seat/pick is not present in the order.
 */
export function turnIndexForSeatPick(
  draftOrder: number[],
  seat: number,
  pickIndex: number,
): number {
  if (pickIndex < 0) return -1;
  let seen = 0;
  for (let t = 0; t < draftOrder.length; t++) {
    if (draftOrder[t] !== seat) continue;
    if (seen === pickIndex) return t;
    seen += 1;
  }
  return -1;
}

export interface RemappedDraftRoster {
  draftOrder: number[];
  picks: DraftPick[];
  /** First unfilled turn index (or draftOrder.length when complete). */
  draftCursor: number;
  /** Remapped correction target turn, or null if none / unmapped. */
  correctionTargetTurnIndex: number | null;
}

/**
 * Rebuild snake order for an expanded seat count and remap existing picks by
 * (player seat, pickIndex). Used when admin injects bots mid-draft so columns,
 * turn indices, and the clock stay aligned with seatOrder.
 */
export function remapDraftAfterSeatGrowth(args: {
  seatOrder: string[];
  picks: DraftPick[];
  starterOffset: number;
  passes?: number;
  /** Prior correction target turn index, if any. */
  correctionTargetTurnIndex?: number | null;
}): RemappedDraftRoster {
  const n = args.seatOrder.length;
  const passes = args.passes ?? RULES.picksPerPlayer;
  const offset = n > 0 ? args.starterOffset % n : 0;
  const draftOrder = snakeDraftOrder(n, passes, offset);
  const seatByPlayer = new Map(args.seatOrder.map((id, i) => [id, i]));

  const priorCorrection =
    args.correctionTargetTurnIndex != null
      ? args.picks.find((p) => p.turnIndex === args.correctionTargetTurnIndex)
      : null;

  const picks = args.picks
    .map((pick) => {
      const seat = seatByPlayer.get(pick.playerId);
      if (seat == null) return pick;
      const turnIndex = turnIndexForSeatPick(draftOrder, seat, pick.pickIndex);
      if (turnIndex < 0) return pick;
      return { ...pick, turnIndex };
    })
    .sort((a, b) => a.turnIndex - b.turnIndex);

  const filled = new Set(picks.map((p) => p.turnIndex));
  let draftCursor = 0;
  while (draftCursor < draftOrder.length && filled.has(draftCursor)) {
    draftCursor += 1;
  }

  let correctionTargetTurnIndex: number | null = null;
  if (priorCorrection) {
    const seat = seatByPlayer.get(priorCorrection.playerId);
    if (seat != null) {
      const t = turnIndexForSeatPick(
        draftOrder,
        seat,
        priorCorrection.pickIndex,
      );
      correctionTargetTurnIndex = t >= 0 ? t : null;
    }
  }

  return { draftOrder, picks, draftCursor, correctionTargetTurnIndex };
}
