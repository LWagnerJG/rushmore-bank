import type { HostAiJudgeHealth } from "@/shared/types";
import { hostAiCue } from "@/shared/host-ai-cue";

/**
 * Host-only discreet AI judge health cue.
 * Wired to PartyKit `hostAiJudge` (last real judge job + pending + ready).
 * Always renders for hosts — never blank before round 1.
 */
export function HostAiJudgeCue({
  health,
  variant = "chip",
}: {
  /** Missing status stays unknown until the server reports it. */
  health: HostAiJudgeHealth | undefined | null;
  /** chip = settings row; chrome = compact text next to Beans logo */
  variant?: "chip" | "chrome";
}) {
  const { status, label, detail } = hostAiCue(health);

  if (variant === "chrome") {
    return (
      <span
        className={`host-ai-chrome host-ai-chrome-${status}`}
        title={detail}
        aria-label={detail}
        role="status"
      >
        {label}
      </span>
    );
  }

  return (
    <div className="settings-row host-ai-row" role="status" aria-label={detail}>
      <span className="settings-row-label">
        <span className="font-extrabold">AI judge</span>
        <span className="text-xs text-[var(--muted)]">
          {detail}
        </span>
      </span>
      <span className={`host-ai-chip host-ai-chip-${status}`}>{label}</span>
    </div>
  );
}
