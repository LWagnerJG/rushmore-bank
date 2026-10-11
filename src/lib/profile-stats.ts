/**
 * Device-local all-time profile stats (no accounts).
 * Keyed by stable client id; each gameId recorded once to avoid double counts
 * on reconnect / refresh during GAME_RESULTS.
 */

import { getStableClientId } from "@/lib/client-id";

export type ProfileStats = {
  wins: number;
  gamesPlayed: number;
  bestScore: number;
  /** Current consecutive wins (ties count as wins). */
  winStreak: number;
  /** Recent game ids already counted (oldest dropped when capped). */
  recordedGameIds: string[];
};

const STORAGE_PREFIX = "quarry:profile-stats:";
const MAX_RECORDED_IDS = 80;

export const PROFILE_STATS_EVENT = "beans:profile-stats";

export function emptyProfileStats(): ProfileStats {
  return {
    wins: 0,
    gamesPlayed: 0,
    bestScore: 0,
    winStreak: 0,
    recordedGameIds: [],
  };
}

export function profileStatsKey(clientId: string): string {
  return `${STORAGE_PREFIX}${clientId}`;
}

/** Idempotent identity for one finished game (rematch resets createdAt). */
export function gameResultId(code: string, createdAt: number): string {
  return `${code.toUpperCase()}:${createdAt}`;
}

export function winRatePct(stats: ProfileStats): number {
  if (stats.gamesPlayed <= 0) return 0;
  return Math.round((stats.wins / stats.gamesPlayed) * 100);
}

function parseStats(raw: string | null): ProfileStats {
  if (!raw) return emptyProfileStats();
  try {
    const parsed = JSON.parse(raw) as Partial<ProfileStats>;
    return {
      wins: Math.max(0, Number(parsed.wins) || 0),
      gamesPlayed: Math.max(0, Number(parsed.gamesPlayed) || 0),
      bestScore: Math.max(0, Number(parsed.bestScore) || 0),
      winStreak: Math.max(0, Number(parsed.winStreak) || 0),
      recordedGameIds: Array.isArray(parsed.recordedGameIds)
        ? parsed.recordedGameIds.filter((x): x is string => typeof x === "string")
        : [],
    };
  } catch {
    return emptyProfileStats();
  }
}

export function loadProfileStats(clientId = getStableClientId()): ProfileStats {
  if (typeof window === "undefined") return emptyProfileStats();
  try {
    return parseStats(window.localStorage.getItem(profileStatsKey(clientId)));
  } catch {
    return emptyProfileStats();
  }
}

function saveProfileStats(clientId: string, stats: ProfileStats) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(profileStatsKey(clientId), JSON.stringify(stats));
    window.dispatchEvent(
      new CustomEvent(PROFILE_STATS_EVENT, { detail: { clientId, stats } }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export type RecordGameResultInput = {
  clientId?: string;
  gameId: string;
  /** Final bean total for this player. */
  score: number;
  /** True when tied for first (or sole winner). */
  won: boolean;
};

/**
 * Apply one GAME_RESULTS outcome. Returns null when this gameId was already
 * recorded (reconnect / refresh safety).
 */
export function recordGameResult(
  input: RecordGameResultInput,
): ProfileStats | null {
  const clientId = input.clientId ?? getStableClientId();
  const gameId = input.gameId.trim();
  if (!gameId) return null;

  const prev = loadProfileStats(clientId);
  if (prev.recordedGameIds.includes(gameId)) return null;

  const next: ProfileStats = {
    wins: prev.wins + (input.won ? 1 : 0),
    gamesPlayed: prev.gamesPlayed + 1,
    bestScore: Math.max(prev.bestScore, Math.max(0, Math.floor(input.score))),
    winStreak: input.won ? prev.winStreak + 1 : 0,
    recordedGameIds: [...prev.recordedGameIds, gameId].slice(-MAX_RECORDED_IDS),
  };
  saveProfileStats(clientId, next);
  return next;
}

/** Whether this player is a winner (ties share the win). */
export function isGameWinner(
  players: ReadonlyArray<{ id: string; role?: string; stones: number }>,
  youId: string,
): boolean {
  const seated = players.filter((p) => (p.role ?? "player") === "player");
  const me = seated.find((p) => p.id === youId);
  if (!me) return false;
  const top = Math.max(0, ...seated.map((p) => p.stones));
  return me.stones === top;
}

export function subscribeProfileStats(
  cb: (stats: ProfileStats) => void,
  clientId = getStableClientId(),
): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent).detail as
      | { clientId?: string; stats?: ProfileStats }
      | undefined;
    if (detail?.clientId && detail.clientId !== clientId) return;
    cb(detail?.stats ?? loadProfileStats(clientId));
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === profileStatsKey(clientId)) {
      cb(loadProfileStats(clientId));
    }
  };
  window.addEventListener(PROFILE_STATS_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PROFILE_STATS_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
