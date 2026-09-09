import type { PublicRoomState, RoomState } from "../types";

/** Player whose action is on the clock (draft / correction / dice). */
export function currentUpPlayerId(
  state: Pick<
    PublicRoomState | RoomState,
    "phase" | "seatOrder" | "draftOrder" | "draftCursor" | "diceTurnSeat"
  >,
): string | null {
  if (state.phase === "DRAFT" || state.phase === "CORRECTION") {
    const seat = state.draftOrder[state.draftCursor];
    if (seat == null) return null;
    return state.seatOrder[seat] ?? null;
  }
  if (state.phase === "DICE") {
    return state.seatOrder[state.diceTurnSeat] ?? null;
  }
  return null;
}
