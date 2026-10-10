"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "@/shared/types";
import {
  countUpValue,
  prefersReducedMotion,
  revealOrderIndices,
  revealSchedule,
} from "@/lib/results-reveal";

type Row = {
  id: string;
  name: string;
  stones: number;
  isYou: boolean;
};

/**
 * Standings reveal: players appear last→first with a short count-up.
 * Total under 2s; tap to skip. No layout shift (rows reserved, opacity only).
 */
export function ResultsRevealList({
  ranked,
  youId,
  currencyName,
  revealKey,
}: {
  ranked: Player[];
  youId: string;
  currencyName: string;
  /** Change to restart the reveal (e.g. phase + topicRound). */
  revealKey: string;
}) {
  const rows: Row[] = useMemo(
    () =>
      ranked.map((p) => ({
        id: p.id,
        name: p.name,
        stones: p.stones,
        isYou: p.id === youId,
      })),
    [ranked, youId],
  );

  const schedule = useMemo(
    () => revealSchedule(rows.length),
    [rows.length],
  );
  const order = useMemo(
    () => revealOrderIndices(rows.length),
    [rows.length],
  );

  const [revealedCount, setRevealedCount] = useState(0);
  const [displayValues, setDisplayValues] = useState<number[]>(() =>
    rows.map(() => 0),
  );
  const [done, setDone] = useState(false);
  const skipped = useRef(false);
  const rafRef = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  const finish = () => {
    skipped.current = true;
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    setRevealedCount(rows.length);
    setDisplayValues(rows.map((r) => r.stones));
    setDone(true);
  };

  useEffect(() => {
    skipped.current = false;
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    if (rows.length === 0 || prefersReducedMotion()) {
      setRevealedCount(rows.length);
      setDisplayValues(rows.map((r) => r.stones));
      setDone(true);
      return;
    }

    setRevealedCount(0);
    setDisplayValues(rows.map(() => 0));
    setDone(false);

    const runCountUp = (index: number, target: number, duration: number) => {
      const start = performance.now();
      const tick = (now: number) => {
        if (skipped.current) return;
        const t = duration <= 0 ? 1 : (now - start) / duration;
        setDisplayValues((prev) => {
          const next = [...prev];
          next[index] = countUpValue(target, t);
          return next;
        });
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setDisplayValues((prev) => {
            const next = [...prev];
            next[index] = target;
            return next;
          });
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    order.forEach((rowIndex, step) => {
      const startAt = step * schedule.stepMs;
      const id = window.setTimeout(() => {
        if (skipped.current) return;
        setRevealedCount(step + 1);
        runCountUp(rowIndex, rows[rowIndex].stones, schedule.countMs);
        if (step + 1 >= rows.length) {
          const doneId = window.setTimeout(() => {
            if (!skipped.current) setDone(true);
          }, schedule.countMs);
          timers.current.push(doneId);
        }
      }, startAt);
      timers.current.push(id);
    });

    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // Restart only when the reveal identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revealKey drives reset
  }, [revealKey]);

  const revealedSet = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < revealedCount; i++) set.add(order[i]!);
    return set;
  }, [revealedCount, order]);

  return (
    <ol
      className="results-reveal stack-sm"
      onClick={done ? undefined : finish}
      onKeyDown={
        done
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                finish();
              }
            }
      }
      role="list"
      aria-label={
        done
          ? "Standings"
          : "Standings revealing — tap to skip"
      }
      tabIndex={done ? undefined : 0}
    >
      {rows.map((row, i) => {
        const shown = revealedSet.has(i);
        return (
          <li
            key={row.id}
            className={[
              "player-row",
              "type-body",
              "font-extrabold",
              "results-reveal-row",
              shown ? "results-reveal-row-on" : "results-reveal-row-off",
            ].join(" ")}
            aria-hidden={!shown}
          >
            <span>
              {i + 1}. {row.name}
              {row.isYou ? " (you)" : ""}
            </span>
            <span className="tabular-nums text-[var(--coral)]">
              {shown ? displayValues[i] ?? 0 : "\u00a0"} {currencyName}
            </span>
          </li>
        );
      })}
      {!done && (
        <li className="results-reveal-hint type-meta text-[var(--muted)]" aria-hidden="true">
          Tap to skip
        </li>
      )}
    </ol>
  );
}
