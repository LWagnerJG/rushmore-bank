import { describe, expect, it } from "vitest";
import { RULES } from "../rules";
import {
  HOST_DISCONNECT_GRACE_MS,
  disconnectGraceMs,
  hostIsHeld,
  nextHostId,
  shouldBumpRevisionOnDisconnect,
  type HostSeat,
} from "../engine/host-sticky";

const NOW = 1_800_000_000_000;

function seats(hostId: string, connected: Record<string, boolean>): HostSeat[] {
  return Object.entries(connected).map(([id, live], i) => ({
    id,
    isHost: id === hostId,
    connected: live,
    role: "player",
    seat: i,
  }));
}

const notBot = (id: string) => id.startsWith("bot-");

describe("sticky host policy", () => {
  it("holds a disconnected host for the full 45s grace", () => {
    expect(HOST_DISCONNECT_GRACE_MS).toBe(45_000);
    expect(RULES.disconnectGraceMs).toBe(45_000);
    expect(RULES.hostFailoverSeconds).toBe(45);
    expect(
      hostIsHeld({
        hostConnected: false,
        hostInGrace: true,
        hostLastSeenAt: NOW - 10_000,
        now: NOW,
      }),
    ).toBe(true);
    expect(
      hostIsHeld({
        hostConnected: false,
        hostInGrace: false,
        hostLastSeenAt: NOW - 20_000,
        now: NOW,
      }),
    ).toBe(true);
    expect(
      hostIsHeld({
        hostConnected: false,
        hostInGrace: false,
        hostLastSeenAt: NOW - 45_000,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("does not promote a live seat while the host is in grace", () => {
    const players = seats("A", { A: false, B: true, C: true });
    expect(
      nextHostId(
        players,
        {
          hostInGrace: true,
          hostLastSeenAt: NOW - 2_000,
          now: NOW,
        },
        notBot,
      ),
    ).toBe("A");
  });

  it("promotes the first connected human only after grace expires", () => {
    const players = seats("A", { A: false, B: true, C: true });
    expect(
      nextHostId(
        players,
        {
          hostInGrace: false,
          hostLastSeenAt: NOW - 50_000,
          now: NOW,
        },
        notBot,
      ),
    ).toBe("B");
  });

  it("prefers a connected human over a connected bot host", () => {
    const players: HostSeat[] = [
      { id: "bot-1", isHost: true, connected: true, role: "player" },
      { id: "B", isHost: false, connected: true, role: "player" },
    ];
    expect(
      nextHostId(
        players,
        { hostInGrace: false, hostLastSeenAt: NOW, now: NOW },
        notBot,
      ),
    ).toBe("B");
  });

  it("never bumps revision on a mere disconnect", () => {
    expect(shouldBumpRevisionOnDisconnect()).toBe(false);
  });

  it("gives lobby hosts the same grace as mid-game hosts", () => {
    expect(disconnectGraceMs({ rosterLocked: false, isHost: true })).toBe(
      45_000,
    );
    expect(disconnectGraceMs({ rosterLocked: true, isHost: false })).toBe(
      45_000,
    );
    expect(disconnectGraceMs({ rosterLocked: false, isHost: false })).toBe(0);
  });
});
