"use client";

import { createContext, useContext } from "react";
import type { ClientMessage } from "@/shared/types";

/**
 * Stable room actions — split from state so chrome/sheets don't need the
 * full public snapshot to call send/rename.
 */
export type RoomActions = {
  send: (msg: ClientMessage) => void;
  rename: (name: string) => void;
};

const RoomActionsContext = createContext<RoomActions | null>(null);

export function RoomActionsProvider({
  value,
  children,
}: {
  value: RoomActions;
  children: React.ReactNode;
}) {
  return (
    <RoomActionsContext.Provider value={value}>
      {children}
    </RoomActionsContext.Provider>
  );
}

export function useRoomActions(): RoomActions {
  const ctx = useContext(RoomActionsContext);
  if (!ctx) {
    throw new Error("useRoomActions requires RoomActionsProvider");
  }
  return ctx;
}
