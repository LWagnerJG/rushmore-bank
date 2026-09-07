"use client";

import { useEffect, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";

function Countdown({ until }: { until: number | null }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!until) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  return <span className="tabular-nums">{left}s</span>;
}

export function PrepPanel({
  state,
}: {
  state: PublicRoomState;
  you: Player;
  youId: string;
  send: (m: ClientMessage) => void;
}) {
  const topic = state.selectedTopic;
  return (
    <div className="space-y-4 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
        Prep · <Countdown until={state.phaseDeadlineAt} />
      </p>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
        {topic?.text}
      </h2>
      <p className="panel text-sm">{topic?.scopeBoundary}</p>
      <p className="text-sm text-[var(--muted)]">
        Jot ideas privately. Snake draft starts soon.
      </p>
    </div>
  );
}
