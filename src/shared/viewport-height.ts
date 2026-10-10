/**
 * True visual viewport height for locking the app shell.
 *
 * Prefer visualViewport.height when it is a positive finite number — on iPad
 * Safari (portrait + landscape) and iOS PWAs it tracks the on-screen area more
 * reliably than layout-viewport 100dvh. Fall back to window.innerHeight.
 *
 * Do NOT pass a keyboard-shrunk visualViewport height here — freeze the shell
 * instead (see stepKeyboardSession). Shrinking --app-h with the keyboard
 * fights fixed/100dvh shells and jumps the whole UI on iPhone Safari/PWA.
 */
export function resolveAppHeightPx(input: {
  innerHeight: number;
  visualViewportHeight?: number | null;
  /** When true, ignore visualViewport and use layout innerHeight only. */
  ignoreVisualViewport?: boolean;
}): number {
  if (!input.ignoreVisualViewport) {
    const vv = input.visualViewportHeight;
    if (typeof vv === "number" && Number.isFinite(vv) && vv > 0) {
      return Math.round(vv);
    }
  }
  const inner = input.innerHeight;
  if (typeof inner === "number" && Number.isFinite(inner) && inner > 0) {
    return Math.round(inner);
  }
  return 0;
}

export type ViewportSample = {
  innerHeight: number;
  innerWidth: number;
  visualViewportHeight?: number | null;
  visualViewportScale?: number | null;
};

/**
 * Keyboard session for the locked shell.
 *
 * iOS never shrinks the layout viewport for the software keyboard (and ignores
 * `interactive-widget`), it only shrinks/pans the visual viewport. So --app-h
 * must not follow visualViewport while a field is focused, nor while the
 * keyboard is still animating away after blur: the old blur-time resync shrank
 * the shell between mousedown and click, so a tap on "Lock in" landed on
 * <html> and needed a second tap.
 *
 * - idle: --app-h follows the visual viewport (toolbars, rotation, iPad).
 * - open: a field is focused; --app-h is frozen at its pre-keyboard value.
 * - closing: blurred, keyboard not gone yet; still frozen until the visual
 *   viewport is back to full height (or the close timeout fires).
 */
export type KeyboardSession =
  | { phase: "idle" }
  | { phase: "open" | "closing"; frozenPx: number; width: number };

export type KeyboardSessionEvent =
  | {
      type: "focus";
      viewport: ViewportSample;
      /** --app-h currently applied, if any. */
      currentAppHeightPx: number | null;
    }
  | { type: "blur" | "viewport" | "timeout"; viewport: ViewportSample };

export type KeyboardSessionStep = {
  session: KeyboardSession;
  /** New --app-h in px; null leaves --app-h untouched. */
  appHeightPx: number | null;
  /** The session ended on this step (clear any residual page offset once). */
  ended: boolean;
};

/** Upper bound on waiting for the keyboard to report closed after blur. */
export const KEYBOARD_CLOSE_TIMEOUT_MS = 1000;

const FULL_HEIGHT_SLACK_PX = 2;
const PINCH_ZOOM_SCALE = 1.01;

function pinchZoomed(v: ViewportSample): boolean {
  const scale = v.visualViewportScale;
  return typeof scale === "number" && scale > PINCH_ZOOM_SCALE;
}

/** --app-h outside a keyboard session; null while pinch-zoomed. */
export function idleAppHeightPx(v: ViewportSample): number | null {
  if (pinchZoomed(v)) return null;
  const px = resolveAppHeightPx({
    innerHeight: v.innerHeight,
    visualViewportHeight: v.visualViewportHeight,
  });
  return px > 0 ? px : null;
}

/** Nothing (keyboard, zoom) is covering part of the layout viewport. */
function visualMatchesLayout(v: ViewportSample): boolean {
  const vv = v.visualViewportHeight;
  if (typeof vv !== "number" || !Number.isFinite(vv) || vv <= 0) return true;
  if (pinchZoomed(v)) return false;
  return vv >= v.innerHeight - FULL_HEIGHT_SLACK_PX;
}

/** Visual viewport is back to full height (no keyboard, no zoom). */
export function keyboardGone(v: ViewportSample, frozenPx: number): boolean {
  if (!visualMatchesLayout(v)) return false;
  const vv = v.visualViewportHeight;
  if (typeof vv !== "number" || !Number.isFinite(vv) || vv <= 0) return true;
  return vv >= frozenPx - FULL_HEIGHT_SLACK_PX;
}

