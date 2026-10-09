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

/**
 * Detects a mismatched build SHA or legacy PartyKit host vs /api/version,
 * prompts, then hard-reloads so a cached SW/bundle cannot stick forever.
 */
export function StaleClientGuard() {
  const [reason, setReason] = useState<StaleReason>(null);
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
      if (result.stale) {
        setReason(result.reason);
        reloading.current = true;
        // Drop waiting SW so the next navigation gets the fresh bundle.
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
        window.setTimeout(() => {
          const url = new URL(window.location.href);
          url.searchParams.set("_v", server.sha || String(Date.now()));
          window.location.replace(url.toString());
        }, AUTO_RELOAD_MS);
      }
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
    // Register after load so it never races first paint.
    const onLoad = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        /* optional */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);

  if (!reason) return null;

  return (
    <div className="stale-client-banner" role="status" aria-live="assertive">
      {staleReloadMessage(reason)}
    </div>
  );
}
