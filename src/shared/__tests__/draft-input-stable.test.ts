import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");
const draft = read("../../components/DraftPanel.tsx");
const noPull = read("../../components/NoPullToRefresh.tsx");
const rail = read("../../components/PlayerRail.tsx");
const dice = read("../../components/DicePanel.tsx");
const css = read("../../app/globals.css");
const e2e = read("../../../scripts/verify-ios-keyboard.ts");
const emulator = read("../../../scripts/ios-keyboard-emulator.js");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`(^|\\n)${escaped}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
}

describe("draft pick keyboard contracts", () => {
  it("renders the composer above everything that grows", () => {
    const composer = draft.indexOf('className="draft-composer"');
    expect(composer).toBeGreaterThan(-1);
    expect(composer).toBeLessThan(draft.indexOf("draft-turn-line"));
    expect(composer).toBeLessThan(draft.indexOf("<DraftBoard"));
    expect(draft.indexOf("draft-composer-row")).toBeLessThan(
      draft.indexOf("draft-stash"),
    );
  });

  it("keeps the field and submit on one fixed-height row, 16px+ text", () => {
    expect(rule(".draft-pick-input")).toMatch(/font-size:\s*max\(\s*16px/);
    expect(rule(".draft-pick-input")).toMatch(/height:\s*var\(--tap-min\)/);
    expect(rule(".draft-pick-submit")).toMatch(/height:\s*var\(--tap-min\)/);
    expect(rule(".draft-pick-submit")).toMatch(/flex:\s*0 0 /);
    expect(rule(".draft-turn-line")).toMatch(/white-space:\s*nowrap/);
  });

  it("submits on one tap without moving focus, and on Enter / Go", () => {
    expect(draft).toMatch(/aria-disabled=\{!canPrimary\}/);
    expect(draft).not.toMatch(/(?<![-\w])disabled=\{!canPrimary\}/);
    expect(draft).toMatch(/onMouseDown=\{keepFieldFocus\}/);
    expect(draft).toMatch(/e\.preventDefault\(\)/);
    expect(draft).toMatch(/enterKeyHint="go"/);
    expect(draft).toMatch(/e\.key !== "Enter" \|\| e\.nativeEvent\.isComposing/);
    expect(draft).not.toMatch(/confirm/i);
  });

  it("never scrolls or refocuses from draft, rail or dice code", () => {
    for (const src of [draft, rail, dice]) {
      expect(src).not.toMatch(/\.scrollIntoView\(/);
      expect(src).not.toMatch(/\.focus\(/);
    }
    expect(rail).toMatch(/track\.scrollTo\(\{\s*left:\s*0/);
    expect(dice).toMatch(/centerInTrack/);
  });

  it("keeps --app-h frozen through the keyboard session", () => {
    expect(noPull).toMatch(/stepKeyboardSession/);
    expect(noPull).not.toMatch(/scrollIntoView|scrollEditableIntoAppScroll/);
    expect(noPull).not.toMatch(/\.focus\(/);
    // One scrollTo, only when a session ends with a leftover offset.
    expect(noPull.match(/window\.scrollTo\(/g)).toHaveLength(1);
    expect(noPull).toMatch(/step\.ended &&/);
  });

  it("ships the WebKit e2e at 390×844 and 375×667 with the keyboard emulator", () => {
    expect(e2e).toMatch(/webkit\.launch/);
    expect(e2e).toMatch(/width: 390, height: 844/);
    expect(e2e).toMatch(/width: 375, height: 667/);
    expect(e2e).toMatch(/ios-keyboard-emulator\.js/);
    for (const field of [
      "#selected-pick",
      "#home-name",
      'aria-label="Room code"',
      'placeholder="Nickname"',
      'placeholder="Your topic"',
    ]) {
      expect(e2e).toContain(field);
    }
    expect(e2e).toMatch(/window\.scrollY stays 0/);
    expect(e2e).toMatch(/no enter-animation class re-added/);
    expect(emulator).toMatch(/Object\.defineProperty\(window, "visualViewport"/);
  });
});
