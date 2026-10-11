"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RoomClient } from "@/components/RoomClient";
import {
  InAppInstallHint,
  InstallJoinScreen,
  JoinSplash,
  RoomEndedScreen,
} from "@/components/InstallJoinScreen";
import { useHydrated } from "@/hooks/useHydrated";
import { recallRoomSession } from "@/lib/party";
import {
  fetchRoomExists,
  hasContinuedInBrowser,
  isInstallJoinConsumed,
  markInstallJoinConsumed,
  recordContinueInBrowser,
  rememberContinuedInBrowser,
} from "@/shared/install-join";
import {
  detectJoinSurfaceFromWindow,
  isInstalledDisplay,
} from "@/shared/pwa-display";

export function JoinRoomEntry({
  code,
  presetName,
  preferSpectate,
}: {
  code: string;
  presetName: string;
  preferSpectate: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [continueBrowser, setContinueBrowser] = useState(false);
  const [roomExists, setRoomExists] = useState<boolean | null>(null);

  const surface = hydrated ? detectJoinSurfaceFromWindow() : null;
  const continued =
    continueBrowser || (hydrated && hasContinuedInBrowser(code));

  useEffect(() => {
    // Only the installed app checks existence — a fresh QR in Safari must
    // not see "That room has ended" while the host is still connecting.
    if (!hydrated || code.length !== 4 || !isInstalledDisplay()) return;
    let cancelled = false;
    void (async () => {
      const exists = await fetchRoomExists(code);
      if (cancelled) return;
      if (exists === false && isInstallJoinConsumed(code)) {
        router.replace("/");
        return;
      }
      setRoomExists(exists);
    })();
    return () => {
      cancelled = true;
    };
  }, [code, hydrated, router]);

  const onHome = useCallback(() => {
    markInstallJoinConsumed(code);
    router.replace("/");
  }, [code, router]);

  const onContinueInBrowser = useCallback(() => {
    rememberContinuedInBrowser(code);
    const count = recordContinueInBrowser();
    setContinueBrowser(true);
    void fetch("/api/metrics/install-continue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: code, count }),
      keepalive: true,
    }).catch(() => {
      /* logging only */
    });
  }, [code]);

  if (code.length !== 4) {
    return <RoomEndedScreen code={code} onHome={onHome} />;
  }

  if (roomExists === false) {
    return <RoomEndedScreen code={code} onHome={onHome} />;
  }

  if (!hydrated || surface === null) {
    return <JoinSplash code={code} />;
  }

  const session =
    typeof window !== "undefined" ? recallRoomSession(code) : null;
  const skipInstall =
    Boolean(presetName.trim()) ||
    Boolean(session) ||
    continued ||
    surface === "join";

  if (
    !skipInstall &&
    (surface === "install-ios" || surface === "install-android")
  ) {
    return (
      <InstallJoinScreen
        code={code}
        variant={surface}
        onContinueInBrowser={onContinueInBrowser}
      />
    );
  }

  return (
    <>
      {surface === "in-app" ? <InAppInstallHint /> : null}
      <RoomClient
        code={code}
        presetName={presetName}
        preferSpectate={preferSpectate}
      />
    </>
  );
}
