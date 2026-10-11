import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, rootToken } from "./contrast";

const srcDir = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(srcDir, p), "utf8");
const screen = read("components/InstallJoinScreen.tsx");
const entry = read("components/JoinRoomEntry.tsx");
const joinPage = read("app/join/[code]/page.tsx");
const roomPage = read("app/room/[code]/page.tsx");
const home = read("app/page.tsx");
const lobby = read("components/LobbyPanel.tsx");
const css = read("app/globals.css");
const layout = read("app/layout.tsx");

describe("install-first join UI", () => {
  it("uses the shared glistening hero logo and discreet copy", () => {
    expect(screen).toMatch(/<BrandMark hero/);
    expect(screen).toMatch(/Add Beans to your Home Screen to join/);
    expect(screen).toMatch(/Continue in browser/);
    expect(screen).toMatch(/ShareGlyph|Share/);
    expect(screen).toMatch(/Add to Home Screen/);
    expect(screen).toMatch(/Open Beans/);
    expect(screen).toMatch(/beforeinstallprompt/);
    expect(screen).toMatch(/onInstall[\s\S]*Install/);
    expect(screen).toMatch(/Browser menu → Install app/);
    expect(screen).toMatch(/That room has ended/);
    expect(screen).toMatch(/Open in Safari to install/);
    expect(css).toMatch(/\.install-share-arrow/);
    expect(css).toMatch(/install-arrow-nudge/);
  });

  it("keeps continue-in-browser as a tiny text control with AA muted ink", () => {
    expect(screen).toMatch(/className="install-continue"/);
    const link = css.match(/\.install-continue\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(link).toMatch(/font-size:\s*0\.72rem/);
    expect(link).toMatch(/color:\s*var\(--muted\)/);
    expect(
      contrastRatio(rootToken(css, "muted"), rootToken(css, "bg")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("serves a room-scoped manifest on join + room landings", () => {
    expect(joinPage).toMatch(/roomManifestHref/);
    expect(joinPage).toMatch(/generateMetadata/);
    expect(roomPage).toMatch(/roomManifestHref/);
    expect(roomPage).toMatch(/JoinRoomEntry/);
    expect(layout).toMatch(/manifest:\s*"\/manifest.webmanifest"/);
  });

  it("preserves QR / invite / reconnect escapes", () => {
    expect(lobby).toMatch(/inviteUrl\(/);
    expect(home).toMatch(/window\.location\.replace\(`\/join\/\$\{room\}`\)/);
    expect(entry).toMatch(/recallRoomSession/);
    expect(entry).toMatch(/presetName/);
    expect(entry).toMatch(/recordContinueInBrowser/);
    expect(entry).toMatch(/\/api\/metrics\/install-continue/);
  });
});
