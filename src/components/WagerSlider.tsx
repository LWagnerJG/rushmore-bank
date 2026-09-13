"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

/**
 * Phone-first wager control: one track is both the AT RISK / stay-safe split
 * and the interactive slider. Pointer capture + touch-action:none + document
 * move listeners keep the drag alive when the finger drifts vertically (iOS).
 */
export function WagerSlider({
  id,
  min,
  max,
  value,
  onChange,
  valuetext,
}: {
  id?: string;
  min: number;
  max: number;
  value: number;
  onChange: (next: number) => void;
  valuetext: string;
}) {
  const fallbackId = useId();
  const sliderId = id ?? fallbackId;
  const trackRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const minRef = useRef(min);
  const maxRef = useRef(max);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    minRef.current = min;
    maxRef.current = max;
  }, [min, max]);

  const fillPct =
    max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

  const valueFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    const lo = minRef.current;
    const hi = maxRef.current;
    if (!el || hi <= lo) return lo;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return valueRef.current;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    // Absolute beans so orange fill (value/max) matches AT RISK pile.
    return Math.min(hi, Math.max(lo, Math.round(ratio * hi)));
  }, []);

  const commitFromClientX = useCallback(
    (clientX: number) => {
      onChangeRef.current(valueFromClientX(clientX));
    },
    [valueFromClientX],
  );

  // Document-level listeners: keep updating even if capture is flaky on iOS
  // when the finger leaves the thumb vertically.
  useEffect(() => {
    const onMove = (e: globalThis.PointerEvent) => {
      if (activePointer.current !== e.pointerId) return;
      e.preventDefault();
      commitFromClientX(e.clientX);
    };
    const onUp = (e: globalThis.PointerEvent) => {
      if (activePointer.current !== e.pointerId) return;
      activePointer.current = null;
      const el = trackRef.current;
      if (el?.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    };
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [commitFromClientX]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    activePointer.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* iOS can throw if capture unsupported — document listeners cover us */
    }
    commitFromClientX(e.clientX);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (max <= min) return;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = value - 1;
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = value + 1;
        break;
      case "PageDown":
        next = value - Math.max(1, Math.round((max - min) / 10));
        break;
      case "PageUp":
        next = value + Math.max(1, Math.round((max - min) / 10));
        break;
      case "Home":
        next = min;
        break;
      case "End":
        next = max;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange(Math.min(max, Math.max(min, next)));
  };

  return (
    <div className="wager-slider-block">
      <div
        ref={trackRef}
        id={sliderId}
        className="wager-slider"
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valuetext}
        aria-label={`Beans at risk, ${min} to ${max}`}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
      >
        <span
          className="wager-slider-track"
          aria-hidden="true"
          style={{ "--wager-fill": `${fillPct}%` } as CSSProperties}
        />
        <span
          className="wager-slider-thumb"
          aria-hidden="true"
          style={{ left: `${fillPct}%` }}
        />
      </div>
      <div className="wager-slider-ends">
        <span>{min} min</span>
        <span>{max} max</span>
      </div>
    </div>
  );
}
