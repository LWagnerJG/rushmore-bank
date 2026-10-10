"use client";

/**
 * Local waiting-roster lab — not linked from prod nav.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { WaitingRoster } from "@/components/WaitingRoster";
import type { Player, PublicRoomState } from "@/shared/types";
import { emptyRoomState } from "@/shared/types";
import { projectPublicState } from "@/shared/engine/public-state";

const YOU = "you";

function player(
  id: string,
  name: string,
  seat: number,
  host = false,
): Player {
  return {
    id,
    name,
    role: "player",
    isHost: host,
    connected: true,
    stones: seat === 0 ? 0 : 10,
    seat,
    joinedAt: Date.now(),
  };
}

function labState(doneIds: string[]): PublicRoomState {
  const room = emptyRoomState("WAIT");
  room.phase = "VOTING_AND_JUDGING";
  room.players = [
    player(YOU, "Wags", 0, true),
    player("bot-ava", "Bot Ava", 1),
  ];
  room.seatOrder = [YOU, "bot-ava"];
  room.humanVotes = Object.fromEntries(doneIds.map((id) => [id, YOU]));
  return projectPublicState(room, YOU);
}

export default function WaitingLabPage() {
  const [scenario, setScenario] = useState<"mid" | "done">("mid");
  const state = useMemo(
    () => labState(scenario === "mid" ? [YOU] : [YOU, "bot-ava"]),
    [scenario],
  );

  return (
    <main
      className="app-shell app-shell-lock mx-auto flex max-w-md flex-col px-4 pt-0"
      style={
        {
          // Simulate iPhone home-indicator safe area for seam checks
          ["--test-safe-bottom" as string]: "34px",
        } as React.CSSProperties
      }
    >
      <div className="room-chrome-safe" aria-hidden="true" />
      <div className="flex items-center justify-between gap-2 px-0 pb-2 pt-3">
        <Link href="/" className="type-meta text-[var(--muted)]">
          ← Home
        </Link>
        <p className="type-meta font-bold text-[var(--muted)]">Waiting lab</p>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn-secondary px-3 ${scenario === "mid" ? "btn-your-turn" : ""}`}
          onClick={() => setScenario("mid")}
        >
          Mid-wait
        </button>
        <button
          type="button"
          className={`btn-secondary px-3 ${scenario === "done" ? "btn-your-turn" : ""}`}
          onClick={() => setScenario("done")}
        >
          Everyone in
        </button>
      </div>
      <div
        className="room-phase-scroll min-h-0 flex-1"
        style={{ paddingBottom: "34px" }}
      >
        <div className="phase-panel shrink-0 pb-[max(1.25rem,34px,2.1rem)]">
          <h2 className="type-display mb-3">Vote</h2>
          <WaitingRoster
            state={state}
            youId={YOU}
            doneIds={state.humanVotedIds}
            label={
              scenario === "done" ? "Votes in" : "Waiting on votes"
            }
          />
          <div className="mt-6 space-y-2">
            <div className="panel">
              <p className="font-bold">Bot Ava</p>
              <p className="type-meta text-[var(--muted)]">Sample roster card</p>
            </div>
            <div className="panel">
              <p className="font-bold">Wags (you)</p>
              <p className="type-meta text-[var(--muted)]">Sample roster card</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
