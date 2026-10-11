export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Installed PWA: standalone (or iOS `navigator.standalone`). */
export function isInstalledDisplay(input?: {
  matchMedia?: (query: string) => { matches: boolean };
  standalone?: boolean;
}): boolean {
  const matchMedia =
    input?.matchMedia ??
    (typeof window !== "undefined" ? window.matchMedia.bind(window) : undefined);
  if (matchMedia) {
    const modes = ["standalone", "fullscreen", "minimal-ui"] as const;
    if (modes.some((m) => matchMedia(`(display-mode: ${m})`).matches)) {
      return true;
    }
  }
  if (typeof input?.standalone === "boolean") return input.standalone;
  if (typeof navigator !== "undefined" && "standalone" in navigator) {
    return Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  }
  return false;
}

export function isLikelyIos(ua: string, maxTouchPoints = 0): boolean {
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = /Macintosh|MacIntel/.test(ua) && maxTouchPoints > 1;
  return iOS || iPadOs;
}

export function isLikelyAndroid(ua: string): boolean {
  return /Android/i.test(ua);
}

export function isLikelyMobile(ua: string, maxTouchPoints = 0): boolean {
  if (isLikelyIos(ua, maxTouchPoints)) return true;
  if (/Android.+Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  if (/Android/i.test(ua)) return true;
  return false;
}

/**
 * In-app browsers (Instagram / Snapchat / Facebook / TikTok, …).
 * Don't block join — they can't reliably Add to Home Screen.
 */
export function isInAppBrowser(ua: string): boolean {
  return (
    /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Snapchat|TikTok|BytedanceWebview|musical_ly|Twitter|LinkedInApp|WhatsApp|Line\/|MicroMessenger|Pinterest|Discord/i.test(
      ua,
    ) || /; wv\)/.test(ua)
  );
}

export type JoinSurface =
  | "install-ios"
  | "install-android"
  | "in-app"
  | "join";

export function detectJoinSurface(input: {
  standalone: boolean;
  mobile: boolean;
  ios: boolean;
  inAppBrowser: boolean;
}): JoinSurface {
  if (input.standalone) return "join";
  if (!input.mobile) return "join";
  if (input.inAppBrowser) return "in-app";
  if (input.ios) return "install-ios";
  return "install-android";
}

export function detectJoinSurfaceFromWindow(
  win: Pick<Window, "matchMedia" | "navigator"> = window,
): JoinSurface {
  const ua = win.navigator.userAgent;
  const touch = win.navigator.maxTouchPoints ?? 0;
  return detectJoinSurface({
    standalone: isInstalledDisplay({
      matchMedia: win.matchMedia.bind(win),
      standalone: (win.navigator as Navigator & { standalone?: boolean })
        .standalone,
    }),
    mobile: isLikelyMobile(ua, touch),
    ios: isLikelyIos(ua, touch),
    inAppBrowser: isInAppBrowser(ua),
  });
}
