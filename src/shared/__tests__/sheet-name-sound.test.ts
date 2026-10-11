import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(srcDir, p), "utf8");

describe("profile sheet: inline name + avatar + device sound", () => {
  const sheet = read("components/SettingsSheet.tsx");
  const room = read("components/RoomClient.tsx");
  const home = read("app/page.tsx");
  const sfx = read("lib/sfx.ts");
  const prefs = read("lib/sound-prefs.ts");
  const timer = read("components/TimerPill.tsx");
  const draft = read("components/DraftPanel.tsx");
  const reveal = read("components/ResultsRevealList.tsx");

  it("edits nickname inline in the sheet header with lobby rename parity", () => {
    expect(sheet).toMatch(/ProfileNameEdit|profile-sheet-name-btn/);
    expect(sheet).toMatch(/profile-sheet-name-input/);
    expect(sheet).toMatch(/Change after the game/);
    expect(sheet).toMatch(/onRename/);
    expect(sheet).toMatch(/canRename/);
    expect(room).toMatch(/rename=\{rename\}/);
    expect(room).toMatch(/canRename=\{phase === "LOBBY"/);
    expect(home).toMatch(/rename=\{\(next\)/);
    expect(home).toMatch(/rememberDisplayName\(next\)/);
  });

  it("expands the avatar grid inline instead of a nested avatar panel", () => {
    expect(sheet).toMatch(/avatarOpen|avatar-picker-expand/);
    expect(sheet).toMatch(/avatar-picker-grid/);
    expect(sheet).toMatch(/set_avatar/);
    expect(sheet).not.toMatch(/setPanel\("avatar"\)/);
    expect(sheet).not.toMatch(/‹ Avatar/);
    expect(sheet).toMatch(/initialPanel === "avatar"/);
  });

  it("keeps Sound per-device with toggle-on preview chime", () => {
    expect(prefs).toMatch(/beans:sound-enabled/);
    expect(prefs).toMatch(/localStorage/);
    expect(sheet).toMatch(/setSoundEnabled\(next\)/);
    expect(sheet).toMatch(/enableSoundFromUserGesture/);
    expect(sfx).toMatch(/enableSoundFromUserGesture/);
    expect(sfx).toMatch(/case "confirm"/);
    // Never broadcast via room settings.
    expect(sheet).not.toMatch(/update_settings[\s\S]{0,80}sound/i);
    expect(room).not.toMatch(/soundEnabled|sound_on/);
  });

  it("wires cohesive cue kinds for game moments", () => {
    for (const kind of [
      "your_turn",
      "lock_in",
      "timer_tick",
      "dice_tick",
      "bust",
      "bank",
      "reveal",
      "winner",
      "confirm",
    ]) {
      expect(sfx).toMatch(new RegExp(`case "${kind}"`));
    }
    expect(timer).toMatch(/timer_tick/);
    expect(draft).toMatch(/feedback\("lock_in"\)/);
    expect(reveal).toMatch(/feedback\("reveal"\)/);
  });
});
