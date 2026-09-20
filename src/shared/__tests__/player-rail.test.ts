import { describe, expect, it } from "vitest";
import {
  sortDraftBoardPlayers,
  sortLeaderboard,
} from "@/components/PlayerRail";
import { currentUpPlayerId } from "@/shared/engine/up-seat";
import type { Player, PublicRoomState } from "@/shared/types";
import { emptyRoomState } from "@/shared/types";
import { projectPublicState } from "@/shared/engine/public-state";

function p(
  partial: Partial<Player> & Pick<Player, "id" | "name" | "stones">,
): Player {
  return {
    connected: true,
    role: "player",
    isHost: false,
    seat: partial.seat ?? 0,
    joinedAt: 0,
    ...partial,
  };
}

describe("sortLeaderboard", () => {
  it("puts local player first, then beans descending", () => {
    const players = [
      p({ id: "a", name: "Ada", stones: 3, seat: 0 }),
      p({ id: "b", name: "Bea", stones: 12, seat: 1 }),
      p({ id: "c", name: "Cal", stones: 7, seat: 2 }),
      p({ id: "me", name: "Me", stones: 1, seat: 3 }),
    ];
    expect(sortLeaderboard(players, "me").map((x) => x.id)).toEqual([
      "me",
      "b",
      "c",
      "a",
    ]);
  });

  it("uses seat as stable tiebreak when beans match", () => {
    const players = [
      p({ id: "z", name: "Zed", stones: 5, seat: 2 }),
      p({ id: "y", name: "Yan", stones: 5, seat: 0 }),
      p({ id: "me", name: "Me", stones: 5, seat: 1 }),
    ];
    expect(sortLeaderboard(players, "me").map((x) => x.id)).toEqual([
      "me",
      "y",
      "z",
    ]);
  });
});

describe("sortDraftBoardPlayers", () => {
  it("matches the draft board's seat columns, without putting You first", () => {
    const players = [
      p({ id: "you", name: "You", stones: 1, seat: 2 }),
      p({ id: "a", name: "Ada", stones: 3, seat: 0 }),
      p({ id: "b", name: "Bea", stones: 12, seat: 1 }),
    ];
    expect(
      sortDraftBoardPlayers(players, ["a", "b", "you"]).map((x) => x.id),
    ).toEqual(["a", "b", "you"]);
  });

  it("rotates with starterOffset so first drafter is leftmost", () => {
    const players = [
      p({ id: "a", name: "Ada", stones: 9, seat: 0 }),
      p({ id: "b", name: "Bea", stones: 1, seat: 1 }),
      p({ id: "c", name: "Cal", stones: 5, seat: 2 }),
    ];
    // Offset 1 → columns [b, c, a] — not score order, not raw seatOrder.
    expect(
      sortDraftBoardPlayers(players, ["a", "b", "c"], 1).map((x) => x.id),
    ).toEqual(["b", "c", "a"]);
    expect(
      sortDraftBoardPlayers(players, ["a", "b", "c"], 2).map((x) => x.id),
    ).toEqual(["c", "a", "b"]);
  });
});

describe("currentUpPlayerId", () => {
  it("returns the draft seat on the clock", () => {
    const room = emptyRoomState("ABCD");
    room.phase = "DRAFT";
    room.seatOrder = ["sam", "ava", "you"];
    room.draftOrder = [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0];
    room.draftCursor = 1;
    room.players = [
      p({ id: "sam", name: "Bot Sam", stones: 0, seat: 0 }),
      p({ id: "ava", name: "Bot Ava", stones: 0, seat: 1 }),
      p({ id: "you", name: "You", stones: 0, seat: 2 }),
    ];
    const pub = projectPublicState(room, "you") as PublicRoomState;
    expect(currentUpPlayerId(pub)).toBe("ava");
  });

  it("returns the dice roller when in DICE", () => {
    const room = emptyRoomState("ABCD");
    room.phase = "DICE";
    room.seatOrder = ["a", "b"];
    room.diceTurnSeat = 1;
    expect(currentUpPlayerId(room)).toBe("b");
  });

  it("is null outside turn-based phases", () => {
    const room = emptyRoomState("ABCD");
    room.phase = "REVIEW";
    room.seatOrder = ["a"];
    expect(currentUpPlayerId(room)).toBeNull();
  });
});
