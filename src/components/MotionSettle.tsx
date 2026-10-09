"use client";

import {
  useCallback,
  useState,
  type AnimationEvent,
  type ReactNode,
} from "react";

/**
 * Runs a one-shot enter motion, then strips animation/transform/will-change
 * so iOS WebKit does not keep a soft-rasterized composited layer.
 *
 * Pair with CSS: `.foo { animation: …; animation-fill-mode: none }` and
 * `.motion-settled { animation: none; transform: none; will-change: auto }`.
 */
export function MotionSettle({
  motionClass,
  className = "",
  children,
  as: Tag = "div",
}: {
  /** Class that starts the enter animation (e.g. animate-rise, phase-enter). */
  motionClass: string;
  className?: string;
  children: ReactNode;
  as?: "div" | "section";
}) {
  const [settled, setSettled] = useState(false);
  const onAnimationEnd = useCallback((e: AnimationEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    setSettled(true);
  }, []);

  const cls = [
    className,
    settled ? "motion-settled" : motionClass,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={cls} onAnimationEnd={onAnimationEnd}>
      {children}
    </Tag>
  );
}
