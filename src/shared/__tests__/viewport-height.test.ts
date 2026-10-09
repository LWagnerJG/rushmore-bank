import { describe, expect, it } from "vitest";
import {
  isEditableElement,
  looksLikeIpad,
  resolveAppHeightPx,
  scrollEditableIntoAppScroll,
  shouldFreezeAppHeight,
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

describe("shouldFreezeAppHeight", () => {
  it("freezes when an editable is focused and vv shrinks by keyboard amount", () => {
    expect(
      shouldFreezeAppHeight({
        innerHeight: 844,
        visualViewportHeight: 480,
        visualViewportOffsetTop: 0,
        editableFocused: true,
      }),
    ).toBe(true);
  });

  it("freezes when visualViewport offsetTop jumps under focus", () => {
    expect(
      shouldFreezeAppHeight({
        innerHeight: 844,
        visualViewportHeight: 780,
        visualViewportOffsetTop: 64,
        editableFocused: true,
      }),
    ).toBe(true);
  });

  it("does not freeze for small browser-chrome shrinks without focus", () => {
    expect(
      shouldFreezeAppHeight({
        innerHeight: 844,
        visualViewportHeight: 778,
        visualViewportOffsetTop: 0,
        editableFocused: false,
      }),
    ).toBe(false);
  });

  it("does not freeze for modest chrome shrinks even with focus", () => {
    expect(
      shouldFreezeAppHeight({
        innerHeight: 844,
        visualViewportHeight: 778,
        visualViewportOffsetTop: 0,
        editableFocused: true,
      }),
    ).toBe(false);
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
