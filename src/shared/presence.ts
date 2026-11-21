import type { Player, PlayerPresence } from "./types";

/** Derive presence for a public player projection. */
export function presenceFor(
  connected: boolean,
  inGrace: boolean,
): PlayerPresence {
  if (connected) return "live";
  if (inGrace) return "reconnecting";
  return "away";
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
  // Missing presence on older fixtures → treat as already skipped.
  return { label: "skipped", kind: "away" };
}
