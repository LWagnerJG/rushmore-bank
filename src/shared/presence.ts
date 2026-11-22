import type { Player, PlayerPresence } from "./types";
import { RULES } from "./rules";

/** Same window as mid-game auto-miss — host Skip stays hidden until it ends. */
export const HOST_SKIP_GRACE_MS = RULES.disconnectActionGraceMs;

/** Derive presence for a public player projection. */
export function presenceFor(
  connected: boolean,
  inGrace: boolean,
): PlayerPresence {
  if (connected) return "live";
  if (inGrace) return "reconnecting";
  return "away";
}

/**
 * Host may offer “Skip this turn” only after soft-disconnect grace.
 * Uses server `disconnectedAt` when present so a host reload mid-grace
 * does not flash Skip early.
 */
export function hostSkipReady(
  player: Pick<Player, "connected" | "presence" | "disconnectedAt">,
  now = Date.now(),
): boolean {
  if (player.connected) return false;
  if (player.disconnectedAt != null) {
    return now - player.disconnectedAt >= HOST_SKIP_GRACE_MS;
  }
  // Older snapshots without disconnectedAt: trust projected presence.
  return player.presence === "away";
}

/** Short status chip copy — null when the seat is live. */
export function presenceCue(player: Pick<Player, "connected" | "presence">): {
  label: string;
  kind: "reconnecting" | "away";
} | null {
  if (player.connected) return null;
  if (player.presence === "reconnecting") {
    return { label: "reconnecting…", kind: "reconnecting" };
  }
  // Away: no “skipped” text (mixed with host Skip). Subtle dot only.
  return { label: "", kind: "away" };
}
