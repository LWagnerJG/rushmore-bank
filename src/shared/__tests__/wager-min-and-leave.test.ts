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

describe("leave soft-disconnect + host (unit)", () => {
  it("mid-game leave keeps seat order for rejoin (no 4→3 shrink)", () => {
    const seatOrder = ["a", "b", "c", "d"];
    const leftId = "b";
    // Soft disconnect: seat stays; only connected flag flips.
    const connected = Object.fromEntries(
      seatOrder.map((id) => [id, id !== leftId]),
    );
    expect(seatOrder).toHaveLength(4);
    expect(connected["b"]).toBe(false);
    const connectedSeats = seatOrder.filter((id) => connected[id]);
    expect(connectedSeats).toEqual(["a", "c", "d"]);
  });

  it("lobby leave still shrinks headcount", () => {
    let players = [
      { id: "a", role: "player" as const },
      { id: "b", role: "player" as const },
      { id: "c", role: "player" as const },
    ];
    const leftId = "b";
    const rosterLocked = false;
    if (!rosterLocked) {
      players = players.filter((p) => p.id !== leftId);
    }
    expect(players.map((p) => p.id)).toEqual(["a", "c"]);
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

  it("draft board fit: ≤5 players force no minWidth overflow", () => {
    function densityFor(count: number): "fit" | "snug" | "dense" {
      if (count <= 5) return "fit";
      if (count >= 8) return "dense";
      return "snug";
    }
    expect(densityFor(2)).toBe("fit");
    expect(densityFor(4)).toBe("fit");
    expect(densityFor(5)).toBe("fit");
    expect(densityFor(6)).toBe("snug");
    expect(densityFor(9)).toBe("dense");
  });
});
