import { describe, expect, it } from "vitest";
import {
  CONTINUE_IN_BROWSER_COUNT_KEY,
  fetchRoomExists,
  hasContinuedInBrowser,
  invitePath,
  inviteUrl,
  isInstallJoinConsumed,
  markInstallJoinConsumed,
  readContinueInBrowserCount,
  recordContinueInBrowser,
  rememberContinuedInBrowser,
} from "../install-join";
import {
  detectJoinSurface,
  isInAppBrowser,
  isInstalledDisplay,
  isLikelyIos,
  isLikelyMobile,
} from "../pwa-display";

function memoryStorage(init: Record<string, string> = {}) {
  const data = { ...init };
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe("invite URLs", () => {
  it("canonical join path carries the room", () => {
    expect(invitePath("ab-cd")).toBe("/join/ABCD");
    expect(inviteUrl("https://beans-web.example", "ABCD")).toBe(
      "https://beans-web.example/join/ABCD",
    );
  });
});

describe("install-first surface", () => {
  it("detects standalone via matchMedia or iOS navigator.standalone", () => {
    expect(
      isInstalledDisplay({
        matchMedia: (q) => ({ matches: q.includes("standalone") }),
      }),
    ).toBe(true);
    expect(
      isInstalledDisplay({
        matchMedia: () => ({ matches: false }),
        standalone: true,
      }),
    ).toBe(true);
    expect(
      isInstalledDisplay({
        matchMedia: () => ({ matches: false }),
        standalone: false,
      }),
    ).toBe(false);
  });

  it("gates mobile Safari / Android and lets desktop + in-app through", () => {
    const iphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const android =
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    const instagram = `${iphone} Instagram 192.0.0.0.0`;
    expect(isLikelyIos(iphone)).toBe(true);
    expect(isLikelyMobile(android)).toBe(true);
    expect(isInAppBrowser(instagram)).toBe(true);
    expect(
      detectJoinSurface({
        standalone: false,
        mobile: true,
        ios: true,
        inAppBrowser: false,
      }),
    ).toBe("install-ios");
    expect(
      detectJoinSurface({
        standalone: false,
        mobile: true,
        ios: false,
        inAppBrowser: false,
      }),
    ).toBe("install-android");
    expect(
      detectJoinSurface({
        standalone: false,
        mobile: true,
        ios: true,
        inAppBrowser: true,
      }),
    ).toBe("in-app");
    expect(
      detectJoinSurface({
        standalone: true,
        mobile: true,
        ios: true,
        inAppBrowser: false,
      }),
    ).toBe("join");
    expect(
      detectJoinSurface({
        standalone: false,
        mobile: false,
        ios: false,
        inAppBrowser: false,
      }),
    ).toBe("join");
  });
});

describe("continue-in-browser counter + consumed flag", () => {
  it("increments a persistent counter and remembers the session escape", () => {
    const local = memoryStorage();
    const session = memoryStorage();
    expect(recordContinueInBrowser(local)).toBe(1);
    expect(recordContinueInBrowser(local)).toBe(2);
    expect(readContinueInBrowserCount(local)).toBe(2);
    expect(local.getItem(CONTINUE_IN_BROWSER_COUNT_KEY)).toBe("2");
    expect(hasContinuedInBrowser("ABCD", session)).toBe(false);
    rememberContinuedInBrowser("ab-cd", session);
    expect(hasContinuedInBrowser("ABCD", session)).toBe(true);
  });

  it("stores consumed in the PWA's own storage", () => {
    const local = memoryStorage();
    expect(isInstallJoinConsumed("ABCD", local)).toBe(false);
    markInstallJoinConsumed("ABCD", local);
    expect(isInstallJoinConsumed("abcd", local)).toBe(true);
  });
});

describe("room exists probe", () => {
  it("treats exists:false as gone and network errors as joinable", async () => {
    expect(
      await fetchRoomExists("ABCD", async () =>
        new Response(JSON.stringify({ exists: false })),
      ),
    ).toBe(false);
    expect(
      await fetchRoomExists("ABCD", async () => {
        throw new Error("offline");
      }),
    ).toBe(true);
    expect(await fetchRoomExists("AB")).toBe(false);
  });
});
