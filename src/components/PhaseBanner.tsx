"use client";

import { phaseLabel, type Phase } from "@/shared/types";

const TONE: Record<Phase, string> = {
  lobby: "from-amber-400/20 to-transparent border-amber-400/40 text-amber-200",
  category: "from-sky-400/20 to-transparent border-sky-400/40 text-sky-200",
  build: "from-stone-300/20 to-transparent border-stone-300/40 text-stone-100",
  rank: "from-orange-400/20 to-transparent border-orange-400/40 text-orange-200",
  reveal: "from-yellow-300/25 to-transparent border-yellow-300/50 text-yellow-100",
  bank: "from-emerald-400/20 to-transparent border-emerald-400/40 text-emerald-200",
  bank_reveal:
    "from-emerald-300/25 to-transparent border-emerald-300/50 text-emerald-100",
};

export function PhaseBanner({
  phase,
  round,
  pot,
}: {
  phase: Phase;
  round: number;
  pot: number;
}) {
  return (
    <div
      className={`sticky top-0 z-20 relative overflow-hidden rounded-2xl border bg-gradient-to-r px-4 py-3 backdrop-blur-md ${TONE[phase]}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] opacity-80">
            Rushmore Bank
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide">
            {phaseLabel(phase)}
          </h2>
        </div>
        <div className="text-right text-sm opacity-90">
          {round > 0 && <div>Round {round}</div>}
          <div className="font-semibold tabular-nums">Pot {pot}</div>
        </div>
      </div>
    </div>
  );
}
