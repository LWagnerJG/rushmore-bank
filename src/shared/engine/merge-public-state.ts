import type { PublicRoomState } from "../types";

/**
 * Merge a server public snapshot onto the previous client snapshot.
 * During DICE the server omits heavy draft/judge fields (empty arrays /
 * objects) so WS payloads stay small — restore them from `prev`.
 */
export function mergePublicState(
  prev: PublicRoomState | null,
  next: PublicRoomState,
): PublicRoomState {
  if (!prev) return next;
  if (next.phase !== "DICE") return next;
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
