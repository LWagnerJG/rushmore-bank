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
  recallRoomSession,
  rememberRoomSession,
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
});
