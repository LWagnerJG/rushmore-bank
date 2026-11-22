import type { HostAiJudgeHealth } from "./types";

/**
 * Settings row labels from the server's effective AI state.
 * Missing / unavailable is never shown as “on”.
 */
export function hostAiCue(health: HostAiJudgeHealth | undefined | null) {
  if (!health) {
    return {
      status: "unknown" as const,
      label: "AI unknown",
      detail: "The room has not reported AI status",
    };
  }

  if (health.available === false) {
    return {
      status: "fallback" as const,
      label: "AI off",
      detail: "This room is not configured for AI judging — scores will be neutral",
    };
  }

  switch (health.status) {
    case "ok": {
      const bits = ["Last round scored by AI"];
      if (health.model) bits.push(health.model);
      if (health.latencyMs != null) bits.push(`${health.latencyMs}ms`);
      return { status: health.status, label: "AI on", detail: bits.join(" · ") };
    }
    case "fallback": {
      const reason = health.fallbackReason
        ? ` (${health.fallbackReason})`
        : "";
      const latency =
        health.latencyMs != null ? ` · ${health.latencyMs}ms` : "";
      return {
        status: health.status,
        label: "AI off",
        detail: `Last round used neutral awards${reason}${latency}`,
      };
    }
    case "pending":
      return {
        status: health.status,
        label: "Judging…",
        detail: "AI is scoring this round",
      };
    case "ready":
      return {
        status: health.status,
        label: "AI on",
        detail: "AI is configured and will score each round",
      };
    default:
      return {
        status: "unknown" as const,
        label: "AI unknown",
        detail: "The room has not reported AI status",
      };
  }
}
