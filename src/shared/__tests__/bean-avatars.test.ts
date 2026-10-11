import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  avatarIdFromSeed,
  BEAN_AVATAR_IDS,
  isBeanAvatarId,
  normalizeAvatarId,
} from "../bean-avatars";

const srcDir = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(srcDir, p), "utf8");

describe("bean avatars", () => {
  it("has 16–24 themed ids and stable hashing", () => {
    expect(BEAN_AVATAR_IDS.length).toBeGreaterThanOrEqual(16);
    expect(BEAN_AVATAR_IDS.length).toBeLessThanOrEqual(24);
    expect(isBeanAvatarId("pirate")).toBe(true);
    expect(isBeanAvatarId("not-a-bean")).toBe(false);
    expect(avatarIdFromSeed("device-a")).toBe(avatarIdFromSeed("device-a"));
    expect(normalizeAvatarId("cowboy")).toBe("cowboy");
    expect(BEAN_AVATAR_IDS).toContain(normalizeAvatarId("nope", "seed-x"));
  });

  it("wires picker + sync surfaces", () => {
    const sheet = read("components/SettingsSheet.tsx");
    const lobby = read("components/LobbyPanel.tsx");
    const rail = read("components/PlayerRail.tsx");
    const waiting = read("components/WaitingRoster.tsx");
    const results = read("components/ResultsRevealList.tsx");
    const server = readFileSync(resolve(srcDir, "../party/server.ts"), "utf8");
    expect(sheet).toMatch(/avatar-picker-grid/);
    expect(sheet).toMatch(/set_avatar/);
    expect(lobby).toMatch(/BeanAvatar/);
    expect(rail).toMatch(/BeanAvatar/);
    expect(waiting).toMatch(/BeanAvatar/);
    expect(results).toMatch(/BeanAvatar/);
    expect(server).toMatch(/handleSetAvatar|set_avatar/);
  });
});
