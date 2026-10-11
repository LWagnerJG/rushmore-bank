import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptyProfileStats,
  gameResultId,
  isGameWinner,
  loadProfileStats,
  profileStatsKey,
  recordGameResult,
  winRatePct,
} from "@/lib/profile-stats";
import { profileInitials } from "@/lib/profile-initials";

const srcDir = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(srcDir, p), "utf8");

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe("profile stats persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("window", {
      localStorage: globalThis.localStorage,
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records a win once per gameId and ignores duplicates", () => {
    const clientId = "client-a";
    const gameId = gameResultId("ABCD", 1000);
    const first = recordGameResult({
      clientId,
      gameId,
      score: 42,
      won: true,
    });
    expect(first).toMatchObject({
      wins: 1,
      gamesPlayed: 1,
      bestScore: 42,
      winStreak: 1,
    });
    expect(recordGameResult({ clientId, gameId, score: 99, won: true })).toBe(
      null,
    );
    expect(loadProfileStats(clientId).wins).toBe(1);
    expect(loadProfileStats(clientId).bestScore).toBe(42);
  });

  it("counts ties as wins and resets streak on a loss", () => {
    const clientId = "client-b";
    recordGameResult({
      clientId,
      gameId: "G1",
      score: 10,
      won: true,
    });
    recordGameResult({
      clientId,
      gameId: "G2",
      score: 12,
      won: true,
    });
    const loss = recordGameResult({
      clientId,
      gameId: "G3",
      score: 8,
      won: false,
    });
    expect(loss).toMatchObject({
      wins: 2,
      gamesPlayed: 3,
      bestScore: 12,
      winStreak: 0,
    });
    expect(winRatePct(loss!)).toBe(67);
  });

  it("detects shared winners for ties", () => {
    const players = [
      { id: "a", role: "player", stones: 30 },
      { id: "b", role: "player", stones: 30 },
      { id: "c", role: "player", stones: 12 },
      { id: "s", role: "spectator", stones: 99 },
    ];
    expect(isGameWinner(players, "a")).toBe(true);
    expect(isGameWinner(players, "b")).toBe(true);
    expect(isGameWinner(players, "c")).toBe(false);
    expect(isGameWinner(players, "s")).toBe(false);
  });

  it("keys storage by client id", () => {
    expect(profileStatsKey("x")).toBe("quarry:profile-stats:x");
    expect(emptyProfileStats().recordedGameIds).toEqual([]);
  });
});

describe("profile initials", () => {
  it("builds compact 1–2 letter marks", () => {
    expect(profileInitials("Luke")).toBe("LU");
    expect(profileInitials("Ada Lovelace")).toBe("AL");
    expect(profileInitials("  ")).toBe("?");
  });
});

describe("profile chrome wiring", () => {
  it("homes and rooms open one Profile control into the merged sheet", () => {
    const home = read("app/page.tsx");
    const room = read("components/RoomClient.tsx");
    const sheet = read("components/SettingsSheet.tsx");
    const brand = read("components/BrandMark.tsx");
    const hook = read("hooks/useGameRoom.ts");

    expect(home).toMatch(/ProfileButton/);
    expect(home).toMatch(/SettingsSheet/);
    expect(room).toMatch(/ProfileButton/);
    expect(room).toMatch(/nickname=\{profileName\}/);
    expect(sheet).toMatch(/aria-label="Profile"/);
    expect(sheet).toMatch(/profile-stats/);
    expect(sheet).toMatch(/>Sound</);
    expect(sheet).toMatch(/Party Mode/);
    expect(brand).not.toMatch(/aria-label=\{onLogoTap \? "Settings"/);
    expect(hook).toMatch(/recordGameResult/);
    expect(hook).toMatch(/GAME_RESULTS/);
  });

  it("keeps profile CSS free of blur and hard dividers", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/\.profile-btn\s*\{/);
    expect(css).toMatch(/\.profile-stats\s*\{/);
    const btnBlock = css.slice(css.indexOf(".profile-btn {"), css.indexOf(".home-header-row"));
    expect(btnBlock).not.toMatch(/backdrop-filter|filter:\s*blur/);
    const statsBlock = css.slice(
      css.indexOf(".profile-stats {"),
      css.indexOf(".profile-settings-kicker"),
    );
    expect(statsBlock).not.toMatch(/border-top|border-bottom|border:/);
  });
});
