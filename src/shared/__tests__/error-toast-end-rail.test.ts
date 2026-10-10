import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isBenignRaceError,
  RACE_ERROR_SUPPRESS_MS,
} from "@/hooks/useGameRoom";
import { ERROR_TOAST_MS } from "@/components/ErrorToast";

const room = readFileSync(
  resolve(__dirname, "../../components/RoomClient.tsx"),
  "utf8",
);
const toast = readFileSync(
  resolve(__dirname, "../../components/ErrorToast.tsx"),
  "utf8",
);
const home = readFileSync(resolve(__dirname, "../../app/page.tsx"), "utf8");
const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");
const hook = readFileSync(
  resolve(__dirname, "../../hooks/useGameRoom.ts"),
  "utf8",
);

describe("error toast overlay", () => {
  it("auto-dismisses around 2.5s without a dismiss control", () => {
    expect(ERROR_TOAST_MS).toBe(2500);
    expect(toast).toMatch(/ERROR_TOAST_MS/);
    expect(toast).toMatch(/setTimeout/);
    expect(toast).not.toMatch(/>\s*dismiss\s*</i);
    expect(room).toMatch(/ErrorToast/);
    expect(room).not.toMatch(/>\s*dismiss\s*</);
  });

  it("overlays without pushing layout (fixed + opacity/transform only)", () => {
    const block = css.match(/\.error-toast\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block).toMatch(/position:\s*fixed/);
    expect(block).toMatch(/color:\s*var\(--coral\)/);
    expect(block).toMatch(/transition:[^;]*opacity/);
    expect(block).toMatch(/transition:[^;]*transform/);
    expect(block).not.toMatch(/blur\s*\(/);
    expect(block).not.toMatch(/border:/);
  });

  it("dedupes identical messages while visible", () => {
    expect(toast).toMatch(/shownRef\.current === error/);
    expect(hook).toMatch(/prev === next/);
  });

  it("suppresses benign race leftovers after a revision bump", () => {
    expect(isBenignRaceError("Not your turn")).toBe(true);
    expect(isBenignRaceError("Rounds locked")).toBe(false);
    expect(isBenignRaceError("Game over — play again")).toBe(true);
    expect(RACE_ERROR_SUPPRESS_MS).toBeGreaterThanOrEqual(800);
    expect(hook).toMatch(/suppressRaceUntilRef/);
    expect(hook).toMatch(/isBenignRaceError/);
  });
});

describe("GAME_RESULTS score surface", () => {
  it("hides PlayerRail on final standings only", () => {
    expect(room).toMatch(/phase !== "GAME_RESULTS"/);
    expect(room).toMatch(/PlayerRail/);
    // Still shown for mid-game results
    expect(room).not.toMatch(/phase !== "ROUND_RESULTS"/);
  });
});

describe("Home hydration", () => {
  it("reads admin/diag via useSyncExternalStore (no window in useState)", () => {
    expect(home).toMatch(/useSyncExternalStore/);
    expect(home).toMatch(/getAdminServerSnapshot|return false/);
    expect(home).not.toMatch(
      /useState\(\(\)\s*=>\s*\{[\s\S]*sessionStorage/,
    );
    expect(home).not.toMatch(
      /useState\(\(\)\s*=>\s*[\s\S]*URLSearchParams/,
    );
  });
});
