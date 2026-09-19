import { describe, expect, it } from "vitest";
import { resolveFitNameStyle } from "@/shared/fit-name";

describe("resolveFitNameStyle", () => {
  it("keeps base size when content already fits", () => {
    const style = resolveFitNameStyle(14, () => false);
    expect(style.fontSizePx).toBe(14);
    expect(style.letterSpacing).toBe("");
    expect(style.textOverflow).toBe("clip");
  });

  it("shrinks below base when content overflows at base", () => {
    // Overflows when font > 10px
    const style = resolveFitNameStyle(14, (fontPx) => fontPx > 10.05);
    expect(style.fontSizePx).toBeLessThanOrEqual(10.1);
    expect(style.fontSizePx).toBeGreaterThanOrEqual(10);
    expect(style.textOverflow).toBe("clip");
  });

  it("never goes below the readable floor (~58% of base, min 8px)", () => {
    const base = 12;
    const min = Math.max(8, Math.round(base * 0.58 * 10) / 10);
    const style = resolveFitNameStyle(base, () => true);
    expect(style.fontSizePx).toBe(min);
    expect(style.textOverflow).toBe("ellipsis");
    expect(style.letterSpacing).toBe("-0.05em");
  });

  it("uses tracking tighten before ellipsis when that alone fits", () => {
    const style = resolveFitNameStyle(14, (_fontPx, tracking) => {
      // Always overflows without tracking; tightened tracking fits.
      return tracking === "";
    });
    expect(style.letterSpacing).toBe("-0.03em");
    expect(style.textOverflow).toBe("clip");
  });
});