export function stepKeyboardSession(
  session: KeyboardSession,
  event: KeyboardSessionEvent,
): KeyboardSessionStep {
  const v = event.viewport;

  if (session.phase === "idle") {
    if (event.type === "focus") {
      const current = event.currentAppHeightPx;
      const known =
        typeof current === "number" && Number.isFinite(current) && current > 0;
      const frozenPx = known
        ? Math.round(current)
        : resolveAppHeightPx({
            innerHeight: v.innerHeight,
            ignoreVisualViewport: true,
          });
      return {
        session: { phase: "open", frozenPx, width: v.innerWidth },
        appHeightPx: !known && frozenPx > 0 ? frozenPx : null,
        ended: false,
      };
    }
    if (event.type === "viewport") {
      return { session, appHeightPx: idleAppHeightPx(v), ended: false };
    }
    return { session, appHeightPx: null, ended: false };
  }

  let next = session;
  let appHeightPx: number | null = null;
  // Rotated mid-session: re-freeze at the new layout height, never the
  // keyboard-shrunk visual viewport.
  if (event.type !== "timeout" && v.innerWidth > 0 && v.innerWidth !== next.width) {
    const px = resolveAppHeightPx({
      innerHeight: v.innerHeight,
      ignoreVisualViewport: true,
    });
    if (px > 0) {
      next = { ...next, frozenPx: px, width: v.innerWidth };
      appHeightPx = px;
    }
  }

  // A timeout can end the session below the frozen height (toolbar change
  // mid-session); take the settled height then, but never a keyboard frame.
  const end = (): KeyboardSessionStep => ({
    session: { phase: "idle" },
    appHeightPx: visualMatchesLayout(v) ? idleAppHeightPx(v) : appHeightPx,
    ended: true,
  });

  switch (event.type) {
    case "focus":
      return { session: { ...next, phase: "open" }, appHeightPx, ended: false };
    case "blur":
      return keyboardGone(v, next.frozenPx)
        ? end()
        : { session: { ...next, phase: "closing" }, appHeightPx, ended: false };
    case "viewport":
      if (next.phase === "closing" && keyboardGone(v, next.frozenPx)) {
        return end();
      }
      return { session: next, appHeightPx, ended: false };
    case "timeout":
      return next.phase === "closing"
        ? end()
        : { session: next, appHeightPx: null, ended: false };
  }
}

type EditableLike = {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
};

/** True when document.activeElement is a text-entry control. */
export function isEditableElement(
  el: EventTarget | null | undefined,
): el is HTMLElement {
  if (!el || typeof el !== "object") return false;
  const node = el as EditableLike;
  const tag = node.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (node.type || "text").toLowerCase();
    // Non-text inputs do not open the full keyboard / zoom path.
    if (
      type === "button" ||
      type === "submit" ||
      type === "reset" ||
      type === "checkbox" ||
      type === "radio" ||
      type === "file" ||
      type === "range" ||
      type === "color" ||
      type === "hidden" ||
      type === "image"
    ) {
      return false;
    }
    return true;
  }
  return Boolean(node.isContentEditable);
}

type ScrollportLike = {
  getBoundingClientRect: () => {
    top: number;
    bottom: number;
  };
  scrollTop: number;
};

type FocusTargetLike = {
  getBoundingClientRect: () => {
    top: number;
    bottom: number;
  };
  closest: (selector: string) => ScrollportLike | null;
};

/**
 * Scroll a focused control into view inside the nearest app scrollport only.
 * Never scrolls the document (html/body stay locked).
 */
export function scrollEditableIntoAppScroll(
  el: FocusTargetLike,
  fallbackContainer?: ScrollportLike | null,
): void {
  const container =
    el.closest(".room-phase-scroll, .app-shell-scroll") ??
    fallbackContainer ??
    null;
  if (!container) return;

  const cRect = container.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  const pad = 16;
  if (eRect.bottom > cRect.bottom - pad) {
    container.scrollTop += eRect.bottom - cRect.bottom + pad;
  } else if (eRect.top < cRect.top + pad) {
    container.scrollTop -= cRect.top - eRect.top + pad;
  }
}

/** Coarse iPad / iPadOS-desktop-UA heuristic (no userAgentData required). */
export function looksLikeIpad(input: {
  userAgent: string;
  maxTouchPoints: number;
}): boolean {
  const ua = input.userAgent;
  if (/iPad/.test(ua)) return true;
  // iPadOS 13+ can report as Macintosh with touch
  return input.maxTouchPoints > 1 && /Macintosh/.test(ua);
}
