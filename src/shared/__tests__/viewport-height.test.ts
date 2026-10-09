import { describe, expect, it } from "vitest";
import { looksLikeIpad, resolveAppHeightPx } from "../viewport-height";

describe("resolveAppHeightPx", () => {
  it("prefers a positive visualViewport height", () => {
    expect(
      resolveAppHeightPx({ innerHeight: 900, visualViewportHeight: 868.4 }),
    ).toBe(868);
  });

  it("falls back to innerHeight when visualViewport is missing", () => {
    expect(
      resolveAppHeightPx({ innerHeight: 1024, visualViewportHeight: null }),
    ).toBe(1024);
    expect(
      resolveAppHeightPx({ innerHeight: 744, visualViewportHeight: 0 }),
    ).toBe(744);
  });

  it("returns 0 when nothing usable is available", () => {
    expect(
      resolveAppHeightPx({ innerHeight: 0, visualViewportHeight: undefined }),
    ).toBe(0);
  });
});

describe("looksLikeIpad", () => {
  it("detects classic iPad UA and iPadOS desktop UA with touch", () => {
    expect(
      looksLikeIpad({
        userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
    expect(
      looksLikeIpad({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
    expect(
      looksLikeIpad({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });
});
