"use client";

import { useEffect, useState } from "react";
import {
  acceptMergeCandidate,
  fetchMergeCandidates,
} from "@/lib/profile-stats";
import { resolveStableClientId } from "@/lib/client-id";
import { recallDisplayName } from "@/lib/party";
import type { MergeCandidate } from "@/shared/profile-store";

const DISMISS_KEY = "quarry:merge-dismiss:";

/**
 * Opt-in Safari ↔ home-screen merge. Never automatic.
 * Shows only when this device has no games but the nickname was seen recently
 * on another device that does.
 */
export function StatsMergePrompt({
  nickname,
}: {
  nickname?: string;
}) {
  const [candidate, setCandidate] = useState<MergeCandidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const id = await resolveStableClientId();
      if (cancelled) return;
      setDeviceId(id);
      const name = (nickname?.trim() || recallDisplayName()).trim();
      if (!name) return;
      try {
        if (sessionStorage.getItem(DISMISS_KEY + id) === "1") return;
      } catch {
        /* ignore */
      }
      const list = await fetchMergeCandidates({ deviceId: id, nickname: name });
      if (cancelled || list.length === 0) return;
      setCandidate(list[0]!);
    })();
    return () => {
      cancelled = true;
    };
  }, [nickname]);

  if (!candidate || !deviceId) return null;

  const label = candidate.nickname.trim() || "there";

  return (
    <div className="stats-merge-prompt" role="status">
      <p className="stats-merge-copy">
        Is this you, {label}? Keep your stats ({candidate.wins} win
        {candidate.wins === 1 ? "" : "s"} · {candidate.gamesPlayed} game
        {candidate.gamesPlayed === 1 ? "" : "s"}).
      </p>
      <div className="stats-merge-actions">
        <button
          type="button"
          className="btn-secondary px-[var(--space-3)]"
          disabled={busy}
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY + deviceId, "1");
            } catch {
              /* ignore */
            }
            setCandidate(null);
          }}
        >
          Not me
        </button>
        <button
          type="button"
          className="btn-primary px-[var(--space-3)]"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void (async () => {
              await acceptMergeCandidate({
                fromDeviceId: candidate.deviceId,
                toDeviceId: deviceId,
              });
              try {
                sessionStorage.setItem(DISMISS_KEY + deviceId, "1");
              } catch {
                /* ignore */
              }
              setCandidate(null);
              setBusy(false);
            })();
          }}
        >
          Keep my stats
        </button>
      </div>
    </div>
  );
}
