/**
 * Durable Object: all-time profile stats keyed by stable device id.
 * Also tracks recent nickname sightings for opt-in Safari↔PWA merge.
 */
import {
  applyGameToStoredStats,
  emptyStoredProfileStats,
  isValidDeviceId,
  mergeStoredProfileStats,
  normalizeNickname,
  type MergeCandidate,
  type NicknameSighting,
  type StoredProfileStats,
} from "../src/shared/profile-store";

const STATS_PREFIX = "stats:";
const NICK_PREFIX = "nick:";
const DEVICE_INDEX_KEY = "index:devices";
const SIGHTING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SIGHTINGS_PER_NICK = 8;
const MAX_DEVICE_INDEX = 500;

function corsHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(),
  });
}

export class ProfileHub {
  constructor(private readonly ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/profiles\/?/, "").replace(/\/$/, "");

    try {
      if (request.method === "GET" && (path === "" || path === "get")) {
        return await this.getStats(url);
      }
      if (request.method === "PUT" && (path === "" || path === "put")) {
        return await this.putStats(request);
      }
      if (request.method === "POST" && path === "record") {
        return await this.recordGame(request);
      }
      if (request.method === "GET" && path === "match") {
        return await this.matchNickname(url);
      }
      if (request.method === "POST" && path === "sight") {
        return await this.recordSighting(request);
      }
      if (request.method === "POST" && path === "merge") {
        return await this.mergeDevices(request);
      }
      if (request.method === "GET" && path === "admin") {
        return await this.adminSummary();
      }
      return json({ error: "Not found" }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : "error";
      return json({ error: message }, 400);
    }
  }

  private statsKey(deviceId: string) {
    return `${STATS_PREFIX}${deviceId}`;
  }

  private nickKey(nickname: string) {
    return `${NICK_PREFIX}${normalizeNickname(nickname)}`;
  }

  private async readStats(deviceId: string): Promise<StoredProfileStats> {
    const raw = await this.ctx.storage.get<StoredProfileStats>(
      this.statsKey(deviceId),
    );
    return raw ? { ...emptyStoredProfileStats(), ...raw } : emptyStoredProfileStats();
  }

  private async writeStats(deviceId: string, stats: StoredProfileStats) {
    const next = {
      ...stats,
      updatedAt: new Date().toISOString(),
    };
    await this.ctx.storage.put(this.statsKey(deviceId), next);
    await this.rememberDevice(deviceId);
    if (next.nickname) {
      await this.touchSighting({
        deviceId,
        nickname: next.nickname,
        wins: next.wins,
        gamesPlayed: next.gamesPlayed,
      });
    }
    return next;
  }

  private async rememberDevice(deviceId: string) {
    const prev =
      (await this.ctx.storage.get<string[]>(DEVICE_INDEX_KEY)) ?? [];
    if (prev.includes(deviceId)) return;
    const next = [deviceId, ...prev].slice(0, MAX_DEVICE_INDEX);
    await this.ctx.storage.put(DEVICE_INDEX_KEY, next);
  }

  private async touchSighting(input: {
    deviceId: string;
    nickname: string;
    wins: number;
    gamesPlayed: number;
    roomCode?: string;
  }) {
    const nick = input.nickname.trim();
    if (!nick || !isValidDeviceId(input.deviceId)) return;
    const key = this.nickKey(nick);
    const prev =
      (await this.ctx.storage.get<NicknameSighting[]>(key)) ?? [];
    const now = Date.now();
    const filtered = prev.filter(
      (s) =>
        now - s.seenAt < SIGHTING_TTL_MS && s.deviceId !== input.deviceId,
    );
    const next: NicknameSighting[] = [
      {
        deviceId: input.deviceId,
        nickname: nick,
        seenAt: now,
        roomCode: input.roomCode,
        wins: input.wins,
        gamesPlayed: input.gamesPlayed,
      },
      ...filtered,
    ].slice(0, MAX_SIGHTINGS_PER_NICK);
    await this.ctx.storage.put(key, next);
  }

  private async getStats(url: URL): Promise<Response> {
    const deviceId = url.searchParams.get("deviceId") ?? "";
    if (!isValidDeviceId(deviceId)) {
      return json({ error: "invalid deviceId" }, 400);
    }
    const stats = await this.readStats(deviceId);
    return json({ deviceId, stats });
  }

