import { describe, expect, it } from "vitest";
import {
  draftBoardSeats,
  remapDraftAfterSeatGrowth,
  snakeDraftOrder,
  turnIndexForSeatPick,
} from "../engine/snake";
import type { DraftPick } from "../types";

describe("draftBoardSeats", () => {
  it("returns unique 0..n-1 columns (never snake-prefix dupes)", () => {
    expect(draftBoardSeats(0)).toEqual([]);
    expect(draftBoardSeats(2)).toEqual([0, 1]);
    expect(draftBoardSeats(4)).toEqual([0, 1, 2, 3]);
  });

  it("does not match the buggy draftOrder.slice(0, n) after 2→4 growth", () => {
    // Repro: 2-player snake prefix of length 4 is [0,1,1,0] — duplicate Admin + Ava.
    const staleTwoPlayer = snakeDraftOrder(2, 4, 0);
    expect(staleTwoPlayer.slice(0, 4)).toEqual([0, 1, 1, 0]);
    expect(draftBoardSeats(4)).toEqual([0, 1, 2, 3]);
    expect(new Set(draftBoardSeats(4)).size).toBe(4);
  });
});

describe("turnIndexForSeatPick", () => {
  it("finds each roster slot in snake order with starter offset", () => {
    const order = snakeDraftOrder(3, 4, 1);
    // order starts [1,2,0, 0,2,1, ...]
    expect(turnIndexForSeatPick(order, 1, 0)).toBe(0);
    expect(turnIndexForSeatPick(order, 2, 0)).toBe(1);
    expect(turnIndexForSeatPick(order, 0, 0)).toBe(2);
    expect(turnIndexForSeatPick(order, 0, 1)).toBe(3);
    expect(turnIndexForSeatPick(order, 9, 0)).toBe(-1);
  });
});

describe("remapDraftAfterSeatGrowth", () => {
  it("rebuilds order and remaps picks when bots are appended mid-draft", () => {
    const seatOrder = ["admin", "bot-ava", "bot-sam", "bot-kai"];
    const picks: DraftPick[] = [
      { playerId: "admin", text: "When Harry Met Sally", pickIndex: 0, turnIndex: 0 },
      { playerId: "bot-ava", text: "Notting Hill", pickIndex: 0, turnIndex: 1 },
    ];
    const remapped = remapDraftAfterSeatGrowth({
      seatOrder,
      picks,
      starterOffset: 0,
    });

    expect(remapped.draftOrder).toEqual(snakeDraftOrder(4, 4, 0));
    expect(remapped.draftOrder.slice(0, 4)).toEqual([0, 1, 2, 3]);
    expect(remapped.picks.map((p) => p.playerId)).toEqual([
      "admin",
      "bot-ava",
    ]);
    expect(remapped.picks.map((p) => p.turnIndex)).toEqual([0, 1]);
    // Next unfilled turn is seat 2 (Bot Sam) — not a duplicate Admin column.
    expect(remapped.draftCursor).toBe(2);
    expect(remapped.draftOrder[remapped.draftCursor]).toBe(2);
  });

  it("preserves later picks by pickIndex across expansion", () => {
    // 2-player: turns [0,1,1,0,...] — after three locks, cursor=3.
    const seatOrder = ["admin", "ava", "sam"];
    const picks: DraftPick[] = [
      { playerId: "admin", text: "A", pickIndex: 0, turnIndex: 0 },
      { playerId: "ava", text: "B", pickIndex: 0, turnIndex: 1 },
      { playerId: "ava", text: "C", pickIndex: 1, turnIndex: 2 },
    ];
    const remapped = remapDraftAfterSeatGrowth({
      seatOrder,
      picks,
      starterOffset: 0,
    });
    const byPlayerPick = (id: string, idx: number) =>
      remapped.picks.find((p) => p.playerId === id && p.pickIndex === idx);
    expect(byPlayerPick("admin", 0)?.turnIndex).toBe(
      turnIndexForSeatPick(remapped.draftOrder, 0, 0),
    );
    expect(byPlayerPick("ava", 1)?.turnIndex).toBe(
      turnIndexForSeatPick(remapped.draftOrder, 1, 1),
    );
    expect(remapped.draftCursor).toBe(2); // first hole (new seat Sam's pick 0)
  });

  it("remaps an in-flight correction target turn", () => {
    const seatOrder = ["admin", "ava", "sam"];
    const picks: DraftPick[] = [
      { playerId: "admin", text: "A", pickIndex: 0, turnIndex: 0 },
      { playerId: "ava", text: "B", pickIndex: 0, turnIndex: 1 },
    ];
    const remapped = remapDraftAfterSeatGrowth({
      seatOrder,
      picks,
      starterOffset: 0,
      correctionTargetTurnIndex: 1,
    });
    expect(remapped.correctionTargetTurnIndex).toBe(
      turnIndexForSeatPick(remapped.draftOrder, 1, 0),
    );
  });

  it("never invents a second admin seat id in seatOrder", () => {
    const seatOrder = ["human-admin", "bot-1", "bot-2"];
    const remapped = remapDraftAfterSeatGrowth({
      seatOrder,
      picks: [],
      starterOffset: 0,
    });
    const seatsInOrder = new Set(remapped.draftOrder);
    expect([...seatsInOrder].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(seatOrder.filter((id) => !id.startsWith("bot-"))).toHaveLength(1);
  });
});
