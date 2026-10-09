/**
 * True visual viewport height for locking the app shell.
 *
 * Prefer visualViewport.height when it is a positive finite number — on iPad
 * Safari (portrait + landscape) and iOS PWAs it tracks the on-screen area more
 * reliably than layout-viewport 100dvh. Fall back to window.innerHeight.
 *
 * Do NOT pass a keyboard-shrunk visualViewport height here — freeze the shell
 * instead (see shouldFreezeAppHeight). Shrinking --app-h with the keyboard
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

/**
 * Keyboard open heuristic for iOS Safari / standalone PWA.
 *
 * Browser chrome changes shrink visualViewport by tens of px; the software
 * keyboard typically shrinks by >150px and/or bumps offsetTop while an
 * editable field is focused. Freeze --app-h in that case so the shell does
 * not resize under the keyboard.
 */
export function shouldFreezeAppHeight(input: {
  innerHeight: number;
  visualViewportHeight?: number | null;
  visualViewportOffsetTop?: number | null;
  editableFocused: boolean;
}): boolean {
  if (!input.editableFocused) return false;
  const vv = input.visualViewportHeight;
  const inner = input.innerHeight;
  if (
    typeof vv !== "number" ||
    !Number.isFinite(vv) ||
    vv <= 0 ||
    typeof inner !== "number" ||
    !Number.isFinite(inner) ||
    inner <= 0
  ) {
    return false;
  }
  const offset =
    typeof input.visualViewportOffsetTop === "number" &&
    Number.isFinite(input.visualViewportOffsetTop)
      ? input.visualViewportOffsetTop
      : 0;
  if (offset > 20) return true;
  return inner - vv > 150;
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
