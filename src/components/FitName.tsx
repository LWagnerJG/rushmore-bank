"use client";

import { useLayoutEffect, useRef } from "react";
import { resolveFitNameStyle } from "@/shared/fit-name";

/**
 * One-line, centered nickname that shrinks to fit its tile.
 * No hyphenation / mid-word breaks. Ellipsis only after a floor size.
 */
export function FitName({
  text,
  className,
  title,
}: {
  text: string;
  className?: string;
  title?: string;
}) {
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const fit = () => {
      el.style.fontSize = "";
      el.style.letterSpacing = "";
      el.style.textOverflow = "clip";

      const base = parseFloat(getComputedStyle(el).fontSize);
      if (!Number.isFinite(base) || base <= 0) return;
      if (el.clientWidth <= 0) return;

      const style = resolveFitNameStyle(base, (fontPx, letterSpacing) => {
        el.style.fontSize = `${fontPx}px`;
        el.style.letterSpacing = letterSpacing;
        return el.scrollWidth > el.clientWidth + 0.5;
      });

      el.style.fontSize = `${style.fontSizePx}px`;
      el.style.letterSpacing = style.letterSpacing;
      el.style.textOverflow = style.textOverflow;
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return (
    <span
      className={["fit-name", className].filter(Boolean).join(" ")}
      title={title ?? text}
    >
      <span ref={textRef} className="fit-name-text">
        {text}
      </span>
    </span>
  );
}
