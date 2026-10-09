"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { FINAL_ROUND_CUE_MS } from "@/shared/final-round-cue";

/**
 * Short, tasteful full-viewport beat before the last topic round.
 * Phone-first motion; auto-dismisses. Respects prefers-reduced-motion via CSS.
 *
 * Must unmount (return null) when done — never leave a fixed full-viewport
 * veil at opacity:0, which iOS WebKit can keep as a soft composited layer.
 */
export function FinalRoundCue({
  active,
  onDone,
}: {
  active: boolean;
  onDone?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const notifyDone = useEffectEvent(() => {
    onDone?.();
  });

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      notifyDone();
    }, FINAL_ROUND_CUE_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  if (!visible) return null;

  return (
    <div
      className="final-round-cue"
      role="status"
      aria-live="polite"
      aria-label="Final round"
    >
      <div className="final-round-cue-card">
        <p className="final-round-cue-kicker">Last topic</p>
        <p className="final-round-cue-title">Final round!</p>
      </div>
    </div>
  );
}
