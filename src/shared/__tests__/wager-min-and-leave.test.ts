import { describe, expect, it } from "vitest";
import {
  applyWager,
  clampWager,
  maxWager,
  wagerFromPreset,
} from "../engine/wager";
import { applyDiceRoll } from "../engine/dice";

describe("min wager ≥ 1 when beans exist", () => {
  it("clampWager rejects 0 when max ≥ 1", () => {
    expect(clampWager(0, 40, 30)).toBe(1);
    expect(clampWager(-5, 10, 0)).toBe(1);
    expect(clampWager(99, 40, 30)).toBe(70);
  });

  it("clampWager allows 0 only when max is 0", () => {
    expect(maxWager(0, 0)).toBe(0);
    expect(clampWager(0, 0, 0)).toBe(0);
    expect(clampWager(5, 0, 0)).toBe(0);
  });

  it("applyWager never locks a zero pot when beans are available", () => {
    const locked = applyWager({ banked: 30, earned: 40, wager: 0 });
    expect(locked.pot).toBe(1);
    expect(locked.protected).toBe(69);
  });

  it("keep_all becomes minimum risk (1) when beans exist", () => {
    expect(wagerFromPreset("keep_all", 40, 30)).toBe(1);
    expect(wagerFromPreset("keep_all", 0, 0)).toBe(0);
  });
});

describe("zero-pot dice edge does not soft-lock", () => {
  it("doubles on pot 0 stay at 0 (cannot grow) — callers must auto-bank", () => {
    const o = applyDiceRoll(0, { d1: 3, d2: 3 }, 1);
    expect(o.busted).toBe(false);
    expect(o.potAfter).toBe(0);
  });

  it("non-double on pot 0 can still grow, seven still busts", () => {
    const add = applyDiceRoll(0, { d1: 2, d2: 3 }, 1);
    expect(add.potAfter).toBe(5);
    const bust = applyDiceRoll(0, { d1: 3, d2: 4 }, 1);
    expect(bust.busted).toBe(true);
    expect(bust.potAfter).toBe(0);
  });
});

describe("leave seat-order shrink (unit)", () => {
  it("removing a seat renumbers remaining players 4→3", () => {
    const seatOrder = ["a", "b", "c", "d"];
    const leftId = "b";
    const next = seatOrder.filter((id) => id !== leftId);
    expect(next).toEqual(["a", "c", "d"]);
    expect(next).toHaveLength(3);
    // Turn seat after removing index 1: if turn was on left player, keep index
    let diceTurnSeat = 1; // was b
    const seatIdx = seatOrder.indexOf(leftId);
    if (diceTurnSeat >= next.length) diceTurnSeat = 0;
    else if (seatIdx < diceTurnSeat) diceTurnSeat -= 1;
    // current roller left → index stays, next player slides into place
    expect(next[diceTurnSeat]).toBe("c");
  });

  it("host promotion picks first remaining connected human", () => {
    const players = [
      { id: "a", isHost: true, connected: false, role: "player" as const },
      { id: "bot-1", isHost: false, connected: true, role: "player" as const },
      { id: "c", isHost: false, connected: true, role: "player" as const },
    ];
    const humans = players.filter(
      (p) => p.role === "player" && p.connected && !p.id.startsWith("bot-"),
    );
    const pool =
      humans.length > 0
        ? humans
        : players.filter((p) => p.role === "player" && p.connected);
    const next = pool[0]!;
    for (const p of players) p.isHost = p.id === next.id;
    expect(players.find((p) => p.isHost)?.id).toBe("c");
  });
});
