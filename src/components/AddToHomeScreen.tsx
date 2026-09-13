"use client";

import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const twa = window.matchMedia("(display-mode: fullscreen)").matches;
  return mq || iosStandalone || twa;
}

function isLikelyIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

/**
 * Discreet home-screen install affordance.
 * iOS has no install API — shows an in-UI tip. Chromium uses beforeinstallprompt when available.
 */
export function AddToHomeScreen() {
  const [hidden, setHidden] = useState(true);
  const [tipOpen, setTipOpen] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setHidden(true);
      return;
    }
    setHidden(false);
    setIos(isLikelyIos());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    const onInstalled = () => {
      setHidden(true);
      setTipOpen(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    const mq = window.matchMedia("(display-mode: standalone)");
    const onMode = () => {
      if (isStandaloneDisplay()) {
        setHidden(true);
        setTipOpen(false);
      }
    };
    mq.addEventListener?.("change", onMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener?.("change", onMode);
    };
  }, []);

  const openTip = useCallback(() => setTipOpen(true), []);
  const closeTip = useCallback(() => setTipOpen(false), []);

  const onInstallClick = useCallback(async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        await deferred.userChoice;
      } catch {
        /* user dismissed or browser blocked */
      }
      setDeferred(null);
      if (isStandaloneDisplay()) setHidden(true);
      return;
    }
    openTip();
  }, [deferred, openTip]);

  if (hidden) return null;

  const tipKind: "ios" | "android" = ios ? "ios" : "android";

  return (
    <div className="a2hs">
      <button type="button" className="a2hs-trigger" onClick={onInstallClick}>
        {deferred ? "Install app" : "Add to Home Screen"}
      </button>

      {tipOpen ? (
        <div
          className="a2hs-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="a2hs-title"
        >
          <div className="a2hs-sheet-card">
            <h2 id="a2hs-title" className="a2hs-sheet-title">
              Add Beans to your home screen
            </h2>
            {tipKind === "ios" ? (
              <ol className="a2hs-steps">
                <li>
                  Tap <ShareGlyph /> <strong>Share</strong> in Safari
                </li>
                <li>
                  Scroll and tap <strong>Add to Home Screen</strong>
                </li>
                <li>
                  Tap <strong>Add</strong>
                </li>
              </ol>
            ) : (
              <ol className="a2hs-steps">
                <li>
                  Open the browser menu (⋮ or ⋯)
                </li>
                <li>
                  Tap <strong>Install app</strong> or{" "}
                  <strong>Add to Home screen</strong>
                </li>
              </ol>
            )}
            <p className="a2hs-note">
              {tipKind === "ios"
                ? "Safari can’t one-tap install — those three steps are the way."
                : "If you don’t see Install, use Add to Home screen from the menu."}
            </p>
            <button type="button" className="btn-secondary a2hs-dismiss" onClick={closeTip}>
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ShareGlyph() {
  return (
    <svg
      className="a2hs-share-glyph"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden="true"
    >
      <path
        d="M12 3v10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M8 7l4-4 4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
