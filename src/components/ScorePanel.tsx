"use client";

import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";

export function ScorePanel({ state, you, send }: {
  state: PublicRoomState; you: Player; send: (m: ClientMessage) => void;
}) {
  const sorted = [...state.scores].sort((a, b) => b.earned - a.earned);
  return <div className="space-y-4">
    <h2 className="text-2xl font-extrabold">The beans are in.</h2>
    <p className="text-sm text-[var(--muted)]">Everyone earns beans. The room and the judge add the extras.</p>
    {state.judgeNotice && <p className="panel text-sm font-semibold">Judge unavailable. Everyone gets the same 20-bean judge award.</p>}
    {sorted.map((score) => {
      const player = state.players.find((p) => p.id === score.playerId);
      return <article key={score.playerId} className="panel space-y-3">
        <div className="flex items-center justify-between gap-3 font-extrabold"><span>{player?.name}{player?.id === you.id ? " (you)" : ""}</span><span className="text-lg">+{score.earned} beans</span></div>
        <p className="text-sm">{score.explanation}</p>
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--muted)]">Where did my beans come from?</summary>
          <ul className="mt-3 space-y-1">
            <li>Joining in: {RULES.scoreBase} beans</li>
            <li>{score.aiFallback ? "Neutral judge award" : "AI judge"}: {score.aiAward} beans</li>
            <li>Room votes: {score.votes * RULES.stonesPerHumanVote} beans ({score.votes} votes)</li>
          </ul>
          {!score.aiFallback && <p className="mt-2 text-xs text-[var(--muted)]">Topic fit {score.topicFit}/10 · Pick strength {score.pickStrength}/20 · Set quality {score.rosterQuality}/10</p>}
        </details>
      </article>;
    })}
    {you.isHost ? <div className="space-y-3">
      <button type="button" className="btn-danger w-full" onClick={() => send({ type: "advance" })}>Choose beans to roll</button>
      <details className="panel text-sm"><summary className="cursor-pointer font-bold">Host controls</summary><p className="my-3">Discard this round and restore everyone&apos;s earlier balance.</p><button type="button" className="btn-secondary w-full" onClick={() => { if (window.confirm("Discard this round and restore everyone's earlier balance?")) send({ type: "void_topic" }); }}>Discard round</button></details>
    </div> : <p className="text-center text-sm text-[var(--muted)]">Waiting for the host to start the dice round.</p>}
  </div>;
}
