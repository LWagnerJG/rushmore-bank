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
    expect(beanAvatarSrc("star")).toMatch(/^\/avatars\/star\.webp\?v=\d+$/);
  });

  it("ships WebP files for every id", () => {
    for (const id of BEAN_AVATAR_IDS) {
      const file = resolve(rootDir, "public/avatars", `${id}.webp`);
      expect(existsSync(file), file).toBe(true);
    }
  });

  it("shows WebP beans on home, profile, lobby; not rail/standings", () => {
    const sheet = read("components/SettingsSheet.tsx");
    const css = read("app/globals.css");
    const profileBtn = read("components/ProfileButton.tsx");
    const home = read("components/HomePage.tsx");
    const lobby = read("components/LobbyPanel.tsx");
    const rail = read("components/PlayerRail.tsx");
    const waiting = read("components/WaitingRoster.tsx");
    const results = read("components/ResultsRevealList.tsx");
    const server = readFileSync(resolve(rootDir, "party/server.ts"), "utf8");
    expect(sheet).toMatch(/avatar-picker-grid/);
    expect(sheet).toMatch(/set_avatar/);
    expect(sheet).toMatch(/initialPanel/);
    expect(sheet).toMatch(/profile-sheet-nav/);
    expect(sheet).not.toMatch(/Pick a bean for your profile/);
    expect(css).toMatch(/grid-template-columns:\s*repeat\(4,/);
    expect(css).toMatch(/box-shadow:\s*inset 0 0 0 2\.5px var\(--coral\)/);
    expect(profileBtn).toMatch(/BeanAvatar/);
    expect(home).toMatch(/home-playing-avatar/);
    expect(home).toMatch(/BeanAvatar/);
    expect(home).not.toMatch(/ProfileButton/);
    expect(lobby).toMatch(/BeanAvatar/);
    expect(lobby).toMatch(/lobby-roster-avatar/);
    expect(rail).not.toMatch(/BeanAvatar/);
    expect(waiting).not.toMatch(/BeanAvatar/);
    expect(results).not.toMatch(/BeanAvatar/);
    expect(server).toMatch(/handleSetAvatar|set_avatar/);
  });
});
