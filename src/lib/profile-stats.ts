/**
 * All-time profile stats (no accounts).
 * Local cache in localStorage; durable copy on PartyServer ProfileHub.
 * Keyed by stable client id; each gameId recorded once to avoid double counts.
 */

import { getStableClientId } from "@/lib/client-id";
import { getPartyHost } from "@/lib/party";
import {
  emptyStoredProfileStats,
  mergeStoredProfileStats,
  type MergeCandidate,
  type StoredProfileStats,
} from "@/shared/profile-store";

export type ProfileStats = {
  wins: number;
  gamesPlayed: number;
  bestScore: number;
  /** Current consecutive wins (ties count as wins). */
  winStreak: number;
  /** Recent game ids already counted (oldest dropped when capped). */
  recordedGameIds: string[];
  /** Sum of final stone totals across recorded games. */
  totalBeans: number;
  imported?: boolean;
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
    totalBeans: 0,
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

function toStored(stats: ProfileStats, nickname?: string): StoredProfileStats {
  return {
    ...emptyStoredProfileStats(),
    ...stats,
    nickname,
  };
}

function fromStored(stats: StoredProfileStats): ProfileStats {
  return {
    wins: Math.max(0, Number(stats.wins) || 0),
    gamesPlayed: Math.max(0, Number(stats.gamesPlayed) || 0),
    bestScore: Math.max(0, Number(stats.bestScore) || 0),
    winStreak: Math.max(0, Number(stats.winStreak) || 0),
    recordedGameIds: Array.isArray(stats.recordedGameIds)
      ? stats.recordedGameIds.filter((x): x is string => typeof x === "string")
      : [],
    totalBeans: Math.max(0, Number(stats.totalBeans) || 0),
    imported: Boolean(stats.imported),
  };
}

function parseStats(raw: string | null): ProfileStats {
  if (!raw) return emptyProfileStats();
  try {
    const parsed = JSON.parse(raw) as Partial<ProfileStats>;
    return fromStored({
      ...emptyStoredProfileStats(),
      ...parsed,
    });
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

export function saveProfileStats(clientId: string, stats: ProfileStats) {
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

function profilesUrl(path = ""): string {
  const host = getPartyHost();
  const scheme =
    host.startsWith("127.0.0.1") || host.startsWith("localhost")
      ? "http"
      : "https";
  return `${scheme}://${host}/profiles${path}`;
}

export type RecordGameResultInput = {
  clientId?: string;
  gameId: string;
  /** Final bean total for this player. */
  score: number;
  /** True when tied for first (or sole winner). */
  won: boolean;
  nickname?: string;
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

  const score = Math.max(0, Math.floor(input.score));
  const next: ProfileStats = {
    wins: prev.wins + (input.won ? 1 : 0),
    gamesPlayed: prev.gamesPlayed + 1,
    bestScore: Math.max(prev.bestScore, score),
    winStreak: input.won ? prev.winStreak + 1 : 0,
    recordedGameIds: [...prev.recordedGameIds, gameId].slice(-MAX_RECORDED_IDS),
    totalBeans: (prev.totalBeans ?? 0) + score,
    imported: prev.imported,
  };
  saveProfileStats(clientId, next);
  void pushProfileStatsToServer(clientId, next, input.nickname);
  return next;
}

/** Pull server copy and merge into local cache. */
export async function pullProfileStatsFromServer(
  clientId = getStableClientId(),
  nickname?: string,
): Promise<ProfileStats> {
  const local = loadProfileStats(clientId);
  try {
    const res = await fetch(
      `${profilesUrl()}?deviceId=${encodeURIComponent(clientId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return local;
    const data = (await res.json()) as { stats?: StoredProfileStats };
    if (!data.stats) return local;
    const merged = fromStored(
      mergeStoredProfileStats(toStored(local, nickname), data.stats),
    );
    saveProfileStats(clientId, merged);
    if (
      merged.gamesPlayed !== data.stats.gamesPlayed ||
      merged.wins !== data.stats.wins
    ) {
      void pushProfileStatsToServer(clientId, merged, nickname);
    }
    return merged;
  } catch {
    return local;
  }
}

export async function pushProfileStatsToServer(
  clientId: string,
  stats: ProfileStats,
  nickname?: string,
): Promise<void> {
  try {
    await fetch(profilesUrl(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: clientId,
        stats: toStored(stats, nickname),
        nickname,
      }),
    });
  } catch {
    /* offline — local cache remains source of truth until next sync */
  }
}

export async function sightProfileNickname(input: {
  deviceId: string;
  nickname: string;
  roomCode?: string;
}): Promise<void> {
  try {
    await fetch(profilesUrl("/sight"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    /* ignore */
  }
}

export async function fetchMergeCandidates(input: {
  deviceId: string;
  nickname: string;
}): Promise<MergeCandidate[]> {
  try {
    const url = `${profilesUrl("/match")}?deviceId=${encodeURIComponent(input.deviceId)}&nickname=${encodeURIComponent(input.nickname)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { candidates?: MergeCandidate[] };
    return data.candidates ?? [];
  } catch {
    return [];
  }
}

export async function acceptMergeCandidate(input: {
  fromDeviceId: string;
  toDeviceId: string;
}): Promise<ProfileStats | null> {
  try {
    const res = await fetch(profilesUrl("/merge"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stats?: StoredProfileStats };
    if (!data.stats) return null;
    const stats = fromStored(data.stats);
    saveProfileStats(input.toDeviceId, stats);
    return stats;
  } catch {
    return null;
  }
}

export type AdminProfileRow = {
  deviceId: string;
  nickname?: string;
  wins: number;
  gamesPlayed: number;
  bestScore: number;
  updatedAt?: string;
};

export async function fetchAdminProfileSummary(): Promise<{
  profileCount: number;
  top: AdminProfileRow[];
} | null> {
  try {
    const res = await fetch(profilesUrl("/admin"), { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as {
      profileCount: number;
      top: AdminProfileRow[];
    };
  } catch {
    return null;
  }
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
