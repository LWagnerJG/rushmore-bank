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

describe("FitName ResizeObserver hygiene", () => {
  it("debounces RO callbacks with rAF and skips unchanged width bins", () => {
    expect(fit).toMatch(/requestAnimationFrame/);
    expect(fit).toMatch(/lastWidthBin/);
    expect(fit).toMatch(/Math\.round\(width\)/);
    expect(fit).toMatch(/ResizeObserver\(schedule\)/);
  });
});

describe("DraftBannerClock interval", () => {
  it("updates via DOM at 1s without setState every tick", () => {
    expect(room).toMatch(/setInterval\(write,\s*1000\)/);
    expect(room).toMatch(/el\.textContent\s*=/);
    expect(room).not.toMatch(/setInterval\([^,]+,\s*250\)/);
    // No React state for the seconds value.
    const clock = room.slice(
      room.indexOf("function DraftBannerClock"),
      room.indexOf("export function RoomClient"),
    );
    expect(clock).not.toMatch(/useState/);
  });
});
