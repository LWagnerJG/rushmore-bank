"use client";

import { useLayoutEffect, useRef } from "react";
import { resolveFitNameStyle } from "@/shared/fit-name";

/**
 * One-line, centered nickname that shrinks to fit its tile.
 * No hyphenation / mid-word breaks. Ellipsis only after a floor size.
 *
 * ResizeObserver is rAF-debounced and skips writes when the measured width
 * bin is unchanged — avoids iOS "ResizeObserver loop" thrash on the rail.
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

    let raf = 0;
    let lastWidthBin = -1;
    let lastText = "";

    const fit = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      // Bin widths so sub-pixel RO chatter doesn't re-run the binary search.
      const widthBin = Math.round(width);
      if (widthBin === lastWidthBin && text === lastText) return;
      lastWidthBin = widthBin;
      lastText = text;

      el.style.fontSize = "";
      el.style.letterSpacing = "";
      el.style.lineHeight = "";
      el.style.textOverflow = "clip";

      const computed = getComputedStyle(el);
      const base = parseFloat(computed.fontSize);
      if (!Number.isFinite(base) || base <= 0) return;
      // Keep the unshrunk line box: a shrunk name must not change the row
      // height (rail chips re-fit on every turn change).
      const lineHeight = parseFloat(computed.lineHeight);
      if (Number.isFinite(lineHeight) && lineHeight > 0) {
        el.style.lineHeight = `${lineHeight}px`;
      }

      const style = resolveFitNameStyle(base, (fontPx, letterSpacing) => {
        el.style.fontSize = `${fontPx}px`;
        el.style.letterSpacing = letterSpacing;
        return el.scrollWidth > el.clientWidth + 0.5;
      });

      el.style.fontSize = `${style.fontSizePx}px`;
      el.style.letterSpacing = style.letterSpacing;
      el.style.textOverflow = style.textOverflow;
    };

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        fit();
      });
    };

    fit();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
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
