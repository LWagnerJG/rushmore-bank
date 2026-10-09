import type { Phase } from "@/shared/types";

/** How long the full-screen cue stays visible (ms), including fade. */
export const FINAL_ROUND_CUE_MS = 1600;

/**
 * True when the room is about to play (or is on) the last topic round's
 * selection screen — the beat where a short "Final round!" cue belongs.
 */
export function isFinalTopicRound(input: {
  topicRound: number;
  configuredTopicRounds: number;
}): boolean {
  const { topicRound, configuredTopicRounds } = input;
  if (configuredTopicRounds < 2) return false;
  return topicRound === configuredTopicRounds - 1 && topicRound >= 1;
}

/**
 * Fire the cue once when we enter TOPIC_SELECTION for the final round.
 * Ignores other phases so draft/results labels stay quiet.
 */
export function shouldFireFinalRoundCue(input: {
  phase: Phase | null | undefined;
  topicRound: number;
  configuredTopicRounds: number;
  /** Prior phase from the previous render (null on first paint). */
  prevPhase: Phase | null | undefined;
}): boolean {
  if (input.phase !== "TOPIC_SELECTION") return false;
  if (!isFinalTopicRound(input)) return false;
  // First paint already on final topic (reconnect / remount) — still show once.
  if (input.prevPhase == null) return true;
  // Re-entering from results / prior round.
  return input.prevPhase !== "TOPIC_SELECTION";
}
