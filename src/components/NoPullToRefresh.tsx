"use client";

import { useEffect } from "react";
import {
  isEditableElement,
  resolveAppHeightPx,
  scrollEditableIntoAppScroll,
  shouldFreezeAppHeight,
} from "@/shared/viewport-height";

/**
 * Sets --app-h from the true visual viewport and keeps it updated — except
 * while the software keyboard is open. Shrinking the locked shell with the
 * keyboard (iOS Safari / standalone PWA) jumps the whole UI; freeze the last
 * stable height instead and scroll the focused field inside the app scrollport.
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
    }
    if (frozenPx.current > 0) {
      document.documentElement.style.setProperty(
        "--app-h",
        `${frozenPx.current}px`,
      );
    }
    // Kill page-level rubber-band / vv offset jumps under a locked shell.
    window.scrollTo(0, 0);
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
 * Also owns iOS keyboard focus hygiene: keep html/body locked, scroll the
 * focused input inside the app scrollport only, and reset window scroll on blur.
 */
export function NoPullToRefresh() {
  // Sync --app-h before layout; re-sync on orientation / resize / vv scroll,
  // but freeze while the keyboard is open.
  useEffect(() => {
    const frozenPx: { current: number | null } = { current: null };
    const onResize = () => syncAppH(frozenPx);
    syncAppH(frozenPx);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
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

  // Focus / blur: scroll within app containers only; never leave a shifted page.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target;
      if (!isEditableElement(t)) return;
      window.scrollTo(0, 0);
      // After keyboard / vv settles, nudge the field into the scrollport.
      requestAnimationFrame(() => {
        scrollEditableIntoAppScroll(t);
        window.scrollTo(0, 0);
      });
      window.setTimeout(() => {
        scrollEditableIntoAppScroll(t);
        window.scrollTo(0, 0);
      }, 120);
    };
    const onFocusOut = () => {
      window.scrollTo(0, 0);
      // Keyboard dismiss can leave a residual document offset on iOS.
      window.setTimeout(() => window.scrollTo(0, 0), 50);
      window.setTimeout(() => window.scrollTo(0, 0), 300);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
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
