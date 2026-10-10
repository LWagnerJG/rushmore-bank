import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.stubGlobal("window", {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  },
  sessionStorage: {
    getItem: (k: string) => store.get(`s:${k}`) ?? null,
    setItem: (k: string, v: string) => {
      store.set(`s:${k}`, v);
    },
    removeItem: (k: string) => {
      store.delete(`s:${k}`);
    },
  },
});

import {
  allowRoomRejoin,
  getStablePlayerId,
  markRoomRemoved,
  recallRoomSession,
  recallRoomSessionForRejoin,
  rejoinOffer,
  rememberRoomSession,
  wasRemovedFromRoom,
} from "@/lib/party";

describe("room session persistence", () => {
  beforeEach(() => {
    store.clear();
  });

  it("remembers and recalls a fresh membership", () => {
    rememberRoomSession({
      code: "abcd",
      name: "AlexTheGreat",
      role: "player",
      playerId: "pid-1",
      at: Date.now(),
    });
    const session = recallRoomSession("ABCD");
    expect(session?.name).toBe("AlexTheGreat");
    expect(session?.playerId).toBe("pid-1");
    expect(session?.role).toBe("player");
  });

  it("drops stale memberships", () => {
    rememberRoomSession({
      code: "ABCD",
      name: "Old",
      role: "player",
      playerId: "pid-old",
      at: Date.now() - 3 * 60 * 60 * 1000,
    });
    expect(recallRoomSession("ABCD")).toBeNull();
  });

  it("clears a removed seat until the player chooses to join again", () => {
    const membership = {
      code: "ABCD", name: "Luke", role: "player" as const,
      playerId: "duplicate", at: Date.now(),
    };
    rememberRoomSession(membership);
    markRoomRemoved("abcd", "duplicate");
    expect(wasRemovedFromRoom("ABCD")).toBe(true);
    expect(recallRoomSession("ABCD")).toBeNull();
    expect(store.has("quarry:pid:last:ABCD")).toBe(false);
    expect(store.has("s:quarry:pid:session:ABCD")).toBe(false);

    allowRoomRejoin("ABCD");
    rememberRoomSession(membership);
    expect(wasRemovedFromRoom("ABCD")).toBe(false);
    expect(recallRoomSession("ABCD")?.playerId).toBe("duplicate");
  });

  it("does not erase another tab's membership in the same room", () => {
    rememberRoomSession({
      code: "ABCD", name: "Other tab", role: "player",
      playerId: "other", at: Date.now(),
    });
    markRoomRemoved("ABCD", "duplicate");
    expect(store.get("quarry:pid:last:ABCD")).toBe("other");
    expect(JSON.parse(store.get("quarry:room-session:ABCD")!).playerId).toBe("other");
    expect(recallRoomSession("ABCD")).toBeNull();
  });

  it("auto-resume ignores localStorage-only membership (second tab)", () => {
    const session = {
      code: "ABCD",
      name: "Luke",
      role: "player" as const,
      playerId: "tab-a",
      at: Date.now(),
    };
    store.set("quarry:room-session:ABCD", JSON.stringify(session));
    expect(recallRoomSession("ABCD")).toBeNull();
    expect(recallRoomSessionForRejoin("ABCD")?.playerId).toBe("tab-a");
  });
});

describe("rejoin offer on the invite landing", () => {
  const seat = (over: Partial<Parameters<typeof rememberRoomSession>[0]> = {}) =>
    JSON.stringify({
      code: "ABCD", name: "Wags", role: "player", playerId: "seat-1",
      at: Date.now(), ...over,
    });

  beforeEach(() => {
    store.clear();
  });

  it("offers nothing to a first-time visitor, though an id was minted", () => {
    const minted = getStablePlayerId("ABCD");
    expect(store.get("quarry:pid:last:ABCD")).toBe(minted);
    expect(rejoinOffer("ABCD")).toBeNull();
  });

  it("offers the seat this phone held in a closed tab", () => {
    store.set("quarry:room-session:ABCD", seat());
    expect(rejoinOffer("abcd")).toMatchObject({ name: "Wags", playerId: "seat-1" });
  });

  it("stays out of the way when this tab is already resuming its seat", () => {
    rememberRoomSession(JSON.parse(seat()));
    expect(rejoinOffer("ABCD")).toBeNull();
  });

  it("skips spectators, stale seats, and removed seats", () => {
    store.set("quarry:room-session:ABCD", seat({ role: "spectator" }));
    expect(rejoinOffer("ABCD")).toBeNull();
    store.set("quarry:room-session:ABCD", seat({ at: Date.now() - 3 * 60 * 60 * 1000 }));
    expect(rejoinOffer("ABCD")).toBeNull();
    store.set("quarry:room-session:ABCD", seat());
    store.set("s:quarry:room-removed:ABCD", "1");
    expect(rejoinOffer("ABCD")).toBeNull();
  });
});
