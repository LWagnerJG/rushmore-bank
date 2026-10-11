import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  playerRailPropsAreEqual,
  playerRailRenderKey,
  settingsSheetPropsAreEqual,
} from "@/lib/room-render-guards";
import {
  getRoomSnapshot,
  publishRoomSnapshot,
  resetRoomSnapshotForTests,
  subscribeRoom,
} from "@/lib/room-store";
import { emptyRoomState, type PublicRoomState } from "@/shared/types";
import { projectPublicState } from "@/shared/engine/public-state";

const srcDir = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(srcDir, p), "utf8");

function pub(phase: PublicRoomState["phase"]): PublicRoomState {
  const s = emptyRoomState("MEMO");
  s.phase = phase;
  s.players = [
    {
      id: "a",
      name: "Ada",
      stones: 10,
      connected: true,
      isHost: true,
      role: "player",
      seat: 0,
      joinedAt: 1,
    },
    {
      id: "b",
      name: "Bea",
      stones: 8,
      connected: true,
      isHost: false,
      role: "player",
      seat: 1,
      joinedAt: 1,
    },
  ];
  s.seatOrder = ["a", "b"];
  return projectPublicState(s, "a");
}

describe("settingsSheetPropsAreEqual", () => {
  it("ignores broadcast churn while closed", () => {
    expect(
      settingsSheetPropsAreEqual(
        {
          open: false,
          playerCount: 2,
          hostAiJudge: { status: "ready" },
          partyOn: false,
        },
        {
          open: false,
          playerCount: 4,
          hostAiJudge: { status: "pending" },
          partyOn: true,
          currentPhase: "DICE",
        },
      ),
    ).toBe(true);
  });

  it("compares fields when open", () => {
    expect(
      settingsSheetPropsAreEqual(
        { open: true, playerCount: 2, partyOn: false },
        { open: true, playerCount: 3, partyOn: false },
      ),
    ).toBe(false);
    expect(
      settingsSheetPropsAreEqual(
        { open: true, playerCount: 2, partyOn: false },
        { open: true, playerCount: 2, partyOn: false },
      ),
    ).toBe(true);
  });
});

describe("playerRailPropsAreEqual", () => {
  it("skips when only notice / host heartbeat-ish fields change", () => {
    const a = pub("SCORE_REVEAL");
    const b: PublicRoomState = {
      ...a,
      notice: "Host reconnecting…",
      hostLastSeenAt: (a.hostLastSeenAt ?? 0) + 8000,
      stateVersion: (a.stateVersion ?? 0) + 1,
    };
    expect(playerRailPropsAreEqual({ state: a, youId: "a" }, { state: b, youId: "a" })).toBe(
      true,
    );
    expect(playerRailRenderKey(a, "a")).toBe(playerRailRenderKey(b, "a"));
  });

  it("re-renders when beans or up-seat change", () => {
    const a = pub("SCORE_REVEAL");
    const b: PublicRoomState = {
      ...a,
      players: a.players.map((p) =>
        p.id === "b" ? { ...p, stones: p.stones + 5 } : p,
      ),
    };
    expect(playerRailPropsAreEqual({ state: a, youId: "a" }, { state: b, youId: "a" })).toBe(
      false,
    );
  });
});

describe("room store publish", () => {
  it("notifies subscribers only when snapshot identity changes", () => {
    resetRoomSnapshotForTests();
    let ticks = 0;
    const unsub = subscribeRoom(() => {
      ticks += 1;
    });
    const state = pub("LOBBY");
    publishRoomSnapshot({ state, youId: "a" });
    publishRoomSnapshot({ state, youId: "a" }); // same refs — no notify
    expect(ticks).toBe(1);
    expect(getRoomSnapshot().youId).toBe("a");
    publishRoomSnapshot({ state, youId: "b" });
    expect(ticks).toBe(2);
    unsub();
    resetRoomSnapshotForTests();
  });
});

describe("room memo wiring (source)", () => {
  it("memoizes SettingsSheet / PlayerRail / ProfileButton / BrandMark", () => {
    expect(read("components/SettingsSheet.tsx")).toMatch(/memo\(SettingsSheetImpl/);
    expect(read("components/PlayerRail.tsx")).toMatch(/playerRailPropsAreEqual/);
    expect(read("components/ProfileButton.tsx")).toMatch(/memo\(function ProfileButton/);
    expect(read("components/BrandMark.tsx")).toMatch(/memo\(function BrandMark/);
  });

  it("splits RoomActionsProvider and publishes room snapshot", () => {
    expect(read("components/RoomClient.tsx")).toMatch(/RoomActionsProvider/);
    expect(read("hooks/useGameRoom.ts")).toMatch(/publishRoomSnapshot/);
    expect(read("lib/room-actions.tsx")).toMatch(/RoomActionsContext/);
  });
});
