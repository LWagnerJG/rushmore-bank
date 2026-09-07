import { RULES } from "../rules";

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
