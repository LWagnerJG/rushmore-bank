/**
 * True visual viewport height for locking the app shell.
 *
 * Prefer visualViewport.height when it is a positive finite number — on iPad
 * Safari (portrait + landscape) and iOS PWAs it tracks the on-screen area more
 * reliably than layout-viewport 100dvh. Fall back to window.innerHeight.
 */
export function resolveAppHeightPx(input: {
  innerHeight: number;
  visualViewportHeight?: number | null;
}): number {
  const vv = input.visualViewportHeight;
  if (typeof vv === "number" && Number.isFinite(vv) && vv > 0) {
    return Math.round(vv);
  }
  const inner = input.innerHeight;
  if (typeof inner === "number" && Number.isFinite(inner) && inner > 0) {
    return Math.round(inner);
  }
  return 0;
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
