"use client";

import { useEffect, useRef, useState } from "react";

export const ERROR_TOAST_MS = 2500;

/**
 * Coral game-error toast — overlays chrome, auto-dismisses, no layout shift.
 * Dedupes identical messages while visible (no re-flash / timer restart).
 */
export function ErrorToast({
  error,
  onDismiss,
}: {
  error: string | null;
  onDismiss: () => void;
}) {
  const [shown, setShown] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const shownRef = useRef<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!error) return;
    // Dedupe: same copy already on screen — ignore the repeat.
    if (shownRef.current === error) return;

    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    if (clearTimer.current) clearTimeout(clearTimer.current);

    shownRef.current = error;
    setShown(error);
    setLeaving(false);

    leaveTimer.current = setTimeout(() => setLeaving(true), ERROR_TOAST_MS - 280);
    clearTimer.current = setTimeout(() => {
      shownRef.current = null;
      setShown(null);
      setLeaving(false);
      onDismiss();
    }, ERROR_TOAST_MS);

    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, [error, onDismiss]);

  if (!shown) return null;

  return (
    <div
      className={`error-toast${leaving ? " error-toast-leave" : ""}`}
      role="alert"
      aria-live="assertive"
    >
      {shown}
    </div>
  );
}
