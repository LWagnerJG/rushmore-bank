import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const hook = readFileSync(
  resolve(__dirname, "../../hooks/useGameRoom.ts"),
  "utf8",
);
const room = readFileSync(
  resolve(__dirname, "../../components/RoomClient.tsx"),
  "utf8",
);
const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

describe("fast reconnect + interaction block", () => {
  it("uses short PartySocket backoff capped near 2s", () => {
    expect(hook).toMatch(/minReconnectionDelay:\s*150/);
    expect(hook).toMatch(/maxReconnectionDelay:\s*2_000/);
    expect(hook).toMatch(/connectionTimeout:\s*2_500/);
  });

  it("force-reconnects on close and on failed send", () => {
    expect(hook).toMatch(/onClose\(\)\s*\{[\s\S]*setErrorRaw\("Reconnecting…"/);
    expect(hook).toMatch(/socket\.reconnect\(\)/);
    expect(hook).toMatch(
      /readyState !== WebSocket\.OPEN[\s\S]*forceReconnect\(\)/,
    );
  });

  it("blocks phase UI while disconnected without blur", () => {
    expect(room).toMatch(/reconnect-blocker/);
    expect(room).toMatch(/inert=\{!connected \? true : undefined\}/);
    expect(room).toMatch(/error === "Reconnecting…" \? null : error/);
    const block = css.match(/\.reconnect-blocker\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block).toMatch(/position:\s*absolute/);
    expect(block).not.toMatch(/blur\s*\(|backdrop-filter/);
  });
});
