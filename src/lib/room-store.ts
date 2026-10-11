"use client";

import type { PublicRoomState } from "@/shared/types";

/**
 * External room snapshot so chrome can subscribe without prop-drilling the
 * full public state. Pair with React.memo guards on SettingsSheet / PlayerRail.
 */
export type RoomSnapshot = {
  state: PublicRoomState | null;
  youId: string;
};

const empty: RoomSnapshot = { state: null, youId: "" };

let snapshot: RoomSnapshot = empty;
const listeners = new Set<() => void>();

export function getRoomSnapshot(): RoomSnapshot {
  return snapshot;
}

export function subscribeRoom(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called from useGameRoom whenever the applied public state changes. */
export function publishRoomSnapshot(next: RoomSnapshot): void {
  if (snapshot.state === next.state && snapshot.youId === next.youId) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

export function resetRoomSnapshotForTests(): void {
  snapshot = empty;
  listeners.clear();
}
