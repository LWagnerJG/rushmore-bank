"use client";

import type { HostAiJudgeHealth } from "@/shared/types";
import { hostAiPreGameLine } from "@/shared/host-ai-pregame";

/**
 * Host-only muted AI availability line for pre-game (lobby / first topic).
 * Uses the PartyServer-projected hostAiJudge (effective state) — never a
 * client GET /api/judge probe that can disagree with real scoring.
 */
export function HostAiPreGameStatus({
  health,
}: {
  health: HostAiJudgeHealth | undefined | null;
}) {
  const line = hostAiPreGameLine(health);
  if (!line) return null;

  return (
    <p className="host-ai-pregame" role="status">
      {line}
    </p>
  );
}
