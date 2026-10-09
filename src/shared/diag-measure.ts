export type DiagRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  bottom: number;
};

export type DiagSnapshot = {
  buildSha: string;
  standalone: boolean;
  displayModeStandalone: boolean;
  innerHeight: number;
  innerWidth: number;
  visualViewportH: number;
  visualViewportW: number;
  visualViewportOffsetTop: number;
  visualViewportOffsetLeft: number;
  dvhPx: number;
  appHVar: string;
  safeTop: string;
  safeRight: string;
  safeBottom: string;
  safeLeft: string;
  htmlRect: DiagRect | null;
  bodyRect: DiagRect | null;
  appShellRect: DiagRect | null;
  phaseScrollRect: DiagRect | null;
  startBtnRect: DiagRect | null;
  phaseScrollClientH: number;
  phaseScrollScrollH: number;
  phaseScrollScrollTop: number;
  startBottomGap: number | null;
};

function fmtEnvPx(n: number): string {
  if (!Number.isFinite(n)) return "?";
  // env() probe padding resolves to px; keep one decimal for sub-pixel insets
  return `${n.toFixed(1)}px`;
}

export function rectOf(el: Element | null | undefined): DiagRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    bottom: r.bottom,
  };
}

/**
 * Read safe-area insets via computed padding on a fixed probe that uses
 * padding: env(safe-area-inset-*). getPropertyValue("env(...)") is unreliable.
 */
export function readSafeAreaViaProbe(doc: Document): {
  top: string;
  right: string;
  bottom: string;
  left: string;
} {
  const probe = doc.createElement("div");
  probe.setAttribute("data-diag-safe-probe", "1");
  probe.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "width:0",
    "height:0",
    "pointer-events:none",
    "visibility:hidden",
    "padding-top:env(safe-area-inset-top,0px)",
    "padding-right:env(safe-area-inset-right,0px)",
    "padding-bottom:env(safe-area-inset-bottom,0px)",
    "padding-left:env(safe-area-inset-left,0px)",
  ].join(";");
  doc.body.appendChild(probe);
  const cs = doc.defaultView?.getComputedStyle(probe);
  const out = {
    top: fmtEnvPx(parseFloat(cs?.paddingTop ?? "NaN")),
    right: fmtEnvPx(parseFloat(cs?.paddingRight ?? "NaN")),
    bottom: fmtEnvPx(parseFloat(cs?.paddingBottom ?? "NaN")),
    left: fmtEnvPx(parseFloat(cs?.paddingLeft ?? "NaN")),
  };
  probe.remove();
  return out;
}

export function measureDvhPx(doc: Document): number {
  const el = doc.createElement("div");
  el.style.cssText =
    "position:fixed;top:0;left:0;height:100dvh;width:0;pointer-events:none;visibility:hidden;";
  doc.body.appendChild(el);
  const h = el.getBoundingClientRect().height;
  el.remove();
  return h;
}

export function isStandaloneDisplay(nav: Navigator, win: Window): {
  legacyStandalone: boolean;
  displayModeStandalone: boolean;
} {
  const legacy =
    "standalone" in nav &&
    (nav as Navigator & { standalone?: boolean }).standalone === true;
  const display =
    typeof win.matchMedia === "function" &&
    win.matchMedia("(display-mode: standalone)").matches;
  return { legacyStandalone: legacy, displayModeStandalone: display };
}

/** Pure-ish DOM measure used by DiagPanel (and unit-tested with jsdom stubs). */
export function collectDiagSnapshot(input: {
  win: Window;
  doc: Document;
  buildSha: string;
}): DiagSnapshot {
  const { win, doc, buildSha } = input;
  const cs = win.getComputedStyle(doc.documentElement);
  const safe = readSafeAreaViaProbe(doc);
  const phaseScroll = doc.querySelector(".room-phase-scroll");
  const appShell = doc.querySelector(".app-shell");
  const startBtn =
    doc.querySelector("[data-diag='lobby-start']") ||
    doc.querySelector(".lobby-start-slot .btn-primary");
  const standalone = isStandaloneDisplay(win.navigator, win);
  const htmlRect = rectOf(doc.documentElement);
  const bodyRect = rectOf(doc.body);
  const startBtnRect = rectOf(startBtn);
  const vvH = win.visualViewport?.height ?? -1;

  return {
    buildSha,
    standalone: standalone.legacyStandalone || standalone.displayModeStandalone,
    displayModeStandalone: standalone.displayModeStandalone,
    innerHeight: win.innerHeight,
    innerWidth: win.innerWidth,
    visualViewportH: vvH,
    visualViewportW: win.visualViewport?.width ?? -1,
    visualViewportOffsetTop: win.visualViewport?.offsetTop ?? -1,
    visualViewportOffsetLeft: win.visualViewport?.offsetLeft ?? -1,
    dvhPx: measureDvhPx(doc),
    appHVar: cs.getPropertyValue("--app-h").trim() || "(not set)",
    safeTop: safe.top,
    safeRight: safe.right,
    safeBottom: safe.bottom,
    safeLeft: safe.left,
    htmlRect,
    bodyRect,
    appShellRect: rectOf(appShell),
    phaseScrollRect: rectOf(phaseScroll),
    startBtnRect,
    phaseScrollClientH: (phaseScroll as HTMLElement | null)?.clientHeight ?? -1,
    phaseScrollScrollH: (phaseScroll as HTMLElement | null)?.scrollHeight ?? -1,
    phaseScrollScrollTop: (phaseScroll as HTMLElement | null)?.scrollTop ?? -1,
    startBottomGap:
      startBtnRect && vvH > 0 ? vvH - startBtnRect.bottom : null,
  };
}

/** True when the Start control is clipped below the visual viewport. */
export function isStartButtonCutOff(snap: Pick<DiagSnapshot, "startBottomGap">): boolean {
  if (snap.startBottomGap == null) return false;
  return snap.startBottomGap < -1;
}
