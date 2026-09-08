import { RULES } from "../rules";
import type { DraftPick } from "../types";

/** Count roster slots for one player. */
export function playerPickCount(
  picks: DraftPick[],
  playerId: string,
): number {
  return picks.filter((p) => p.playerId === playerId).length;
}

/** True when the player already holds a full Mount Rushmore (4). */
export function rosterFull(picks: DraftPick[], playerId: string): boolean {
  return playerPickCount(picks, playerId) >= RULES.picksPerPlayer;
}

/**
 * Upsert a pick by turnIndex (replace if that turn already has a row).
 * Never allows a player to exceed RULES.picksPerPlayer.
 */
export function upsertDraftPick(
  picks: DraftPick[],
  next: DraftPick,
): DraftPick[] {
  const withoutTurn = picks.filter((p) => p.turnIndex !== next.turnIndex);
  const replacingOwn = picks.some(
    (p) => p.turnIndex === next.turnIndex && p.playerId === next.playerId,
  );
  if (!replacingOwn && rosterFull(withoutTurn, next.playerId)) {
    throw new Error("Roster full");
  }
  const cappedIndex = Math.max(
    0,
    Math.min(next.pickIndex, RULES.picksPerPlayer - 1),
  );
  return [
    ...withoutTurn,
    {
      ...next,
      pickIndex: cappedIndex,
      text: next.text.trim().slice(0, 48),
    },
  ];
}

/** Rebuild takenNormalized from current picks. */
export function takenFromPicks(
  picks: DraftPick[],
  normalize: (text: string) => string,
): string[] {
  return picks.map((p) => normalize(p.text));
}

/** Defensive: keep at most 4 picks per player (stable by pickIndex then turn). */
export function clampRostersToCap(picks: DraftPick[]): DraftPick[] {
  const byPlayer = new Map<string, DraftPick[]>();
  for (const p of picks) {
    const list = byPlayer.get(p.playerId) ?? [];
    list.push(p);
    byPlayer.set(p.playerId, list);
  }
  const out: DraftPick[] = [];
  for (const list of byPlayer.values()) {
    list
      .slice()
      .sort(
        (a, b) => a.pickIndex - b.pickIndex || a.turnIndex - b.turnIndex,
      )
      .slice(0, RULES.picksPerPlayer)
      .forEach((p) => out.push(p));
  }
  return out.sort((a, b) => a.turnIndex - b.turnIndex);
}
