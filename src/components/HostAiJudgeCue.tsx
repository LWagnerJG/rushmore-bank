import type { HostAiJudgeHealth } from "@/shared/types";
import { hostAiCue } from "@/shared/host-ai-cue";

/**
 * Host-only AI judge health row for Settings.
 * Header chrome chip was removed — pre-game status uses HostAiPreGameStatus.
 * fallbackReason / model / latency stay in detail for host debug.
 */
export function HostAiJudgeCue({
  health,
}: {
  /** Missing status stays unknown until the server reports it. */
  health: HostAiJudgeHealth | undefined | null;
}) {
  const { status, label, detail } = hostAiCue(health);

  return (
    <div className="settings-row host-ai-row" role="status" aria-label={detail}>
      <span className="settings-row-label">
        <span className="font-extrabold">AI judge</span>
        <span className="text-xs text-[var(--muted)]">{detail}</span>
      </span>
      <span className={`host-ai-chip host-ai-chip-${status}`}>{label}</span>
    </div>
  );
}
