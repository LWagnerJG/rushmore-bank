"use client";

import { useEffect } from "react";
import { resolveAppHeightPx } from "@/shared/viewport-height";

/**
 * Sets --app-h from the true visual viewport and keeps it updated.
 *
 * Why not bare 100dvh? On iOS PWA and iPad Safari, `dvh` tracks the layout
 * viewport and can disagree with the painted area (status bar, URL chrome,
 * landscape keyboard/toolbars). visualViewport.height / innerHeight match
 * what the user sees, so height-clamped shells clip correctly.
 */
function syncAppH() {
  const px = resolveAppHeightPx({
    innerHeight: window.innerHeight,
    visualViewportHeight: window.visualViewport?.height,
  });
  if (px > 0) {
    document.documentElement.style.setProperty("--app-h", `${px}px`);
  }
}

/**
 * Blocks Safari/Chrome pull-to-refresh on phone so the PartyServer socket
 * isn't nuked mid-game. Only cancels the rubber-band-at-top gesture;
 * normal scrolling inside .app-shell-scroll / .room-phase-scroll still works.
 */
export function NoPullToRefresh() {
  // Sync --app-h before layout; re-sync on orientation / resize / vv scroll.
  useEffect(() => {
    syncAppH();
    const onResize = () => syncAppH();
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
