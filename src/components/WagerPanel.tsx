"use client";

import { useEffect, useState } from "react";
import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { maxWager, wagerFromPreset } from "@/shared/engine";

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

export function WagerPanel({
  state,
  you,
  youId,
  send,
}: {
  state: PublicRoomState;
  you: Player;
  youId: string;
  send: (m: ClientMessage) => void;
}) {
  const E = state.earnedThisRound[youId] ?? 0;
  const B = you.stones;
  const max = maxWager(E, B);
  const locked = state.wagers[youId];
  const [custom, setCustom] = useState(String(Math.min(max, E)));

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="font-extrabold">Wager Stones</h2>
        <Countdown until={state.wagerDeadlineAt} />
      </div>
      <div className="panel text-sm">
        <p>
          Earned this topic: <strong>{E}</strong>
        </p>
        <p>
          Banked: <strong>{B}</strong> · max wager <strong>{max}</strong> (= E +
          min({RULES.earlierWagerCap}, B))
        </p>
      </div>

      {locked === undefined && you.role === "player" ? (
        <div className="space-y-2">
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() =>
              send({
                type: "submit_wager",
                amount: wagerFromPreset("keep_all", E, B),
              })
            }
          >
            Keep All (0)
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() =>
              send({
                type: "submit_wager",
                amount: wagerFromPreset("half_new", E, B),
              })
            }
          >
            Half New ({wagerFromPreset("half_new", E, B)})
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() =>
              send({
                type: "submit_wager",
                amount: wagerFromPreset("all_new", E, B),
              })
            }
          >
            All New ({wagerFromPreset("all_new", E, B)})
          </button>
          <div className="flex gap-2">
            <input
              className="field w-full"
              type="number"
              min={0}
              max={max}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                send({ type: "submit_wager", amount: Number(custom) || 0 })
              }
            >
              Lock
            </button>
          </div>
        </div>
      ) : (
        <p className="panel font-bold">
          Locked wager: {locked ?? "—"} ◆ — waiting for others…
        </p>
      )}
    </div>
  );
}
