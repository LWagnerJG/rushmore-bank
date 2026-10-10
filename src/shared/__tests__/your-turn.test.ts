import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hapticPattern } from "@/lib/haptics";
import { cueYourTurn, resetYourTurnCue } from "@/lib/your-turn";

const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);
const draft = readFileSync(
  resolve(__dirname, "../../components/DraftPanel.tsx"),
  "utf8",
);
const vote = readFileSync(
  resolve(__dirname, "../../components/VotePanel.tsx"),
  "utf8",
);
const dice = readFileSync(
  resolve(__dirname, "../../components/DicePanel.tsx"),
  "utf8",
);
const rushmore = readFileSync(
  resolve(__dirname, "../../components/RushmoreCard.tsx"),
  "utf8",
);

describe("your-turn moments", () => {
  afterEach(() => {
    resetYourTurnCue();
    vi.unstubAllGlobals();
  });

  it("uses a single ~20ms vibrate for your_turn (never required)", () => {
    expect(hapticPattern("your_turn")).toBe(20);
  });

  it("dedupes cueYourTurn by key and calls vibrate once", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    cueYourTurn("draft:ABCD:1");
    cueYourTurn("draft:ABCD:1");
    cueYourTurn("draft:ABCD:2");
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(vibrate).toHaveBeenNthCalledWith(1, 20);
  });

  it("defines a single coral fill-in with transform/opacity under 300ms", () => {
    expect(css).toMatch(/@keyframes\s+coral-fill-in/);
    expect(css).toMatch(/\.btn-your-turn/);
    const fill =
      css.match(/@keyframes\s+coral-fill-in\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(fill).toMatch(/transform:\s*scaleX/);
    expect(fill).toMatch(/opacity/);
    expect(fill).not.toMatch(/filter|blur|box-shadow/);
    expect(css).toMatch(
      /animation:\s*coral-fill-in\s+var\(--motion-fast\)/,
    );
    expect(css).toMatch(/--motion-fast:\s*(1\d\d|2\d\d)ms/);
  });

  it("removes infinite pulse/flash from pick, vote, and roll cues", () => {
    expect(draft).toMatch(/btn-your-turn/);
    expect(draft).toMatch(/cueYourTurn/);
    expect(vote).toMatch(/cueYourTurn/);
    expect(rushmore).toMatch(/rushmore-card-your-turn/);
    expect(dice).toMatch(/cueYourTurn/);
    expect(dice).not.toMatch(/classList\.add\("dice-your-turn"\)/);

    const armedBlocks = [
      ...(css.match(/\.bean-dice-tray-armed\s*\{[\s\S]*?\n\}/g) ?? []),
    ];
    for (const block of armedBlocks) {
      const decls = block.replace(/\/\*[\s\S]*?\*\//g, "");
      expect(decls).not.toMatch(/infinite/);
    }
    const hintBlocks = [
      ...(css.match(/\.bean-dice-hint(?:-first)?\s*\{[\s\S]*?\n\}/g) ?? []),
    ];
    for (const block of hintBlocks) {
      const decls = block.replace(/\/\*[\s\S]*?\*\//g, "");
      expect(decls).not.toMatch(/infinite/);
    }
  });

  it("keeps perimeter glow inert (no flash ring)", () => {
    const after =
      css.match(/html\.dice-your-turn::after\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(after).toMatch(/content:\s*none|display:\s*none/);
    expect(after).not.toMatch(/infinite/);
  });

  it("respects prefers-reduced-motion for coral fill-in", () => {
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*?\.btn-your-turn::before/,
    );
  });
});
