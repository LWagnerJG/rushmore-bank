import { describe, expect, it } from "vitest";
import {
  idleAppHeightPx,
  isEditableElement,
  keyboardGone,
  looksLikeIpad,
  resolveAppHeightPx,
  scrollEditableIntoAppScroll,
  stepKeyboardSession,
  type KeyboardSession,
  type ViewportSample,
} from "../viewport-height";

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

  it("ignores visualViewport when asked (keyboard freeze path)", () => {
    expect(
      resolveAppHeightPx({
        innerHeight: 844,
        visualViewportHeight: 480,
        ignoreVisualViewport: true,
      }),
    ).toBe(844);
  });

  it("returns 0 when nothing usable is available", () => {
    expect(
      resolveAppHeightPx({ innerHeight: 0, visualViewportHeight: undefined }),
    ).toBe(0);
  });
});

describe("keyboard session (--app-h)", () => {
  const vp = (
    visualViewportHeight: number,
    extra: Partial<ViewportSample> = {},
  ): ViewportSample => ({
    innerHeight: 844,
    innerWidth: 390,
    visualViewportHeight,
    visualViewportScale: 1,
    ...extra,
  });
  const idle: KeyboardSession = { phase: "idle" };
  const open = (frozenPx = 844): KeyboardSession => ({
    phase: "open",
    frozenPx,
    width: 390,
  });

  it("follows the visual viewport while idle", () => {
    expect(
      stepKeyboardSession(idle, { type: "viewport", viewport: vp(778) }),
    ).toEqual({ session: idle, appHeightPx: 778, ended: false });
  });

  it("ignores pinch-zoom shrinks while idle", () => {
    expect(idleAppHeightPx(vp(420, { visualViewportScale: 2 }))).toBeNull();
  });

  it("freezes at the applied height on focus, before the keyboard shows", () => {
    const step = stepKeyboardSession(idle, {
      type: "focus",
      viewport: vp(844),
      currentAppHeightPx: 844,
    });
    expect(step).toEqual({ session: open(), appHeightPx: null, ended: false });
  });

  it("never follows keyboard frames while a field is focused", () => {
    for (const h of [800, 640, 464, 464.5]) {
      const step = stepKeyboardSession(open(), {
        type: "viewport",
        viewport: vp(h),
      });
      expect(step.appHeightPx).toBeNull();
      expect(step.session.phase).toBe("open");
    }
  });

  it("stays frozen after blur until the keyboard has fully closed", () => {
    // Tap on "Lock in": blur fires while the keyboard is still up.
    let step = stepKeyboardSession(open(), { type: "blur", viewport: vp(464) });
    expect(step).toMatchObject({ appHeightPx: null, ended: false });
    expect(step.session.phase).toBe("closing");
    for (const h of [520, 700, 820]) {
      step = stepKeyboardSession(step.session, {
        type: "viewport",
        viewport: vp(h),
      });
      expect(step.appHeightPx).toBeNull();
      expect(step.session.phase).toBe("closing");
    }
    step = stepKeyboardSession(step.session, {
      type: "viewport",
      viewport: vp(844),
    });
    expect(step).toEqual({ session: idle, appHeightPx: 844, ended: true });
  });

  it("ends immediately on blur when the keyboard never opened", () => {
    expect(
      stepKeyboardSession(open(), { type: "blur", viewport: vp(844) }),
    ).toEqual({ session: idle, appHeightPx: 844, ended: true });
  });

  it("returns to open when another field takes focus mid-close", () => {
    const closing = stepKeyboardSession(open(), {
      type: "blur",
      viewport: vp(464),
    }).session;
    const step = stepKeyboardSession(closing, {
      type: "focus",
      viewport: vp(464),
      currentAppHeightPx: 844,
    });
    expect(step).toEqual({ session: open(), appHeightPx: null, ended: false });
  });

  it("times out without shrinking when the keyboard never reports closed", () => {
    const closing = stepKeyboardSession(open(), {
      type: "blur",
      viewport: vp(464),
    }).session;
    expect(
      stepKeyboardSession(closing, { type: "timeout", viewport: vp(464) }),
    ).toEqual({ session: idle, appHeightPx: null, ended: true });
    expect(
      stepKeyboardSession(open(), { type: "timeout", viewport: vp(464) }),
    ).toEqual({ session: open(), appHeightPx: null, ended: false });
  });

  it("takes the settled height on timeout when the viewport shrank without a keyboard", () => {
    const closing = stepKeyboardSession(open(), {
      type: "blur",
      viewport: vp(464),
    }).session;
    const toolbar = vp(778, { innerHeight: 778 });
    const step = stepKeyboardSession(closing, {
      type: "viewport",
      viewport: toolbar,
    });
    expect(step.session.phase).toBe("closing");
    expect(
      stepKeyboardSession(step.session, { type: "timeout", viewport: toolbar }),
    ).toEqual({ session: idle, appHeightPx: 778, ended: true });
  });

  it("re-freezes at the new layout height when rotated mid-session", () => {
    const step = stepKeyboardSession(open(), {
      type: "viewport",
      viewport: { innerHeight: 390, innerWidth: 844, visualViewportHeight: 180 },
    });
    expect(step).toEqual({
      session: { phase: "open", frozenPx: 390, width: 844 },
      appHeightPx: 390,
      ended: false,
    });
  });

  it("freezes from innerHeight when no --app-h was applied yet", () => {
    expect(
      stepKeyboardSession(idle, {
        type: "focus",
        viewport: vp(464),
        currentAppHeightPx: null,
      }),
    ).toEqual({ session: open(), appHeightPx: 844, ended: false });
  });

  it("treats a missing visual viewport or full height as keyboard gone", () => {
    expect(keyboardGone(vp(843.5), 844)).toBe(true);
    expect(keyboardGone(vp(464), 844)).toBe(false);
    expect(
      keyboardGone({ innerHeight: 844, innerWidth: 390 }, 844),
    ).toBe(true);
    expect(keyboardGone(vp(844, { visualViewportScale: 1.5 }), 844)).toBe(false);
  });
});

