"use client";

import { useEffect } from "react";

/**
 * Sets --app-h to window.innerHeight and keeps it updated.
 *
 * Why not 100dvh?  In iOS PWA (Add to Home Screen) mode the CSS `dvh` unit
 * maps to the layout viewport, which on notched / Dynamic Island iPhones can
 * be shorter than the real visual extent by the status-bar height (~47–59 px).
 * `window.innerHeight` always equals the actual rendered height so using it as
 * the source of --app-h gives the true viewport size.  All height-clamped
 * containers (html, body, .app-shell) read var(--app-h, 100dvh) so they clip
 * at the correct boundary instead of slicing content at the bottom.
 */
function syncAppH() {
  document.documentElement.style.setProperty(
    "--app-h",
    `${window.innerHeight}px`,
  );
}

/**
 * Blocks Safari/Chrome pull-to-refresh on phone so the PartyKit socket
 * isn't nuked mid-game. Only cancels the rubber-band-at-top gesture;
 * normal scrolling inside .app-shell-scroll / .room-phase-scroll still works.
 */
export function NoPullToRefresh() {
  // Sync --app-h before layout; re-sync on orientation / resize.
  useEffect(() => {
    syncAppH();
    window.addEventListener("resize", syncAppH);
    return () => window.removeEventListener("resize", syncAppH);
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
