"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DiceScene } from "@/components/dice/DiceScene";
import type { PublicDiceBroadcast } from "@/shared/types";

/**
 * Local visual lab for dice settle verification (not linked from prod nav).
 * Cycles tumble → settle for known face pairs including 7s.
 */
const PAIRS: Array<[number, number]> = [
  [1, 6],
  [2, 5],
  [3, 4],
  [4, 3],
  [5, 2],
  [6, 1],
  [2, 3],
  [6, 6],
  [1, 1],
];

export default function DiceLabPage() {
  const [pairIndex, setPairIndex] = useState(0);
  const [rollN, setRollN] = useState(0);
  const [phase, setPhase] = useState<"idle" | "tumbling" | "settled">("idle");
  const settleTimer = useRef<number | null>(null);
  const [d1, d2] = PAIRS[pairIndex]!;

  useEffect(() => {
    return () => {
      if (settleTimer.current != null) window.clearTimeout(settleTimer.current);
    };
  }, []);

  const broadcast: PublicDiceBroadcast | null = useMemo(() => {
    if (phase === "idle") return null;
    const now = Date.now();
    const rollId = `lab-${rollN}-${d1}x${d2}`;
    if (phase === "tumbling") {
      return {
        rollId,
        rollerId: "lab",
        personalRollNumber: rollN,
        animStartedAt: now - 50,
        animSettleAt: now + 2350,
        animSeed: 99,
        revealed: false,
        potBefore: 10,
      };
    }
    return {
      rollId,
      rollerId: "lab",
      personalRollNumber: rollN,
      animStartedAt: now - 2400,
      animSettleAt: now - 100,
      animSeed: 99,
      revealed: true,
      potBefore: 10,
      d1,
      d2,
      potAfter: d1 + d2 === 7 ? 0 : 10 + d1 + d2,
      busted: d1 + d2 === 7,
      note: d1 + d2 === 7 ? "bust" : `+${d1 + d2}`,
      outcomeKind: d1 + d2 === 7 ? "bust" : "add_sum",
    };
  }, [phase, rollN, d1, d2]);

  function runRoll() {
    if (settleTimer.current != null) window.clearTimeout(settleTimer.current);
    const next = rollN + 1;
    setRollN(next);
    setPhase("tumbling");
    settleTimer.current = window.setTimeout(() => setPhase("settled"), 1800);
  }

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 pb-10 pt-8">
      <Link href="/" className="text-sm font-bold text-[var(--coral)]">
        ← Home
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
        Dice settle lab
      </h1>
      <p className="text-sm text-[var(--muted)]">
        Tumble must show blank/blurred shells. First settled frame must equal{" "}
        <strong>
          {d1}+{d2}
        </strong>
        . No end jump.
      </p>

      <DiceScene
        broadcast={broadcast}
        reducedMotion={false}
        canRoll={phase !== "tumbling"}
        busted={phase === "settled" && d1 + d2 === 7}
        onRoll={runRoll}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          data-testid="lab-roll"
          onClick={runRoll}
        >
          Roll {d1}+{d2}
          {d1 + d2 === 7 ? " (7)" : ""}
        </button>
        <button
          type="button"
          className="btn-secondary"
          data-testid="lab-next"
          onClick={() => {
            if (settleTimer.current != null)
              window.clearTimeout(settleTimer.current);
            setPairIndex((i) => (i + 1) % PAIRS.length);
            setPhase("idle");
          }}
        >
          Next pair
        </button>
        <button
          type="button"
          className="btn-secondary"
          data-testid="lab-reset"
          onClick={() => {
            if (settleTimer.current != null)
              window.clearTimeout(settleTimer.current);
            setPhase("idle");
          }}
        >
          Reset
        </button>
      </div>

      <p className="text-xs text-[var(--muted)]" data-lab-status>
        phase={phase} target={d1}+{d2} roll={rollN}
      </p>
    </main>
  );
}
