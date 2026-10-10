"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "@/shared/types";
import {
  countUpValue,
  hasRevealCompleted,
  markRevealCompleted,
  prefersReducedMotion,
  rankStandings,
  revealOrderIndices,
  revealSchedule,
  WINNER_SWEEP_MS,
} from "@/lib/results-reveal";
import { feedback } from "@/lib/feedback";

type Row = {
  id: string;
  name: string;
  stones: number;
  rank: number;
  isYou: boolean;
  isWinner: boolean;
};

/**
 * Standings reveal: players appear last→first with a short count-up.
 * Total under ~2.5s; tap to skip. Rows keep layout space (opacity/transform only).
 * Completion is keyed in sessionStorage so reconnects do not replay broken mid-state.
 */
export function ResultsRevealList({
  ranked,
  youId,
  currencyName,
  revealKey,
  showWinnerSweep = false,
}: {
  ranked: Player[];
  youId: string;
  currencyName: string;
  /** Stable game identity — must not include phaseRevision. */
  revealKey: string;
  /** GAME_RESULTS only — green sweep on winner row(s) after they appear last. */
  showWinnerSweep?: boolean;
}) {
  const rows: Row[] = useMemo(() => {
    const standings = rankStandings(
      ranked.map((p) => ({ id: p.id, name: p.name, stones: p.stones })),
    );
    return standings.map((s) => ({
      ...s,
      isYou: s.id === youId,
    }));
  }, [ranked, youId]);

  const schedule = useMemo(
    () => revealSchedule(rows.length),
    [rows.length],
  );
  const order = useMemo(
    () => revealOrderIndices(rows.length),
    [rows.length],
  );

  const alreadyDone = hasRevealCompleted(revealKey);
  const [revealedCount, setRevealedCount] = useState(() =>
    alreadyDone ? rows.length : 0,
  );
  const [displayValues, setDisplayValues] = useState<number[]>(() =>
    alreadyDone ? rows.map((r) => r.stones) : rows.map(() => 0),
  );
  const [done, setDone] = useState(alreadyDone);
  const [sweepOn, setSweepOn] = useState(alreadyDone && showWinnerSweep);
  const skipped = useRef(false);
  const rafRef = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const finish = () => {
    skipped.current = true;
    clearTimers();
    const latest = rowsRef.current;
    setRevealedCount(latest.length);
    setDisplayValues(latest.map((r) => r.stones));
    setDone(true);
    if (showWinnerSweep) {
      setSweepOn(true);
      feedback("winner");
    }
    markRevealCompleted(revealKey);
  };

  useEffect(() => {
    skipped.current = false;
    clearTimers();

    const latest = rowsRef.current;
    if (latest.length === 0) {
      setRevealedCount(0);
      setDisplayValues([]);
      setDone(true);
      setSweepOn(false);
      return;
    }

    if (hasRevealCompleted(revealKey) || prefersReducedMotion()) {
      const firstShow = !hasRevealCompleted(revealKey);
      setRevealedCount(latest.length);
      setDisplayValues(latest.map((r) => r.stones));
      setDone(true);
      setSweepOn(showWinnerSweep);
      markRevealCompleted(revealKey);
      if (firstShow && showWinnerSweep) feedback("winner");
      return;
    }

    setRevealedCount(0);
    setDisplayValues(latest.map(() => 0));
    setDone(false);
    setSweepOn(false);

    const runCountUp = (index: number, target: number, duration: number) => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const start = performance.now();
      const tick = (now: number) => {
        if (skipped.current) return;
        const t = duration <= 0 ? 1 : (now - start) / duration;
        setDisplayValues((prev) => {
          const next = prev.slice();
          next[index] = countUpValue(target, t);
          return next;
        });
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
          setDisplayValues((prev) => {
            const next = prev.slice();
            next[index] = target;
            return next;
          });
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const ord = revealOrderIndices(latest.length);
    const sched = revealSchedule(latest.length);

    ord.forEach((rowIndex, step) => {
      const startAt = step * sched.stepMs;
      const id = window.setTimeout(() => {
        if (skipped.current) return;
        setRevealedCount(step + 1);
        const row = latest[rowIndex];
        if (!row) return;
        runCountUp(rowIndex, row.stones, sched.countMs);
        if (step + 1 >= latest.length) {
          const doneId = window.setTimeout(() => {
            if (skipped.current) return;
            setDone(true);
            markRevealCompleted(revealKey);
            if (showWinnerSweep) {
              setSweepOn(true);
              feedback("winner");
              // Keep sweep class briefly; CSS animation handles visuals.
              const sweepEnd = window.setTimeout(() => {
                /* no-op — class can stay; animation is forwards */
              }, WINNER_SWEEP_MS);
              timers.current.push(sweepEnd);
            }
          }, sched.countMs);
          timers.current.push(doneId);
        }
      }, startAt);
      timers.current.push(id);
    });

    return () => {
      clearTimers();
    };
    // Restart only when the stable reveal identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revealKey drives reset
  }, [revealKey, showWinnerSweep]);

  const revealedSet = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < revealedCount; i++) {
      const idx = order[i];
      if (idx != null) set.add(idx);
    }
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
        const winnerSweep =
          showWinnerSweep && sweepOn && row.isWinner && shown;
        return (
          <li
            key={row.id}
            className={[
              "results-reveal-row",
              "type-body",
              "font-extrabold",
              shown ? "results-reveal-row-on" : "results-reveal-row-off",
              winnerSweep ? "results-reveal-row-winner" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden={!shown}
          >
            {winnerSweep ? (
              <span className="endgame-winner-sweep" aria-hidden="true" />
            ) : null}
            <span className="results-reveal-rank tabular-nums">{row.rank}</span>
            <span className="results-reveal-name">
              {row.name}
              {row.isYou ? " (you)" : ""}
            </span>
            <span className="results-reveal-total tabular-nums">
              {shown ? displayValues[i] ?? 0 : "\u00a0"}
              <span className="results-reveal-currency"> {currencyName}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
