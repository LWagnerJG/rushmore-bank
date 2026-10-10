import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const fit = readFileSync(
  resolve(__dirname, "../../components/FitName.tsx"),
  "utf8",
);
const room = readFileSync(
  resolve(__dirname, "../../components/RoomClient.tsx"),
  "utf8",
);
const pill = readFileSync(
  resolve(__dirname, "../../components/TimerPill.tsx"),
  "utf8",
);
const countdown = readFileSync(
  resolve(__dirname, "../../lib/countdown.ts"),
  "utf8",
);

describe("FitName ResizeObserver hygiene", () => {
  it("debounces RO callbacks with rAF and skips unchanged width bins", () => {
    expect(fit).toMatch(/requestAnimationFrame/);
    expect(fit).toMatch(/lastWidthBin/);
    expect(fit).toMatch(/Math\.round\(width\)/);
    expect(fit).toMatch(/ResizeObserver\(schedule\)/);
  });
});

describe("Draft clock ticking", () => {
  it("wakes once a second, never on a 250ms interval", () => {
    expect(room).toMatch(/<TimerPill[\s\S]*?until=\{state\.pickDeadlineAt\}/);
    // One wake just past each second boundary; 250ms was pure churn.
    expect(countdown).toMatch(/setTimeout\(tick, \(ms % 1000 \|\| 1000\) \+ 20\)/);
    for (const src of [room, pill, countdown]) {
      expect(src).not.toMatch(/setInterval\([^,]+,\s*250\)/);
    }
  });
});
