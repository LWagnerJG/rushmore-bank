"use client";

import { useEffect, useState } from "react";
import {
  hostAiPreGameLine,
  type JudgeHealthProbe,
} from "@/shared/host-ai-pregame";

/**
 * Host-only muted AI availability line for pre-game (lobby / first topic).
 * Probes GET /api/judge — never shown to players, never in the header chrome.
 */
export function HostAiPreGameStatus() {
  const [probe, setProbe] = useState<JudgeHealthProbe | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/judge", {
          method: "GET",
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setProbe({ available: false, model: null });
          return;
        }
        const data = (await res.json()) as {
          available?: boolean;
          model?: string | null;
        };
        if (!cancelled) {
          setProbe({
            available: !!data.available,
            model: typeof data.model === "string" ? data.model : null,
          });
        }
      } catch {
        if (!cancelled && !ctrl.signal.aborted) {
          setProbe({ available: false, model: null });
        }
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  const line = hostAiPreGameLine(probe);
  if (!line) return null;

  return (
    <p className="host-ai-pregame" role="status">
      {line}
    </p>
  );
}
