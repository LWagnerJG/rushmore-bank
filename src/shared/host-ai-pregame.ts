/** Copy for the host-only pre-game AI judge line (lobby / first topic). */

import type { HostAiJudgeHealth } from "./types";

/**
 * Effective AI status from the PartyServer projection — never a client
 * /api/judge probe (that can say “on” while the room falls back to neutral).
 * Returns null while the room has not projected host health yet.
 */
export function hostAiPreGameLine(
  health: HostAiJudgeHealth | null | undefined,
): string | null {
  if (!health) return null;

  if (health.available === false) {
    return "AI judge off, scores will be neutral";
  }

  switch (health.status) {
    case "fallback":
      return "AI judge off, scores will be neutral";
    case "ok": {
      if (health.model?.trim()) return `AI judge on · ${health.model.trim()}`;
      return "AI judge on";
    }
    case "pending":
      return "AI judging…";
    case "ready":
    default: {
      if (health.model?.trim()) return `AI judge on · ${health.model.trim()}`;
      return "AI judge on";
    }
  }
}