describe("isEditableElement", () => {
  it("detects text inputs, textarea, select; ignores checkbox/button", () => {
    expect(
      isEditableElement({ tagName: "INPUT", type: "text" } as unknown as EventTarget),
    ).toBe(true);
    expect(
      isEditableElement({ tagName: "INPUT" } as unknown as EventTarget),
    ).toBe(true);
    expect(
      isEditableElement({ tagName: "TEXTAREA" } as unknown as EventTarget),
    ).toBe(true);
    expect(
      isEditableElement({ tagName: "SELECT" } as unknown as EventTarget),
    ).toBe(true);
    expect(
      isEditableElement({
        tagName: "INPUT",
        type: "checkbox",
      } as unknown as EventTarget),
    ).toBe(false);
    expect(
      isEditableElement({
        tagName: "BUTTON",
        type: "button",
      } as unknown as EventTarget),
    ).toBe(false);
    expect(
      isEditableElement({
        tagName: "DIV",
        isContentEditable: true,
      } as unknown as EventTarget),
    ).toBe(true);
  });
});

describe("scrollEditableIntoAppScroll", () => {
  it("scrolls only the app scrollport", () => {
    const scroll = {
      scrollTop: 0,
      getBoundingClientRect: () => ({ top: 100, bottom: 300 }),
    };
    const field = {
      closest: () => scroll,
      getBoundingClientRect: () => ({ top: 340, bottom: 380 }),
    };

    scrollEditableIntoAppScroll(field);
    expect(scroll.scrollTop).toBe(96); // 380 - 300 + 16
  });

  it("scrolls up when the field sits above the scrollport", () => {
    const scroll = {
      scrollTop: 200,
      getBoundingClientRect: () => ({ top: 100, bottom: 300 }),
    };
    const field = {
      closest: () => scroll,
      getBoundingClientRect: () => ({ top: 40, bottom: 80 }),
    };

    scrollEditableIntoAppScroll(field);
    expect(scroll.scrollTop).toBe(124); // 200 - (100 - 40 + 16)
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
