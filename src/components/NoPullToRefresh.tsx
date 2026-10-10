"use client";

import { useEffect } from "react";
import {
  isEditableElement,
  resolveAppHeightPx,
  shouldFreezeAppHeight,
} from "@/shared/viewport-height";

/**
 * Sets --app-h from the true visual viewport and keeps it updated — except
 * while any text field is focused. Shrinking the locked shell under the
 * keyboard (iOS Safari / standalone PWA) jumps the whole UI; freeze the last
 * stable height for the entire focus session and never scroll/focus the input.
 */
function syncAppH(frozenPx: { current: number | null }) {
  const innerHeight = window.innerHeight;
  const visualViewportHeight = window.visualViewport?.height;
  const visualViewportOffsetTop = window.visualViewport?.offsetTop;
  const editableFocused = isEditableElement(document.activeElement);
  const freeze = shouldFreezeAppHeight({
    innerHeight,
    visualViewportHeight,
    visualViewportOffsetTop,
    editableFocused,
  });

  if (freeze) {
    if (frozenPx.current == null) {
      const existing = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--app-h"),
      );
      frozenPx.current =
        Number.isFinite(existing) && existing > 0
          ? Math.round(existing)
          : resolveAppHeightPx({
              innerHeight,
              visualViewportHeight: null,
              ignoreVisualViewport: true,
            });
      if (frozenPx.current > 0) {
        document.documentElement.style.setProperty(
          "--app-h",
          `${frozenPx.current}px`,
        );
      }
    }
    // While focused: leave --app-h alone. Do not scrollTo on every vv frame —
    // that fights iOS and jumps the caret.
    return;
  }

  frozenPx.current = null;
  const px = resolveAppHeightPx({
    innerHeight,
    visualViewportHeight,
  });
  if (px > 0) {
    document.documentElement.style.setProperty("--app-h", `${px}px`);
  }
}

/**
 * Blocks Safari/Chrome pull-to-refresh on phone so the PartyServer socket
 * isn't nuked mid-game. Only cancels the rubber-band-at-top gesture;
 * normal scrolling inside .app-shell-scroll / .room-phase-scroll still works.
 *
 * Also owns iOS keyboard focus hygiene: freeze --app-h for the whole focus
 * session, keep html/body locked, never scrollIntoView/focus the field on
 * change, and reset window scroll only on focus edges (not vv frames).
 */
export function NoPullToRefresh() {
  useEffect(() => {
    const frozenPx: { current: number | null } = { current: null };
    const onResize = () => syncAppH(frozenPx);

    const onFocusIn = (e: FocusEvent) => {
      if (!isEditableElement(e.target)) return;
      // Kill document bounce once at focus edge — never nudge the field into view.
      window.scrollTo(0, 0);
      syncAppH(frozenPx);
    };
    const onFocusOut = () => {
      window.scrollTo(0, 0);
      // Unfreeze + resync after keyboard dismiss; residual offset cleanup.
      syncAppH(frozenPx);
      window.setTimeout(() => {
        window.scrollTo(0, 0);
        syncAppH(frozenPx);
      }, 50);
      window.setTimeout(() => {
        window.scrollTo(0, 0);
        syncAppH(frozenPx);
      }, 300);
    };

    syncAppH(frozenPx);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  // Pause continuous brand shimmer while the tab is backgrounded.
  useEffect(() => {
    const sync = () => {
      document.documentElement.classList.toggle(
        "brand-shimmer-paused",
        document.visibilityState === "hidden",
      );
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    let startY = 0;

    const onStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? 0;
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const y = e.touches[0]?.clientY ?? 0;
      const pullingDown = y > startY + 2;

      // Find nearest scrollable ancestor of the touch target
      let el: HTMLElement | null = e.target as HTMLElement | null;
      let scrollTop = 0;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const oy = style.overflowY;
        if (
          (oy === "auto" || oy === "scroll" || oy === "overlay") &&
          el.scrollHeight > el.clientHeight + 1
        ) {
          scrollTop = el.scrollTop;
          break;
        }
        el = el.parentElement;
      }
      if (!el || el === document.body) {
        scrollTop =
          window.scrollY ||
          document.documentElement.scrollTop ||
          document.body.scrollTop ||
          0;
      }

      if (pullingDown && scrollTop <= 0) {
        // Stop browser PTR / document bounce without blocking inner pans
        if (e.cancelable) e.preventDefault();
      }
    };

    document.addEventListener("touchstart", onStart, {
      passive: true,
      capture: true,
    });
    document.addEventListener("touchmove", onMove, {
      passive: false,
      capture: true,
    });
    return () => {
      document.removeEventListener("touchstart", onStart, true);
      document.removeEventListener("touchmove", onMove, true);
    };
  }, []);

  return null;
}
