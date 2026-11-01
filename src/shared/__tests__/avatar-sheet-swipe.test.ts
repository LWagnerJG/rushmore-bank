import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(srcDir, p), "utf8");

describe("home avatar affordance + name edit", () => {
  const home = read("components/HomePage.tsx");
  const css = read("app/globals.css");

  it("makes the home avatar an obvious ≥44px tap target into the picker", () => {
    expect(home).toMatch(/home-playing-avatar/);
    expect(home).toMatch(/aria-label="Change avatar"/);
    expect(home).toMatch(/setProfilePanel\("avatar"\)/);
    expect(home).toMatch(/avatar-edit-badge/);
    const avatar = css.match(/\.home-playing-avatar\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(avatar).toMatch(/min-width:\s*var\(--tap-min\)/);
    expect(avatar).toMatch(/min-height:\s*var\(--tap-min\)/);
    expect(avatar).toMatch(/var\(--coral\)/);
    expect(css).toMatch(/\.avatar-edit-badge\s*\{/);
  });

  it("lets the name open the sheet for inline rename (no separate Edit CTA)", () => {
    expect(home).toMatch(/home-playing-name-btn/);
    expect(home).toMatch(/setProfilePanel\("main"\)/);
    expect(home).toMatch(/rename=\{\(next\)/);
    expect(home).toMatch(/rememberDisplayName\(next\)/);
    expect(home).not.toMatch(/home-edit-name/);
    expect(home).not.toMatch(/function editName/);
  });
});

describe("profile sheet: inline name + expandable avatar", () => {
  const sheet = read("components/SettingsSheet.tsx");
  const room = read("components/RoomClient.tsx");
  const css = read("app/globals.css");

  it("edits nickname inline with lobby rename parity and mid-game lock", () => {
    expect(sheet).toMatch(/ProfileNameEdit|profile-sheet-name-btn/);
    expect(sheet).toMatch(/profile-sheet-name-input/);
    expect(sheet).toMatch(/Change after the game/);
    expect(sheet).toMatch(/canRename/);
    expect(room).toMatch(/rename=\{rename\}/);
    expect(room).toMatch(/canRename=\{phase === "LOBBY"/);
  });

  it("expands the avatar grid inline instead of a nested avatar panel", () => {
    expect(sheet).toMatch(/avatarOpen|avatar-picker-expand/);
    expect(sheet).toMatch(/avatar-picker-grid/);
    expect(sheet).toMatch(/set_avatar/);
    expect(sheet).toMatch(/initialPanel === "avatar"/);
    expect(sheet).not.toMatch(/setPanel\("avatar"\)/);
    expect(sheet).not.toMatch(/‹ Avatar/);
    expect(css).toMatch(/avatar-picker-expand-open/);
  });
});

describe("swipe-down sheet dismiss (safe mid-round)", () => {
  const sheet = read("components/SettingsSheet.tsx");
  const dice = read("components/DicePanel.tsx");
  const css = read("app/globals.css");

  it("keeps a visible grab handle and swipe-dismiss on the profile sheet", () => {
    expect(sheet).toMatch(/settings-sheet-grabber/);
    expect(sheet).toMatch(/DISMISS_PX\s*=\s*96/);
    expect(sheet).toMatch(/onTouchStart/);
    expect(sheet).toMatch(/onTouchMove/);
    expect(sheet).toMatch(/onTouchEnd/);
    expect(sheet).toMatch(/dragYRef/);
    expect(sheet).toMatch(/--sheet-drag-y/);
    expect(sheet).toMatch(/settings-sheet-settled/);
    expect(css).toMatch(/\.settings-sheet-grabber-pill/);
    expect(css).toMatch(/--sheet-drag-y/);
    expect(css).toMatch(/\.settings-sheet-settled/);
  });

  it("does not swipe-dismiss bank confirm mid-dice (accidental flick would cost a turn)", () => {
    expect(dice).toMatch(/bank-confirm-backdrop/);
    expect(dice).toMatch(/Yes, Bank/);
    expect(dice).toMatch(/cancelBankConfirm/);
    // Confirm modal is button-only — no swipe / grabber / backdrop dismiss.
    expect(dice).not.toMatch(/bank-confirm-grabber|DISMISS_PX/);
    const backdropTag = dice.match(
      /<div className="bank-confirm-backdrop"[^>]*>/,
    )?.[0];
    expect(backdropTag).toBeTruthy();
    expect(backdropTag).not.toMatch(/onClick|onTouch/);
    expect(css).toMatch(/\.bank-confirm-modal/);
  });
});
