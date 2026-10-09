import type { HostAiJudgeHealth } from "./types";

/** Missing server data is unknown, never proof that AI is available. */
export function hostAiCue(health: HostAiJudgeHealth | undefined | null) {
  if (!health) {
    return {
      status: "unknown" as const,
      label: "AI unknown",
      detail: "The room has not reported AI status",
    };
  }

  switch (health.status) {
    case "ok": {
      const bits = ["Last round scored by AI"];
      if (health.model) bits.push(health.model);
      if (health.latencyMs != null) bits.push(`${health.latencyMs}ms`);
      return { status: health.status, label: "AI ok", detail: bits.join(" · ") };
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
        label: "AI waiting",
        detail: "AI has not scored a round yet",
      };
    default:
      return {
        status: "unknown" as const,
        label: "AI unknown",
        detail: "The room has not reported AI status",
      };
  }
}
