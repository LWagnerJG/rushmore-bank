import { beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the hook's socket callbacks without a DOM or a real network.
const harness = vi.hoisted(() => ({
  effects: [] as Array<() => unknown>,
  options: null as null | {
    id: string;
    onOpen: () => void;
    onMessage: (event: { data: string }) => void;
  },
  socket: { readyState: 1, send: vi.fn(), reconnect: vi.fn() },
}));

vi.mock("react", () => ({
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => [
    typeof initial === "function" ? initial() : initial, vi.fn(),
  ],
  useEffect: (effect: () => unknown) => harness.effects.push(effect),
}));
vi.mock("partysocket/react", () => ({
  default: (options: NonNullable<typeof harness.options>) => {
    harness.options = options;
    return harness.socket;
  },
}));

import { useGameRoom } from "./useGameRoom";
import { recallRoomSession, wasRemovedFromRoom } from "@/lib/party";
import { emptyRoomState } from "@/shared/types";
import { projectPublicState } from "@/shared/engine/public-state";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

function mount() {
  harness.effects = [];
  const room = useGameRoom("ABCD", { preferredName: "Luke" });
  for (const effect of harness.effects) effect();
  return room;
}

function receive(message: unknown) {
  harness.options!.onMessage({ data: JSON.stringify(message) });
}

function joinState() {
  const id = harness.options!.id;
  const state = emptyRoomState("ABCD");
  state.players = [{
    id, name: "Luke", role: "player", isHost: false,
    connected: true, seat: null, stones: 0, joinedAt: 1,
  }];
  return { type: "joined", youId: id, state: projectPublicState(state, id) };
}

describe("removed room membership", () => {
  beforeEach(() => {
    harness.socket.send.mockClear();
    vi.stubGlobal("window", {
      sessionStorage: storage(), localStorage: storage(),
      addEventListener() {}, removeEventListener() {},
    });
    vi.stubGlobal("document", { addEventListener() {}, removeEventListener() {} });
    vi.stubGlobal("WebSocket", { OPEN: 1 });
  });

  for (const removal of [
    { type: "error", code: "REMOVED_FROM_LOBBY", message: "Seat removed" },
    { type: "error", message: "You were removed from the lobby by the host. You can rejoin with a fresh seat." },
  ]) {
    it(`stops automatic rejoin for ${"code" in removal ? "new" : "older"} servers`, () => {
      const room = mount();
      harness.options!.onOpen();
      const joined = joinState();
      receive(joined);
      expect(recallRoomSession("ABCD")?.name).toBe("Luke");

      receive(removal);
      // A queued state must not restore the removed membership.
      receive(joined);
      harness.socket.send.mockClear();
      harness.options!.onOpen();
      expect(harness.socket.send).not.toHaveBeenCalled();
      expect(recallRoomSession("ABCD")).toBeNull();
      expect(wasRemovedFromRoom("ABCD")).toBe(true);

      room.join("Luke");
      expect(JSON.parse(harness.socket.send.mock.calls[0][0])).toMatchObject({
        type: "join", name: "Luke", role: "player",
      });
      expect(wasRemovedFromRoom("ABCD")).toBe(false);
      harness.socket.send.mockClear();
      harness.options!.onOpen();
      expect(harness.socket.send).toHaveBeenCalledTimes(1);
    });
  }

  it("keeps removal across reload even with a nickname in the URL", () => {
    mount();
    receive(joinState());
    receive({ type: "error", code: "REMOVED_FROM_LOBBY", message: "Seat removed" });
    harness.socket.send.mockClear();
    mount();
    harness.options!.onOpen();
    expect(harness.socket.send).not.toHaveBeenCalled();
  });

  it("preserves reconnect for ordinary game errors", () => {
    mount();
    receive(joinState());
    receive({ type: "error", message: "Not your turn" });
    harness.options!.onOpen();
    expect(harness.socket.send).toHaveBeenCalledTimes(1);
    expect(wasRemovedFromRoom("ABCD")).toBe(false);
  });
});
