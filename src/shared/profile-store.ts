/**
 * Shared all-time profile stats shape + merge helpers.
 * Used by the client and the PartyServer ProfileHub Durable Object.
 */

export type StoredProfileStats = {
  wins: number;
  gamesPlayed: number;
  bestScore: number;
  winStreak: number;
  recordedGameIds: string[];
  /** Sum of final stone totals across recorded games. */
  totalBeans: number;
  /** Last known display name (for Safari↔PWA merge hints). */
  nickname?: string;
  /** ISO time of last server write. */
  updatedAt?: string;
  /** True when any values came from a recovered/imported source. */
  imported?: boolean;
};

export type NicknameSighting = {
  deviceId: string;
  nickname: string;
  seenAt: number;
  roomCode?: string;
  wins: number;
  gamesPlayed: number;
};

export type MergeCandidate = {
  deviceId: string;
  nickname: string;
  wins: number;
  gamesPlayed: number;
  bestScore: number;
  seenAt: number;
};

const MAX_RECORDED_IDS = 80;

export function emptyStoredProfileStats(): StoredProfileStats {
  return {
    wins: 0,
    gamesPlayed: 0,
    bestScore: 0,
    winStreak: 0,
    recordedGameIds: [],
    totalBeans: 0,
  };
}

export function normalizeNickname(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Prefer higher totals; union game ids; keep the longer streak when games match. */
export function mergeStoredProfileStats(
  a: StoredProfileStats,
  b: StoredProfileStats,
): StoredProfileStats {
  const ids = Array.from(
    new Set([...(a.recordedGameIds ?? []), ...(b.recordedGameIds ?? [])]),
  ).slice(-MAX_RECORDED_IDS);
  const gamesPlayed = Math.max(a.gamesPlayed, b.gamesPlayed, ids.length);
  const wins = Math.max(a.wins, b.wins);
  const bestScore = Math.max(a.bestScore, b.bestScore);
  const totalBeans = Math.max(a.totalBeans ?? 0, b.totalBeans ?? 0);
  const winStreak =
    a.gamesPlayed === b.gamesPlayed
      ? Math.max(a.winStreak, b.winStreak)
      : a.gamesPlayed > b.gamesPlayed
        ? a.winStreak
        : b.winStreak;
  const nickname =
    (a.updatedAt ?? "") >= (b.updatedAt ?? "")
      ? a.nickname || b.nickname
      : b.nickname || a.nickname;
  return {
    wins,
    gamesPlayed,
    bestScore,
    winStreak,
    recordedGameIds: ids,
    totalBeans,
    nickname,
    updatedAt: new Date().toISOString(),
    imported: Boolean(a.imported || b.imported),
  };
}

export function applyGameToStoredStats(
  prev: StoredProfileStats,
  input: { gameId: string; score: number; won: boolean },
): StoredProfileStats | null {
  if (prev.recordedGameIds.includes(input.gameId)) return null;
  const recordedGameIds = [...prev.recordedGameIds, input.gameId].slice(
    -MAX_RECORDED_IDS,
  );
  return {
    ...prev,
    wins: prev.wins + (input.won ? 1 : 0),
    gamesPlayed: prev.gamesPlayed + 1,
    bestScore: Math.max(prev.bestScore, input.score),
    winStreak: input.won ? prev.winStreak + 1 : 0,
    recordedGameIds,
    totalBeans: (prev.totalBeans ?? 0) + Math.max(0, input.score),
    updatedAt: new Date().toISOString(),
  };
}

export function isValidDeviceId(id: string | null | undefined): boolean {
  if (!id || typeof id !== "string") return false;
  if (id === "ssr" || id === "local") return false;
  if (id.length < 8 || id.length > 80) return false;
  return /^[A-Za-z0-9:_-]+$/.test(id);
}
