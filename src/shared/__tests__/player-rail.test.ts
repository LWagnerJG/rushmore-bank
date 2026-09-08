import { describe, expect, it } from "vitest";
import { sortLeaderboard } from "@/components/PlayerRail";
import type { Player } from "@/shared/types";

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
