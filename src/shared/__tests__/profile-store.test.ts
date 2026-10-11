import { describe, expect, it } from "vitest";
import {
  applyGameToStoredStats,
  emptyStoredProfileStats,
  isValidDeviceId,
  mergeStoredProfileStats,
  normalizeNickname,
} from "../profile-store";
import { ProfileHub } from "../../../party/profile-hub";

describe("profile-store helpers", () => {
  it("merges taking maxima and unioning game ids", () => {
    const a = {
      ...emptyStoredProfileStats(),
      wins: 2,
      gamesPlayed: 3,
      bestScore: 40,
      winStreak: 1,
      totalBeans: 90,
      recordedGameIds: ["A:1", "B:2"],
      nickname: "Luke",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const b = {
      ...emptyStoredProfileStats(),
      wins: 1,
      gamesPlayed: 2,
      bestScore: 48,
      winStreak: 2,
      totalBeans: 70,
      recordedGameIds: ["B:2", "C:3"],
      nickname: "luke",
      updatedAt: "2026-02-01T00:00:00.000Z",
    };
    const m = mergeStoredProfileStats(a, b);
    expect(m.wins).toBe(2);
    expect(m.gamesPlayed).toBe(3);
    expect(m.bestScore).toBe(48);
    expect(m.totalBeans).toBe(90);
    expect(m.recordedGameIds).toEqual(["A:1", "B:2", "C:3"]);
    expect(m.nickname).toBe("luke");
  });

  it("applies games idempotently", () => {
    const first = applyGameToStoredStats(emptyStoredProfileStats(), {
      gameId: "R:1",
      score: 30,
      won: true,
    });
    expect(first).toMatchObject({
      wins: 1,
      gamesPlayed: 1,
      bestScore: 30,
      winStreak: 1,
      totalBeans: 30,
    });
    expect(
      applyGameToStoredStats(first!, {
        gameId: "R:1",
        score: 99,
        won: true,
      }),
    ).toBeNull();
  });

  it("validates device ids and nicknames", () => {
    expect(isValidDeviceId("abc-12345")).toBe(true);
    expect(isValidDeviceId("ssr")).toBe(false);
    expect(isValidDeviceId("local")).toBe(false);
    expect(normalizeNickname("  Luke  Wagner ")).toBe("luke wagner");
  });
});

describe("ProfileHub DO", () => {
  function hub() {
    const map = new Map<string, unknown>();
    const storage = {
      async get(key: string) {
        return map.get(key);
      },
      async put(key: string, value: unknown) {
        map.set(key, value);
      },
      async delete(key: string) {
        return map.delete(key);
      },
      async list(opts?: { prefix?: string; limit?: number }) {
        const out = new Map<string, unknown>();
        for (const [k, v] of map) {
          if (opts?.prefix && !k.startsWith(opts.prefix)) continue;
          out.set(k, v);
          if (opts?.limit && out.size >= opts.limit) break;
        }
        return out;
      },
    };
    const ctx = { storage } as unknown as DurableObjectState;
    return new ProfileHub(ctx);
  }

  it("stores, merges, and matches nickname sightings for empty devices", async () => {
    const h = hub();
    await h.fetch(
      new Request("https://x/profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: "device-old-111",
          nickname: "Luke",
          stats: {
            ...emptyStoredProfileStats(),
            wins: 3,
            gamesPlayed: 5,
            bestScore: 48,
            recordedGameIds: ["A:1", "B:2", "C:3"],
            totalBeans: 120,
          },
        }),
      }),
    );

    const matchEmpty = await h.fetch(
      new Request(
        "https://x/profiles/match?deviceId=device-new-222&nickname=Luke",
      ),
    );
    const body = (await matchEmpty.json()) as {
      candidates: Array<{ deviceId: string; wins: number }>;
    };
    expect(body.candidates[0]?.deviceId).toBe("device-old-111");
    expect(body.candidates[0]?.wins).toBe(3);

    const merge = await h.fetch(
      new Request("https://x/profiles/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromDeviceId: "device-old-111",
          toDeviceId: "device-new-222",
        }),
      }),
    );
    const merged = (await merge.json()) as {
      stats: { wins: number; gamesPlayed: number };
    };
    expect(merged.stats.wins).toBe(3);
    expect(merged.stats.gamesPlayed).toBe(5);

    // Device with games already should not get candidates.
    const matchFilled = await h.fetch(
      new Request(
        "https://x/profiles/match?deviceId=device-new-222&nickname=Luke",
      ),
    );
    const filled = (await matchFilled.json()) as { candidates: unknown[] };
    expect(filled.candidates).toEqual([]);
  });

  it("records games without double-counting", async () => {
    const h = hub();
    const once = await h.fetch(
      new Request("https://x/profiles/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: "device-rec-1",
          gameId: "ZZ:9",
          score: 22,
          won: true,
          nickname: "Ada",
        }),
      }),
    );
    const a = (await once.json()) as { deduped: boolean; stats: { wins: number } };
    expect(a.deduped).toBe(false);
    expect(a.stats.wins).toBe(1);
    const twice = await h.fetch(
      new Request("https://x/profiles/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: "device-rec-1",
          gameId: "ZZ:9",
          score: 99,
          won: true,
        }),
      }),
    );
    const b = (await twice.json()) as { deduped: boolean; stats: { wins: number } };
    expect(b.deduped).toBe(true);
    expect(b.stats.wins).toBe(1);
  });
});
