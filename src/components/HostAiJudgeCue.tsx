import type { HostAiJudgeHealth } from "@/shared/types";

/**
 * Host-only discreet AI judge health cue.
 * Wired to PartyKit `hostAiJudge` (last real judge job + pending + ready).
 * Always renders for hosts — never blank before round 1.
 */
export function HostAiJudgeCue({
  health,
  variant = "chip",
}: {
  /** Concrete host cue; treat missing as ready so chrome never goes blank. */
  health: HostAiJudgeHealth | undefined | null;
  /** chip = settings row; chrome = compact text next to Beans logo */
  variant?: "chip" | "chrome";
}) {
  const status: HostAiJudgeHealth = health ?? "ready";

  const label =
    status === "ok"
      ? "AI ok"
      : status === "fallback"
        ? "AI off"
        : status === "pending"
          ? "AI…"
          : "AI ready";
  const title =
    status === "ok"
      ? "AI judging worked on the last round"
      : status === "fallback"
        ? "AI judging unavailable — using neutral awards"
        : status === "pending"
          ? "AI judging in progress"
          : "AI judge ready";

  if (variant === "chrome") {
    return (
      <span
        className={`host-ai-chrome host-ai-chrome-${status}`}
        title={title}
        aria-label={title}
        role="status"
      >
        {label}
      </span>
    );
  }

  return (
    <div className="settings-row host-ai-row" role="status" aria-label={title}>
      <span className="settings-row-label">
        <span className="font-extrabold">AI judge</span>
        <span className="text-xs text-[var(--muted)]">
          {status === "ok"
            ? "Last round scored by AI"
            : status === "fallback"
              ? "Falling back to neutral awards"
              : status === "pending"
                ? "Checking this round…"
                : "Ready before the first round"}
        </span>
      </span>
      <span className={`host-ai-chip host-ai-chip-${status}`}>{label}</span>
    </div>
  );
}
