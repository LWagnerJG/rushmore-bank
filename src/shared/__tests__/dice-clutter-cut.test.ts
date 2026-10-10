import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(__dirname, "../../app/globals.css"),
  "utf8",
);
const dice = readFileSync(
  resolve(__dirname, "../../components/DicePanel.tsx"),
  "utf8",
);
const scene = readFileSync(
  resolve(__dirname, "../../components/dice/DiceScene.tsx"),
  "utf8",
);
const room = readFileSync(
  resolve(__dirname, "../../components/RoomClient.tsx"),
  "utf8",
);
const notice = readFileSync(
  resolve(__dirname, "../../components/RoomNotice.tsx"),
  "utf8",
);

describe("dice clutter-cut", () => {
  it("hides chrome BANK/beans during DICE (turn strip is the score surface)", () => {
    expect(room).toMatch(/phase === "SCORE_REVEAL" \|\| phase === "DICE"/);
    // Soft beans chrome path for DICE must be gone
    expect(room).not.toMatch(/phase === "DICE"\s*\?\s*"mt-0\.5/);
  });

  it("shows Pot/Safe once, Safe alone when pot is 0", () => {
    expect(dice).toMatch(/>Pot</);
    expect(dice).toMatch(/>Safe</);
    expect(dice).toMatch(/active && pot > 0/);
    expect(dice).not.toMatch(/Your pot|Your safe|at risk/);
    expect(dice).not.toMatch(/→ total/);
  });

  it("merges status into one signal (no tray Rolling chip, no post-bust spectator line)", () => {
    expect(scene).not.toMatch(/bean-dice-hint-rolling/);
    expect(scene).not.toMatch(/Rolling…/);
    expect(dice).not.toMatch(/is rolling/);
    expect(dice).not.toMatch(/pot wiped|Pot wiped|TAP TO ROLL/);
  });

  it("uses one Bean Buster banner line", () => {
    expect(dice).toMatch(/Bean Buster · Pot gone/);
    expect(dice).not.toMatch(/dice-result-bust-title">BEAN BUSTER/);
    expect(dice).not.toMatch(/dice-result-note/);
  });

  it("cuts ghost Bank label but reserves CTA height", () => {
    expect(dice).toMatch(/dice-bank-cta-spacer/);
    expect(dice).not.toMatch(/dice-bank-cta-ghost/);
    expect(css).toMatch(/\.dice-bank-cta-spacer/);
  });

  it("drops idle dash readout", () => {
    expect(dice).not.toMatch(/dice-result-idle/);
    expect(dice).not.toMatch(/tabular-nums">—</);
  });

  it("shows TAP chip on the first roll only", () => {
    expect(scene).toMatch(/canRoll && firstRollHint/);
    expect(scene).not.toMatch(/\{canRoll && \(/);
  });

  it("timer is digits-only while live with aria-label", () => {
    expect(dice).toMatch(/aria-label=\{active \? `\$\{label\}: \$\{left\} seconds`/);
    expect(dice).toMatch(/showLabel/);
    expect(dice).not.toMatch(/dice-timer-unit/);
    expect(dice).not.toMatch(/\{active \? left : "—"\}/);
  });

  it("uses one green tray; coral edge is the your-turn signal", () => {
    expect(scene).not.toMatch(/bean-dice-tray-first-hint/);
    expect(css).toMatch(/dice-armed-enter\s+180ms/);
    expect(css).not.toMatch(/bean-dice-tray-first-hint\s*\{[\s\S]*?rgba\(244,\s*201,\s*91/);
    // Die-1 matches cream (no gold fill)
    const die1 =
      css.match(/\.bean-pip-die-1 \.bean-pip-die-body\s*\{[\s\S]*?\n\}/)?.[0] ??
      "";
    expect(die1).toMatch(/#fff8ec/);
    expect(die1).not.toMatch(/#f4c95b/);
  });

  it("bust fades only the busted strip card; no 2s linger on the stage", () => {
    expect(dice).toMatch(/dice-bust-flash/);
    expect(dice).not.toMatch(/dice-bust-linger/);
    expect(css).not.toMatch(/bust-linger-pulse/);
    expect(css).toMatch(/dice-bust-flash\s+250ms|dice-bust-flash 250ms/);
    expect(css).toMatch(/\.dice-bust-flash \.dice-turn-chip-busted/);
  });

  it("keeps admin notice host-only", () => {
    expect(room).toMatch(/RoomNotice[^>]*hostOnly/);
    expect(notice).toMatch(/hostOnly/);
    expect(notice).toMatch(/isHost/);
  });
});

describe("dice motion contracts", () => {
  it("caps settle punch, pair scale, and +N fade", () => {
    expect(css).toMatch(/dice-tray-punch\s+240ms/);
    expect(css).toMatch(/dice-pair-settle\s+200ms/);
    expect(css).toMatch(/dice-result-pop\s+220ms/);
    expect(scene).toMatch(/setPunch\(false\), 240\)/);
  });

  it("bank modal uses 200ms opacity + translateY", () => {
    expect(css).toMatch(/bank-confirm-rise\s+200ms/);
    expect(css).toMatch(/translateY\(8px\)/);
  });

  it("armed enter is one-shot 180ms; no infinite pulse", () => {
    expect(css).toMatch(/@keyframes\s+dice-armed-enter/);
    const armed =
      css.match(/\.bean-dice-tray-armed\s*\{[\s\S]*?\n\}/g) ?? [];
    for (const block of armed) {
      expect(block.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/infinite/);
    }
  });

  it("honors prefers-reduced-motion for new dice motions", () => {
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*?bean-dice-tray-armed/,
    );
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce[\s\S]*?bank-confirm-modal/,
    );
  });
});
