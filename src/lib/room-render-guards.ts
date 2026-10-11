import type { PublicRoomState } from "@/shared/types";

type SettingsSheetComparable = {
  open: boolean;
  nickname?: string;
  isHost?: boolean;
  partyOn?: boolean;
  currentPhase?: string | null;
  playerCount?: number;
  botCountInRoom?: number;
  drafting?: boolean;
  pickPaused?: boolean;
  hostAiJudge?: unknown;
  initialPanel?: string;
};

/**
 * Closed sheet: ignore room broadcast churn (host AI cue, counts, phase…).
 * Open sheet: compare the fields that affect the visible UI.
 */
export function settingsSheetPropsAreEqual(
  prev: SettingsSheetComparable,
  next: SettingsSheetComparable,
): boolean {
  if (prev.open !== next.open) return false;
  if (!next.open) return true;
  return (
    prev.nickname === next.nickname &&
    prev.isHost === next.isHost &&
    prev.partyOn === next.partyOn &&
    prev.currentPhase === next.currentPhase &&
    prev.playerCount === next.playerCount &&
    prev.botCountInRoom === next.botCountInRoom &&
    prev.drafting === next.drafting &&
    prev.pickPaused === next.pickPaused &&
    prev.initialPanel === next.initialPanel &&
    prev.hostAiJudge === next.hostAiJudge
  );
}

/** Compact signature of PlayerRail-relevant public state. */
export function playerRailRenderKey(
  state: PublicRoomState,
  youId: string,
): string {
  const players = state.players
    .filter((p) => p.role === "player")
    .map(
      (p) =>
        `${p.id}:${p.name}:${p.stones}:${p.avatarId ?? ""}:${p.connected ? 1 : 0}:${p.seat ?? ""}`,
    )
    .join("|");
  return [
    youId,
    state.phase,
    state.starterOffset ?? 0,
    state.draftCursor,
    state.diceTurnSeat ?? "",
    state.diceSubphase ?? "",
    state.seatOrder.join(","),
    state.draftOrder.join(","),
    (state.diceActiveIds ?? []).join(","),
    JSON.stringify(state.earnedThisRound),
    JSON.stringify(state.pots),
    JSON.stringify(state.protectedStones),
    JSON.stringify(state.wagers),
    players,
  ].join("¦");
}

export function playerRailPropsAreEqual(
  prev: { state: PublicRoomState; youId: string },
  next: { state: PublicRoomState; youId: string },
): boolean {
  if (prev.state === next.state && prev.youId === next.youId) return true;
  return (
    playerRailRenderKey(prev.state, prev.youId) ===
    playerRailRenderKey(next.state, next.youId)
  );
}
