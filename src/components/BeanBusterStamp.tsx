"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  BEAN_BUSTER_STAMP_TOTAL_MS,
  beanBusterStampCaption,
  beanBusterStampRotationDeg,
} from "@/shared/bean-buster-stamp";

/**
 * Abrupt full-viewport rubber-stamp on a dice bust.
 * Instant appear (no fade-in), slam + optional shake, hold, snap away.
 * pointer-events: none — never blocks rolls, bank, or timers.
 * Unmounts when done (no opacity:0 fixed veil left behind).
 */
export function BeanBusterStamp({
  active,
  rollId,
  rollerName,
  isYou,
  reducedMotion,
}: {
  active: boolean;
  rollId: string | null;
  rollerName: string;
  isYou: boolean;
  reducedMotion: boolean;
}) {
  const [visibleRollId, setVisibleRollId] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !rollId) {
      setVisibleRollId(null);
      return;
    }
    setVisibleRollId(rollId);
    const t = window.setTimeout(() => {
      setVisibleRollId((cur) => (cur === rollId ? null : cur));
    }, BEAN_BUSTER_STAMP_TOTAL_MS);
    return () => window.clearTimeout(t);
  }, [active, rollId]);

  const rotation = useMemo(
    () => (visibleRollId ? beanBusterStampRotationDeg(visibleRollId) : -9),
    [visibleRollId],
  );

  if (!visibleRollId) return null;

  const caption = beanBusterStampCaption(rollerName, isYou);

  return (
    <div
      className={[
        "bean-buster-stamp",
        reducedMotion ? "bean-buster-stamp-reduced" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="assertive"
      aria-label={`BEAN BUSTER. ${caption}`}
      data-testid="bean-buster-stamp"
      data-roll-id={visibleRollId}
      style={{ "--bean-buster-rot": `${rotation}deg` } as CSSProperties}
    >
      {/* Distressed-ink SVG filter — no heavy images */}
      <svg
        className="bean-buster-stamp-defs"
        aria-hidden="true"
        focusable="false"
        width="0"
        height="0"
      >
        <filter
          id="bean-buster-distress"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="3"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="3.5"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displaced"
          />
          <feColorMatrix
            in="displaced"
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 0.92 0"
          />
        </filter>
      </svg>

      <div className="bean-buster-stamp-wash" aria-hidden="true" />

      <div className="bean-buster-stamp-mark">
        <p className="bean-buster-stamp-title">BEAN BUSTER</p>
        <p className="bean-buster-stamp-caption">{caption}</p>
      </div>
    </div>
  );
}
