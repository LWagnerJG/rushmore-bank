import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  avatarIdFromSeed,
  BEAN_AVATAR_IDS,
  beanAvatarSrc,
  isBeanAvatarId,
  normalizeAvatarId,
} from "../bean-avatars";

const srcDir = resolve(__dirname, "../..");
const rootDir = resolve(srcDir, "..");
const read = (p: string) => readFileSync(resolve(srcDir, p), "utf8");

describe("bean avatars", () => {
  it("has 20 logo-matched ids and stable hashing", () => {
    expect(BEAN_AVATAR_IDS).toHaveLength(20);
    expect(BEAN_AVATAR_IDS[0]).toBe("aviator");
    expect(BEAN_AVATAR_IDS[19]).toBe("fishbowl");
    expect(isBeanAvatarId("cyber-visor")).toBe(true);
    expect(isBeanAvatarId("pirate")).toBe(false);
    expect(avatarIdFromSeed("device-a")).toBe(avatarIdFromSeed("device-a"));
    expect(normalizeAvatarId("top-hat")).toBe("top-hat");
    expect(BEAN_AVATAR_IDS).toContain(normalizeAvatarId("nope", "seed-x"));
    expect(beanAvatarSrc("star")).toBe("/avatars/star.webp");
  });

  it("ships WebP files for every id", () => {
    for (const id of BEAN_AVATAR_IDS) {
      const file = resolve(rootDir, "public/avatars", `${id}.webp`);
      expect(existsSync(file), file).toBe(true);
    }
  });

  it("keeps avatars only on profile button + sheet picker", () => {
    const sheet = read("components/SettingsSheet.tsx");
    const profileBtn = read("components/ProfileButton.tsx");
    const lobby = read("components/LobbyPanel.tsx");
    const rail = read("components/PlayerRail.tsx");
    const waiting = read("components/WaitingRoster.tsx");
    const results = read("components/ResultsRevealList.tsx");
    const server = readFileSync(resolve(rootDir, "party/server.ts"), "utf8");
    expect(sheet).toMatch(/avatar-picker-grid/);
    expect(sheet).toMatch(/set_avatar/);
    expect(profileBtn).toMatch(/BeanAvatar/);
    expect(lobby).not.toMatch(/BeanAvatar/);
    expect(rail).not.toMatch(/BeanAvatar/);
    expect(waiting).not.toMatch(/BeanAvatar/);
    expect(results).not.toMatch(/BeanAvatar/);
    expect(server).toMatch(/handleSetAvatar|set_avatar/);
  });
});
