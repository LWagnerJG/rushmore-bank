import type { HostAiJudgeHealth } from "./types";

/** Missing server data is unknown, never proof that AI is available. */
export function hostAiCue(health: HostAiJudgeHealth | undefined | null) {
  switch (health) {
    case "ok":
      return { status: health, label: "AI ok", detail: "Last round scored by AI" };
    case "fallback":
      return { status: health, label: "AI off", detail: "Last round used neutral awards" };
    case "pending":
      return { status: health, label: "Judging…", detail: "AI is scoring this round" };
    case "ready":
      return { status: health, label: "AI waiting", detail: "AI has not scored a round yet" };
    default:
      return { status: "unknown", label: "AI unknown", detail: "The room has not reported AI status" };
  }
}
