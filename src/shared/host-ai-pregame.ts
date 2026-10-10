/** Copy for the host-only pre-game AI judge line (lobby / first topic). */

export type JudgeHealthProbe = {
  available: boolean;
  model: string | null;
};

/**
 * Super-discreet host-only status. Never includes fallbackReason.
 * Returns null while probing so the lobby stays quiet during the check.
 */
export function hostAiPreGameLine(
  probe: JudgeHealthProbe | null | undefined,
): string | null {
  if (!probe) return null;
  if (!probe.available) return "AI judge off, scores will be neutral";
  if (probe.model?.trim()) return `AI judge on · ${probe.model.trim()}`;
  return "AI judge on";
}
