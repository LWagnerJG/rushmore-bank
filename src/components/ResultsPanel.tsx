"use client";

import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { PartyModeSwitch } from "@/components/PartyModeSwitch";

export function ResultsPanel({
  state,
  you,
  send,
}: {
  state: PublicRoomState;
  you: Player;
  send: (m: ClientMessage) => void;
}) {
  const ranked = [...state.players]
    .filter((p) => p.role === "player")
    .sort((a, b) => b.stones - a.stones);

  const final = state.phase === "GAME_RESULTS";
  const prompt = state.partyPrompt;
  const promptOpen = !!prompt && !prompt.resolved;
  const lowestNames =
    prompt?.kind === "lowest_drink"
      ? prompt.targetPlayerIds
          .map((id) => state.players.find((p) => p.id === id)?.name ?? "Player")
          .join(", ")
      : "";
  const canResolveParty =
    !!prompt &&
    (prompt.targetPlayerIds.includes(you.id) || you.isHost);
  const drinkBlocked = promptOpen && prompt?.kind === "lowest_drink";

  return (
    <div className="space-y-4">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
        {final
          ? "Final standings"
          : `Round ${state.topicRound}/${state.configuredTopicRounds}`}
      </h2>

      <ol className="space-y-2">
        {ranked.map((p, i) => (
          <li key={p.id} className="player-row font-extrabold">
            <span>
              {i + 1}. {p.name}
              {p.id === you.id ? " (you)" : ""}
            </span>
            <span className="text-[var(--coral)]">
              {p.stones} {RULES.currencyName}
            </span>
          </li>
        ))}
      </ol>

      {promptOpen && prompt?.kind === "lowest_drink" && (
        <div className="party-sip party-sip-quiet space-y-3">
          <p className="party-sip-kicker">Party Mode</p>
          <p className="font-[family-name:var(--font-display)] text-lg font-extrabold">
            Lowest beans · take a drink
          </p>
          <p className="text-sm font-semibold text-[var(--muted)]">
            {lowestNames}
            {prompt.targetPlayerIds.length > 1 ? " (tie)" : ""} — finish a
            drink, then continue. Pass anytime is ok.
          </p>
          {canResolveParty && (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-party-sip flex-1"
                onClick={() =>
                  send({ type: "party_resolve", choice: "done" })
                }
              >
                I finished my drink
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() =>
                  send({ type: "party_resolve", choice: "pass" })
                }
              >
                Pass
              </button>
            </div>
          )}
        </div>
      )}

      {you.isHost && !final && (
        <div className="space-y-3">
          <PartyModeSwitch
            compact
            on={state.settings.partyMode}
            onChange={(next) =>
              send({
                type: "update_settings",
                settings: { partyMode: next },
              })
            }
          />
          <button
            type="button"
            className="btn-primary w-full text-lg"
            disabled={drinkBlocked}
            onClick={() => send({ type: "next_topic" })}
          >
            {drinkBlocked ? "Waiting on drink…" : "Next topic"}
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => send({ type: "end_game" })}
          >
            End game
          </button>
        </div>
      )}

      {you.isHost && final && (
        <div className="space-y-2">
          <button
            type="button"
            className="btn-primary w-full text-lg"
            onClick={() => send({ type: "play_again" })}
          >
            Rematch
          </button>
          <p className="text-center text-xs font-semibold text-[var(--muted)]">
            Same room &amp; players — fresh run, no new codes.
          </p>
        </div>
      )}
    </div>
  );
}
