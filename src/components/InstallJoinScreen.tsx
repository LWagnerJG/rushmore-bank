"use client";

import { useCallback, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { MotionSettle } from "@/components/MotionSettle";
import type { BeforeInstallPromptEvent } from "@/shared/pwa-display";

export function InstallJoinScreen({
  code,
  variant,
  onContinueInBrowser,
}: {
  code: string;
  variant: "install-ios" | "install-android";
  onContinueInBrowser: () => void;
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* dismissed */
    }
    setDeferred(null);
  }, [deferred]);

  return (
    <main className="app-shell app-shell-lock install-join mx-auto flex max-w-md flex-col pt-0">
      <div className="app-safe-top" aria-hidden="true" />
      <MotionSettle
        motionClass="animate-rise"
        className="install-join-inner flex min-h-0 flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6"
      >
        <header className="install-join-hero flex flex-col items-center text-center">
          <BrandMark hero />
          <p className="install-join-code type-display mt-5 tracking-[0.28em]">
            {code}
          </p>
          <h1 className="install-join-headline type-body mt-4 font-[family-name:var(--font-display)] font-extrabold tracking-tight">
            Add Beans to your Home Screen to join
          </h1>
        </header>

        {variant === "install-ios" ? (
          <ol className="install-join-steps">
            <li>
              <ShareGlyph />
              <span>Share</span>
            </li>
            <li>
              <PlusGlyph />
              <span>Add to Home Screen</span>
            </li>
            <li>
              <OpenGlyph />
              <span>Open Beans</span>
            </li>
          </ol>
        ) : (
          <div className="install-join-android">
            {deferred ? (
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => void onInstall()}
              >
                Install
              </button>
            ) : (
              <p className="type-meta text-center text-[var(--muted)]">
                Browser menu → Install app
              </p>
            )}
          </div>
        )}

        <div className="install-join-footer">
          {variant === "install-ios" ? (
            <div className="install-share-arrow" aria-hidden="true">
              <ArrowDownGlyph />
            </div>
          ) : null}
          <button
            type="button"
            className="install-continue"
            onClick={onContinueInBrowser}
          >
            Continue in browser
          </button>
        </div>
      </MotionSettle>
    </main>
  );
}

export function JoinSplash({ code }: { code: string }) {
  return (
    <main className="app-shell app-shell-lock install-join mx-auto flex max-w-md flex-col pt-0">
      <div className="app-safe-top" aria-hidden="true" />
      <div className="install-join-inner flex min-h-0 flex-1 flex-col items-center px-4 pt-6">
        <BrandMark hero />
        <p className="install-join-code type-display mt-5 tracking-[0.28em]">
          {code}
        </p>
      </div>
    </main>
  );
}

export function RoomEndedScreen({
  onHome,
}: {
  code?: string;
  onHome: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onHome, 2200);
    return () => window.clearTimeout(t);
  }, [onHome]);

  return (
    <main className="app-shell app-shell-lock install-join mx-auto flex max-w-md flex-col pt-0">
      <div className="app-safe-top" aria-hidden="true" />
      <div className="install-join-inner flex min-h-0 flex-1 flex-col items-center px-4 pt-6 text-center">
        <BrandMark hero />
        <p className="type-body mt-8 font-[family-name:var(--font-display)] font-extrabold tracking-tight">
          That room has ended
        </p>
        <button type="button" className="install-continue mt-6" onClick={onHome}>
          Home
        </button>
      </div>
    </main>
  );
}

export function InAppInstallHint() {
  return (
    <p className="install-inapp-hint type-meta" role="note">
      Open in Safari to install
    </p>
  );
}

function ShareGlyph() {
  return (
    <svg
      className="install-step-glyph"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
    >
      <path
        d="M12 4v10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M8.2 7.4 12 3.6l3.8 3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 13.5v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusGlyph() {
  return (
    <svg
      className="install-step-glyph"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="5"
        width="14"
        height="14"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 8.5v7M8.5 12h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function OpenGlyph() {
  return (
    <svg
      className="install-step-glyph"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 8.5v5.2l3 1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowDownGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M12 5v12M7.5 13.5 12 18l4.5-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
