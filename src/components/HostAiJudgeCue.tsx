import type { HostAiJudgeHealth } from "@/shared/types";

/**
 * Host-only discreet AI judge health cue.
 * Wired to PartyKit `hostAiJudge` (last real judge job + pending).
 */
export function HostAiJudgeCue({
  health,
  variant = "chip",
}: {
  health: HostAiJudgeHealth | undefined;
  /** chip = settings row; dot = chrome accent */
  variant?: "chip" | "dot";
}) {
  if (health == null) return null;

  const label =
    health === "ok"
      ? "AI ok"
      : health === "fallback"
        ? "AI off"
        : "AI…";
  const title =
    health === "ok"
      ? "AI judging worked on the last round"
      : health === "fallback"
        ? "AI judging unavailable — using neutral awards"
        : "AI judging in progress";

  if (variant === "dot") {
    return (
      <span
        className={`host-ai-dot host-ai-dot-${health}`}
        title={title}
        aria-label={title}
        role="status"
      />
    );
  }

  return (
    <div className="settings-row host-ai-row" role="status" aria-label={title}>
      <span className="settings-row-label">
        <span className="font-extrabold">AI judge</span>
        <span className="text-xs text-[var(--muted)]">
          {health === "ok"
            ? "Last round scored by AI"
            : health === "fallback"
              ? "Falling back to neutral awards"
              : "Checking this round…"}
        </span>
      </span>
      <span className={`host-ai-chip host-ai-chip-${health}`}>{label}</span>
    </div>
  );
}
