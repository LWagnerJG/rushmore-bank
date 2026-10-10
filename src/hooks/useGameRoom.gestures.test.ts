import { describe, expect, it } from "vitest";
import { gestureKeyFor } from "./useGameRoom";

describe("gestureKeyFor stable actionId keys", () => {
  it("reuses the same key for double-tap start", () => {
    const a = gestureKeyFor({ type: "start" }, 3);
    const b = gestureKeyFor({ type: "start" }, 3);
    expect(a).toBe(b);
    expect(gestureKeyFor({ type: "start" }, 4)).not.toBe(a);
  });

  it("changes key when vote target changes", () => {
    expect(
      gestureKeyFor({ type: "submit_vote", targetPlayerId: "A" }, 1),
    ).not.toBe(
      gestureKeyFor({ type: "submit_vote", targetPlayerId: "B" }, 1),
    );
  });

  it("keys roll by phase revision only", () => {
    expect(gestureKeyFor({ type: "roll" }, 5)).toBe("roll:5");
  });
});
