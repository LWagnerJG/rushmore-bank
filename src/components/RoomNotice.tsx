"use client";

import { useEffect, useState } from "react";

const DISMISS_MS = 2800;

/**
 * Small, muted room notice that auto-dismisses.
 * Used for admin flashes like "Admin · added 2 fake players".
 * Host-only by default — players never see admin chrome.
 */
export function RoomNotice({
  notice,
  hostOnly = false,
  isHost = false,
}: {
  notice: string | null | undefined;
  hostOnly?: boolean;
  isHost?: boolean;
}) {
  const [shown, setShown] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const allowed = !hostOnly || isHost;

  useEffect(() => {
    if (!notice || !allowed) {
      setShown(null);
      setLeaving(false);
      return;
    }
    setShown(notice);
    setLeaving(false);
    const leaveAt = window.setTimeout(() => setLeaving(true), DISMISS_MS - 320);
    const clearAt = window.setTimeout(() => {
      setShown(null);
      setLeaving(false);
    }, DISMISS_MS);
    return () => {
      window.clearTimeout(leaveAt);
      window.clearTimeout(clearAt);
    };
  }, [notice, allowed]);

  if (!shown || !allowed) return null;

  return (
    <p
      className={`room-notice${leaving ? " room-notice-leave" : ""}`}
      role="status"
      aria-live="polite"
    >
      {shown}
    </p>
  );
}
