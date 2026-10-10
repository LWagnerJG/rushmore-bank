"use client";

import type { ClientMessage, Player, PublicRoomState } from "@/shared/types";
import { RULES } from "@/shared/rules";
import { PartyModeSwitch } from "@/components/PartyModeSwitch";
import { ResultsRevealList } from "@/components/ResultsRevealList";

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
  // True when we're showing the last round's results before final standings.
  const isFinalRoundResults =
    !final &&
    state.phase === "ROUND_RESULTS" &&
    state.topicRound >= state.configuredTopicRounds;
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
    <div className="stack">
      <h2 className="type-display">
        {final
          ? "Final standings"
          : isFinalRoundResults
            ? "Final round results"
            : `Round ${state.topicRound}/${state.configuredTopicRounds}`}
      </h2>

      <ResultsRevealList
        ranked={ranked}
        youId={you.id}
        currencyName={RULES.currencyName}
        revealKey={`${state.phase}:${state.topicRound}:${state.phaseRevision}`}
      />

      {promptOpen && prompt?.kind === "lowest_drink" && (
        <div className="party-sip party-sip-quiet stack-sm">
          <p className="party-sip-kicker type-meta">Party Mode</p>
          <p className="type-body font-[family-name:var(--font-display)] font-extrabold">
            Lowest beans · take a drink
          </p>
          <p className="type-meta text-[var(--muted)]">
            {lowestNames}
            {prompt.targetPlayerIds.length > 1 ? " (tie)" : ""} — finish a
            drink, then continue. Pass anytime is ok.
          </p>
          {canResolveParty && (
            <div className="stack-row">
              <button
                type="button"
                className="btn-primary flex-1"
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
        <div className="stack-sm">
          {!isFinalRoundResults && (
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
          )}
          <button
            type="button"
            className="btn-primary w-full"
            disabled={drinkBlocked}
            onClick={() => send({ type: "next_topic" })}
          >
            {drinkBlocked
              ? "Waiting on drink…"
              : isFinalRoundResults
                ? "See final standings"
                : state.topicRound === state.configuredTopicRounds - 1
                  ? "Start final round"
                  : "Next topic"}
          </button>
          {!isFinalRoundResults && (
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => send({ type: "end_game" })}
            >
              End game
            </button>
          )}
        </div>
      )}

      {you.isHost && final && (
        <div className="stack-sm">
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => send({ type: "play_again" })}
          >
            Rematch
          </button>
          <p className="type-meta text-center text-[var(--muted)]">
            Same room &amp; players — fresh run, no new codes.
          </p>
        </div>
      )}
    </div>
  );
}
