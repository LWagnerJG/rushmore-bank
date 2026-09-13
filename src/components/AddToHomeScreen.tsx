"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** True when running as an installed PWA (any display mode the manifest may use). */
function isInstalledDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const modes = ["standalone", "fullscreen", "minimal-ui"] as const;
  if (modes.some((m) => window.matchMedia(`(display-mode: ${m})`).matches)) {
    return true;
  }
  return (
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
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
 * Single discreet home-screen install control.
 * Chromium: one tap → beforeinstallprompt when available.
 * Otherwise: one-line nudge (no tutorial overlay). Hidden when installed.
 */
export function AddToHomeScreen() {
  const [hidden, setHidden] = useState(true);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [ios, setIos] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const nudgeId = useId();

  useEffect(() => {
    if (isInstalledDisplay()) {
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
      setNudgeOpen(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    const mqs = ["standalone", "fullscreen", "minimal-ui"].map((m) =>
      window.matchMedia(`(display-mode: ${m})`),
    );
    const onMode = () => {
      if (isInstalledDisplay()) {
        setHidden(true);
        setNudgeOpen(false);
      }
    };
    for (const mq of mqs) mq.addEventListener?.("change", onMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      for (const mq of mqs) mq.removeEventListener?.("change", onMode);
    };
  }, []);

  const onInstallClick = useCallback(async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        await deferred.userChoice;
      } catch {
        /* dismissed / blocked */
      }
      setDeferred(null);
      if (isInstalledDisplay()) setHidden(true);
      return;
    }
    setNudgeOpen((open) => !open);
  }, [deferred]);

  const dismissNudge = useCallback(() => {
    setNudgeOpen(false);
    triggerRef.current?.focus();
  }, []);

  if (hidden) return null;

  // iOS Safari: Share is under ⋯ (typically bottom right), not the old bottom Share bar.
  const nudgeText = ios
    ? "⋯ (bottom right) → Share → Add to Home Screen."
    : "Browser menu → Install or Add to Home Screen.";

  return (
    <div className="a2hs">
      <button
        ref={triggerRef}
        type="button"
        className="a2hs-trigger"
        onClick={onInstallClick}
        aria-expanded={deferred ? undefined : nudgeOpen}
        aria-controls={deferred ? undefined : nudgeId}
      >
        {deferred ? "Install app" : "Add to Home Screen"}
      </button>

      {nudgeOpen && !deferred ? (
        <p id={nudgeId} className="a2hs-nudge" role="status">
          {nudgeText}{" "}
          <button
            type="button"
            className="a2hs-nudge-dismiss"
            onClick={dismissNudge}
          >
            OK
          </button>
        </p>
      ) : null}
    </div>
  );
}
