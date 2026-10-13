import type { PublicRoomState } from "../types";
import { phaseOmitsDraftJudgePayload } from "./public-state";

/**
 * Merge a server public snapshot onto the previous client snapshot.
 * Late-round phases omit heavy draft/judge fields (empty arrays / objects)
 * so WS payloads stay small — restore them from `prev`.
 */
/** Rematch rebuilds the room as LOBBY; never treat that as a stale replay. */
export function isRematchLobbyReset(
  prevPhase: string | null | undefined,
  nextPhase: string | null | undefined,
): boolean {
  return nextPhase === "LOBBY" && prevPhase === "GAME_RESULTS";
}

export function mergePublicState(
  prev: PublicRoomState | null,
  next: PublicRoomState,
): PublicRoomState {
  if (!prev) return next;
  const prevV = prev.stateVersion ?? 0;
  const nextV = next.stateVersion ?? 0;
  const rematchReset = isRematchLobbyReset(prev.phase, next.phase);
  if (!rematchReset && nextV > 0 && prevV > 0 && nextV < prevV) return prev;
  if (!phaseOmitsDraftJudgePayload(next.phase)) return next;
  // Only merge when we already had a richer snapshot from this room.
  if (prev.code !== next.code) return next;

  return {
    ...next,
    picks: next.picks.length > 0 ? next.picks : prev.picks,
    takenNormalized:
      next.takenNormalized.length > 0
        ? next.takenNormalized
        : prev.takenNormalized,
    topicOptions:
      next.topicOptions.length > 0 ? next.topicOptions : prev.topicOptions,
    topicVoteCounts:
      Object.keys(next.topicVoteCounts).length > 0
        ? next.topicVoteCounts
        : prev.topicVoteCounts,
    scores: next.scores.length > 0 ? next.scores : prev.scores,
    rushmoreWhy:
      Object.keys(next.rushmoreWhy).length > 0
        ? next.rushmoreWhy
        : prev.rushmoreWhy,
    humanVotedIds:
      next.humanVotedIds.length > 0 ? next.humanVotedIds : prev.humanVotedIds,
    bankBeansReadyIds:
      next.bankBeansReadyIds.length > 0
        ? next.bankBeansReadyIds
        : prev.bankBeansReadyIds,
    selectedTopic: next.selectedTopic ?? prev.selectedTopic,
  };
}
