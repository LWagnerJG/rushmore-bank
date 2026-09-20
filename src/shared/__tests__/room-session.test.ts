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
  getLastPlayerIdForRejoin,
  markRoomRemoved,
  recallRoomSession,
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
    expect(getLastPlayerIdForRejoin("ABCD")).toBeNull();
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
    expect(getLastPlayerIdForRejoin("ABCD")).toBe("other");
    expect(JSON.parse(store.get("quarry:room-session:ABCD")!).playerId).toBe("other");
    expect(recallRoomSession("ABCD")).toBeNull();
  });
});
