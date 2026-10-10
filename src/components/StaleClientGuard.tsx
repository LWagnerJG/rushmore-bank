"use client";

import { useEffect, useRef, useState } from "react";
import { getPartyHost } from "@/lib/party";
import {
  detectStaleClient,
  staleReloadMessage,
  type StaleReason,
  type VersionPayload,
} from "@/shared/client-version";

const POLL_MS = 45_000;
const AUTO_RELOAD_MS = 1600;

function clientBuildSha(): string {
  return process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? "local";
}

async function fetchVersion(): Promise<VersionPayload | null> {
  try {
    const res = await fetch(`/api/version?t=${Date.now()}`, {
      cache: "no-store",
      headers: { Pragma: "no-cache" },
    });
    if (!res.ok) return null;
    return (await res.json()) as VersionPayload;
  } catch {
    return null;
  }
}

function inActiveRoomPath(): boolean {
  if (typeof window === "undefined") return false;
  return /\/room\/[A-Za-z0-9]+/i.test(window.location.pathname);
}

async function clearServiceWorkerCaches() {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations();
    await Promise.all(regs?.map((r) => r.unregister()) ?? []);
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
}

function hardReload(serverSha: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("_v", serverSha || String(Date.now()));
  window.location.replace(url.toString());
}

/**
 * Detects a mismatched build SHA or legacy PartyKit host vs /api/version.
 * Party-host mismatches hard-reload; mid-room build updates prompt softly.
 */
export function StaleClientGuard() {
  const [reason, setReason] = useState<StaleReason>(null);
  const [soft, setSoft] = useState(false);
  const [pendingSha, setPendingSha] = useState("");
  const reloading = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (reloading.current) return;
      const server = await fetchVersion();
      if (!server || cancelled) return;
      const result = detectStaleClient({
        clientSha: clientBuildSha(),
        clientPartyHost: getPartyHost(),
        server,
      });
      if (!result.stale) return;

      setReason(result.reason);
      setPendingSha(server.sha || "");

      // Wrong realtime host must hard-reload. Mid-game build updates stay soft.
      const forceHard =
        result.reason === "party-host" || !inActiveRoomPath();
      if (forceHard) {
        reloading.current = true;
        await clearServiceWorkerCaches();
        window.setTimeout(() => hardReload(server.sha), AUTO_RELOAD_MS);
        return;
      }
      setSoft(true);
    };

    void check();
    const t = window.setInterval(() => void check(), POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        /* optional */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);

  if (!reason) return null;

  if (soft) {
    return (
      <div className="stale-client-banner" role="status" aria-live="polite">
        <span>A newer Beans build is available.</span>{" "}
        <button
          type="button"
          className="underline font-bold"
          onClick={() => {
            reloading.current = true;
            void clearServiceWorkerCaches().then(() => hardReload(pendingSha));
          }}
        >
          Update after this round
        </button>
      </div>
    );
  }

  return (
    <div className="stale-client-banner" role="status" aria-live="assertive">
      {staleReloadMessage(reason)}
    </div>
  );
}
