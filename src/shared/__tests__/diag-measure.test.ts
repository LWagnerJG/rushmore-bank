import { describe, expect, it, vi } from "vitest";
import {
  collectDiagSnapshot,
  isStartButtonCutOff,
  readSafeAreaViaProbe,
  rectOf,
} from "../diag-measure";

describe("diag measure helpers", () => {
  it("formats element rects with a bottom edge", () => {
    const el = {
      getBoundingClientRect: () => ({
        x: 10,
        y: 20,
        width: 100,
        height: 40,
        bottom: 60,
        top: 20,
        left: 10,
        right: 110,
        toJSON: () => ({}),
      }),
    } as unknown as Element;
    expect(rectOf(el)).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 40,
      bottom: 60,
    });
    expect(rectOf(null)).toBeNull();
  });

  it("flags Start cutoff when bottom gap is negative", () => {
    expect(isStartButtonCutOff({ startBottomGap: -12 })).toBe(true);
    expect(isStartButtonCutOff({ startBottomGap: 8 })).toBe(false);
    expect(isStartButtonCutOff({ startBottomGap: null })).toBe(false);
  });

  it("reads safe-area from a hidden env() padding probe", () => {
    const padding = {
      paddingTop: "47px",
      paddingRight: "0px",
      paddingBottom: "34px",
      paddingLeft: "0px",
    };
    const probe = {
      style: { cssText: "" },
      setAttribute: vi.fn(),
      remove: vi.fn(),
    };
    const body = {
      appendChild: vi.fn(),
    };
    const doc = {
      createElement: vi.fn(() => probe),
      body,
      defaultView: {
        getComputedStyle: vi.fn(() => padding),
      },
    } as unknown as Document;

    const safe = readSafeAreaViaProbe(doc);
    expect(safe).toEqual({
      top: "47.0px",
      right: "0.0px",
      bottom: "34.0px",
      left: "0.0px",
    });
    expect(body.appendChild).toHaveBeenCalledWith(probe);
    expect(probe.remove).toHaveBeenCalled();
  });

  it("collects core viewport fields and Start gap", () => {
    const startEl = {
      getBoundingClientRect: () => ({
        x: 16,
        y: 700,
        width: 300,
        height: 52,
        bottom: 752,
        top: 700,
        left: 16,
        right: 316,
        toJSON: () => ({}),
      }),
    };
    const phaseScroll = {
      getBoundingClientRect: () => ({
        x: 0,
        y: 120,
        width: 390,
        height: 600,
        bottom: 720,
        top: 120,
        left: 0,
        right: 390,
        toJSON: () => ({}),
      }),
      clientHeight: 600,
      scrollHeight: 800,
      scrollTop: 12,
    };
    const appShell = {
      getBoundingClientRect: () => ({
        x: 0,
        y: 0,
        width: 390,
        height: 844,
        bottom: 844,
        top: 0,
        left: 0,
        right: 390,
        toJSON: () => ({}),
      }),
    };
    const dvhEl = {
      style: { cssText: "" },
      getBoundingClientRect: () => ({ height: 844 }),
      remove: vi.fn(),
    };
    const safeProbe = {
      style: { cssText: "" },
      setAttribute: vi.fn(),
      remove: vi.fn(),
    };

    const doc = {
      documentElement: {
        getBoundingClientRect: () => ({
          x: 0,
          y: 0,
          width: 390,
          height: 844,
          bottom: 844,
          top: 0,
          left: 0,
          right: 390,
          toJSON: () => ({}),
        }),
      },
      body: {
        getBoundingClientRect: () => ({
          x: 0,
          y: 0,
          width: 390,
          height: 844,
          bottom: 844,
          top: 0,
          left: 0,
          right: 390,
          toJSON: () => ({}),
        }),
        appendChild: vi.fn(),
      },
      createElement: vi.fn((tag: string) => {
        if (tag === "div") {
          // first call safe probe, later dvh — order in collect: safe then dvh
          return (doc as unknown as { _n: number })._n++ === 0
            ? safeProbe
            : dvhEl;
        }
        return safeProbe;
      }),
      querySelector: vi.fn((sel: string) => {
        if (sel === ".room-phase-scroll") return phaseScroll;
        if (sel === ".app-shell") return appShell;
        if (sel === "[data-diag='lobby-start']") return startEl;
        return null;
      }),
      defaultView: {
        getComputedStyle: vi.fn((el: unknown) => {
          if (el === safeProbe) {
            return {
              paddingTop: "47px",
              paddingRight: "0px",
              paddingBottom: "34px",
              paddingLeft: "0px",
            };
          }
          return { getPropertyValue: () => "844px" };
        }),
      },
      _n: 0,
    } as unknown as Document & { _n: number };

    const win = {
      innerHeight: 844,
      innerWidth: 390,
      visualViewport: {
        height: 800,
        width: 390,
        offsetTop: 0,
        offsetLeft: 0,
      },
      navigator: {},
      matchMedia: () => ({ matches: true }),
      getComputedStyle: (el: unknown) =>
        (doc.defaultView as Window).getComputedStyle(el as Element),
    } as unknown as Window;

    const snap = collectDiagSnapshot({
      win,
      doc,
      buildSha: "abc12345",
    });
    expect(snap.buildSha).toBe("abc12345");
    expect(snap.standalone).toBe(true);
    expect(snap.innerHeight).toBe(844);
    expect(snap.visualViewportH).toBe(800);
    expect(snap.appHVar).toBe("844px");
    expect(snap.safeBottom).toBe("34.0px");
    expect(snap.startBtnRect?.bottom).toBe(752);
    expect(snap.startBottomGap).toBeCloseTo(48, 0);
    expect(snap.phaseScrollScrollH).toBe(800);
    expect(isStartButtonCutOff(snap)).toBe(false);
  });
});

describe("resolveAppHeight for iPhone cutoff", () => {
  it("uses visualViewport when shorter than a stale layout height", async () => {
    const { resolveAppHeightPx } = await import("../viewport-height");
    expect(
      resolveAppHeightPx({ innerHeight: 844, visualViewportHeight: 778 }),
    ).toBe(778);
  });
});
