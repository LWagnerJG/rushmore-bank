"use client";

import { useEffect } from "react";
import {
  isEditableElement,
  KEYBOARD_CLOSE_TIMEOUT_MS,
  stepKeyboardSession,
  type KeyboardSession,
  type KeyboardSessionEvent,
  type ViewportSample,
} from "@/shared/viewport-height";

function sampleViewport(): ViewportSample {
  return {
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    visualViewportHeight: window.visualViewport?.height,
    visualViewportScale: window.visualViewport?.scale,
  };
}

/**
 * Blocks Safari/Chrome pull-to-refresh on phone so the PartyServer socket
 * isn't nuked mid-game. Only cancels the rubber-band-at-top gesture;
 * normal scrolling inside .app-shell-scroll / .room-phase-scroll still works.
 *
 * Also owns --app-h and iOS keyboard hygiene (see stepKeyboardSession):
 * --app-h never moves while a field is focused or the keyboard is closing,
 * and the page is never scrolled during a keyboard session. Inputs stay
 * clear of the keyboard by layout (they sit in the upper part of the
 * screen), so iOS has nothing to pan.
 */
export function NoPullToRefresh() {
  useEffect(() => {
    const root = document.documentElement;
    let session: KeyboardSession = { phase: "idle" };
    let appHeightPx: number | null = null;
    let closeTimer: number | null = null;

    const apply = (event: KeyboardSessionEvent) => {
      const step = stepKeyboardSession(session, event);
      session = step.session;
      if (step.appHeightPx != null && step.appHeightPx !== appHeightPx) {
        appHeightPx = step.appHeightPx;
        root.style.setProperty("--app-h", `${appHeightPx}px`);
      }
      if (session.phase !== "closing" && closeTimer != null) {
        window.clearTimeout(closeTimer);
        closeTimer = null;
      } else if (session.phase === "closing" && closeTimer == null) {
        closeTimer = window.setTimeout(() => {
          closeTimer = null;
          apply({ type: "timeout", viewport: sampleViewport() });
        }, KEYBOARD_CLOSE_TIMEOUT_MS);
      }
      // Only after the keyboard is gone, and only if iOS left an offset.
      if (
        step.ended &&
        (window.scrollY !== 0 || (window.visualViewport?.offsetTop ?? 0) > 0.5)
      ) {
        window.scrollTo(0, 0);
      }
    };

    const onViewport = () => {
      // A focused field that unmounts never fires focusout.
      if (session.phase === "open" && !isEditableElement(document.activeElement)) {
        apply({ type: "blur", viewport: sampleViewport() });
        return;
      }
      apply({ type: "viewport", viewport: sampleViewport() });
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!isEditableElement(e.target)) return;
      apply({
        type: "focus",
        viewport: sampleViewport(),
        currentAppHeightPx: appHeightPx,
      });
    };
    const onFocusOut = (e: FocusEvent) => {
      if (session.phase === "idle" || isEditableElement(e.relatedTarget)) return;
      // relatedTarget is null for taps on non-focusable UI; let focus settle.
      window.setTimeout(() => {
        if (session.phase === "idle" || isEditableElement(document.activeElement))
          return;
        apply({ type: "blur", viewport: sampleViewport() });
      }, 0);
    };

    apply({ type: "viewport", viewport: sampleViewport() });
    // autoFocus fields can focus before this effect subscribes.
    if (isEditableElement(document.activeElement)) {
      apply({
        type: "focus",
        viewport: sampleViewport(),
        currentAppHeightPx: appHeightPx,
      });
    }
    window.addEventListener("resize", onViewport);
    window.addEventListener("orientationchange", onViewport);
    window.visualViewport?.addEventListener("resize", onViewport);
    window.visualViewport?.addEventListener("scroll", onViewport);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      if (closeTimer != null) window.clearTimeout(closeTimer);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("orientationchange", onViewport);
      window.visualViewport?.removeEventListener("resize", onViewport);
      window.visualViewport?.removeEventListener("scroll", onViewport);
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
