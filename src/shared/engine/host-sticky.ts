/**
 * Sticky host: a brief drop must not transfer the gavel.
 *
 * Playtest root cause: `ensureHost()` treated "no *connected* host" as
 * "no host" and promoted the first live seat. Any other reconnect, DO
 * wake, or lobby onClose then flipped isHost — and onClose also bumped
 * phaseRevision, remounting host-only UI.
 *
 * Hold the current host through disconnect grace (~45s) even when their
 * socket is down. Transfer only after grace (and failover) expire.
 */
import { RULES } from "../rules";

export const HOST_DISCONNECT_GRACE_MS = RULES.disconnectGraceMs;

export type HostHoldInput = {
  hostConnected: boolean;
  /** Soft-disconnect timer still armed for this host id. */
  hostInGrace: boolean;
  hostLastSeenAt: number;
  now: number;
  graceMs?: number;
};

/** True when the current host must stay host (do not promote anyone else). */
export function hostIsHeld(input: HostHoldInput): boolean {
  if (input.hostConnected) return true;
  if (input.hostInGrace) return true;
  const grace = input.graceMs ?? HOST_DISCONNECT_GRACE_MS;
  return input.now - input.hostLastSeenAt < grace;
}

export type HostSeat = {
  id: string;
  isHost: boolean;
  connected: boolean;
  role: "player" | "spectator" | string;
};

/**
 * Who should be host after a presence change.
 * Returns the current host id whenever they are still held.
 * Only then picks the first connected human (else first connected player).
 */
export function nextHostId(
  players: readonly HostSeat[],
  hold: Omit<HostHoldInput, "hostConnected">,
  isBotId: (id: string) => boolean,
): string | null {
  const seated = players.filter((p) => p.role === "player");
  const current = seated.find((p) => p.isHost) ?? null;
  if (
    current &&
    hostIsHeld({
      hostConnected: current.connected,
      hostInGrace: hold.hostInGrace,
      hostLastSeenAt: hold.hostLastSeenAt,
      now: hold.now,
      graceMs: hold.graceMs,
    })
  ) {
    // A connected bot host yields to a connected human; a held human/bot
    // in grace does not.
    if (current.connected && isBotId(current.id)) {
      const human = seated.find((p) => p.connected && !isBotId(p.id));
      if (human) return human.id;
    }
    return current.id;
  }

  const humans = seated.filter((p) => p.connected && !isBotId(p.id));
  const live = seated.filter((p) => p.connected);
  const pool = humans.length > 0 ? humans : live;
  return pool[0]?.id ?? current?.id ?? null;
}

/** Presence-only close/open must not bump phaseRevision (avoids UI remount). */
export function shouldBumpRevisionOnDisconnect(): boolean {
  return false;
}

/** Lobby non-hosts may leave immediately; hosts always get full grace. */
export function disconnectGraceMs(opts: {
  rosterLocked: boolean;
  isHost: boolean;
}): number {
  if (opts.isHost || opts.rosterLocked) return HOST_DISCONNECT_GRACE_MS;
  return 0;
}