  private async putStats(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      deviceId?: string;
      stats?: StoredProfileStats;
      nickname?: string;
    };
    if (!isValidDeviceId(body.deviceId)) {
      return json({ error: "invalid deviceId" }, 400);
    }
    const incoming = {
      ...emptyStoredProfileStats(),
      ...(body.stats ?? {}),
      nickname: body.nickname?.trim() || body.stats?.nickname,
    };
    const prev = await this.readStats(body.deviceId!);
    const merged = mergeStoredProfileStats(prev, incoming);
    const saved = await this.writeStats(body.deviceId!, merged);
    return json({ deviceId: body.deviceId, stats: saved });
  }

  private async recordGame(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      deviceId?: string;
      gameId?: string;
      score?: number;
      won?: boolean;
      nickname?: string;
    };
    if (!isValidDeviceId(body.deviceId) || !body.gameId) {
      return json({ error: "invalid payload" }, 400);
    }
    const prev = await this.readStats(body.deviceId!);
    if (body.nickname?.trim()) prev.nickname = body.nickname.trim();
    const next = applyGameToStoredStats(prev, {
      gameId: body.gameId,
      score: Number(body.score) || 0,
      won: Boolean(body.won),
    });
    if (!next) {
      return json({ deviceId: body.deviceId, stats: prev, deduped: true });
    }
    const saved = await this.writeStats(body.deviceId!, next);
    return json({ deviceId: body.deviceId, stats: saved, deduped: false });
  }

  private async matchNickname(url: URL): Promise<Response> {
    const deviceId = url.searchParams.get("deviceId") ?? "";
    const nickname = url.searchParams.get("nickname") ?? "";
    if (!isValidDeviceId(deviceId) || !nickname.trim()) {
      return json({ candidates: [] as MergeCandidate[] });
    }
    const mine = await this.readStats(deviceId);
    // Only offer merge when this device looks new (no games yet).
    if (mine.gamesPlayed > 0) {
      return json({ candidates: [] as MergeCandidate[] });
    }
    const sightings =
      (await this.ctx.storage.get<NicknameSighting[]>(
        this.nickKey(nickname),
      )) ?? [];
    const now = Date.now();
    const candidates: MergeCandidate[] = [];
    for (const s of sightings) {
      if (s.deviceId === deviceId) continue;
      if (now - s.seenAt > SIGHTING_TTL_MS) continue;
      if (s.gamesPlayed <= 0 && s.wins <= 0) continue;
      const stats = await this.readStats(s.deviceId);
      if (stats.gamesPlayed <= 0) continue;
      candidates.push({
        deviceId: s.deviceId,
        nickname: s.nickname,
        wins: stats.wins,
        gamesPlayed: stats.gamesPlayed,
        bestScore: stats.bestScore,
        seenAt: s.seenAt,
      });
    }
    candidates.sort((a, b) => b.seenAt - a.seenAt);
    return json({ candidates: candidates.slice(0, 3) });
  }

  private async recordSighting(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      deviceId?: string;
      nickname?: string;
      roomCode?: string;
    };
    if (!isValidDeviceId(body.deviceId) || !body.nickname?.trim()) {
      return json({ error: "invalid payload" }, 400);
    }
    const stats = await this.readStats(body.deviceId!);
    stats.nickname = body.nickname.trim();
    await this.writeStats(body.deviceId!, stats);
    await this.touchSighting({
      deviceId: body.deviceId!,
      nickname: body.nickname,
      wins: stats.wins,
      gamesPlayed: stats.gamesPlayed,
      roomCode: body.roomCode,
    });
    return json({ ok: true });
  }

  private async mergeDevices(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      fromDeviceId?: string;
      toDeviceId?: string;
    };
    if (
      !isValidDeviceId(body.fromDeviceId) ||
      !isValidDeviceId(body.toDeviceId) ||
      body.fromDeviceId === body.toDeviceId
    ) {
      return json({ error: "invalid payload" }, 400);
    }
    const from = await this.readStats(body.fromDeviceId!);
    const to = await this.readStats(body.toDeviceId!);
    const merged = mergeStoredProfileStats(from, to);
    const saved = await this.writeStats(body.toDeviceId!, merged);
    // Leave the source intact so a mistaken merge can still be read; the
    // accepting device now has the union.
    return json({
      deviceId: body.toDeviceId,
      stats: saved,
      fromDeviceId: body.fromDeviceId,
    });
  }

  private async adminSummary(): Promise<Response> {
    // Avoid storage.list() — not present on the typed DurableObjectStorage in
    // this repo's workers-types. Track device ids explicitly instead.
    const deviceIds =
      (await this.ctx.storage.get<string[]>(DEVICE_INDEX_KEY)) ?? [];
    const profiles: Array<{
      deviceId: string;
      nickname?: string;
      wins: number;
      gamesPlayed: number;
      bestScore: number;
      updatedAt?: string;
    }> = [];
    for (const deviceId of deviceIds.slice(0, 200)) {
      const stats = await this.readStats(deviceId);
      if (stats.gamesPlayed <= 0) continue;
      profiles.push({
        deviceId,
        nickname: stats.nickname,
        wins: stats.wins,
        gamesPlayed: stats.gamesPlayed,
        bestScore: stats.bestScore,
        updatedAt: stats.updatedAt,
      });
    }
    profiles.sort((a, b) => b.wins - a.wins || b.gamesPlayed - a.gamesPlayed);
    return json({
      profileCount: profiles.length,
      top: profiles.slice(0, 20),
    });
  }
}
