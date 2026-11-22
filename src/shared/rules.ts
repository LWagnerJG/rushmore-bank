/**
 * Beans — single source of truth for tunable game defaults.
 * Documented in docs/RULES.md. Do not silently diverge from confirmed product rules.
 * Protocol still uses `stones` field names for compatibility.
 */

export const RULES = {
  /** Display */
  displayName: "Beans",
  tagline: "Your Mount Rushmore of anything.",
  currencyName: "beans",
  /**
   * Canonical production host (Cloudflare worker `beans-web`).
   * `https://beans-game.vercel.app` and `https://roundacats.vercel.app`
   * 308 to this origin (except `/api/version` on Vercel).
   * Share invites prefer `window.location.origin` when in-browser.
   */
  productionUrl: "https://beans-web.beans-lwagner.workers.dev",

  /** Players */
  minPlayers: 2,
  maxPlayers: 10,
  startBalance: 0,
  picksPerPlayer: 4,

  /** Topics */
  /** Always offer exactly this many topic choices for voting */
  topicShortlistSize: 4,
  /**
   * Topic rounds *played* (not choices offered):
   * Default 3 rounds with 2–5 players; 2 rounds with 6–10.
   * Host may override to 3–6 on the first topic screen.
   */
  topicRoundsSmallMaxPlayers: 5,
  topicRoundsSmall: 3,
  topicRoundsLarge: 2,
  /** Host-selectable round counts on first TOPIC_SELECTION. */
  topicRoundsHostOptions: [3, 4, 5, 6] as const,
  /** Topic vote — no timer; advances when every connected player has voted */
  topicVoteSeconds: 0,
  /** Soft target session length */
  targetMinutesMin: 25,
  targetMinutesMax: 30,

  /** Draft (no prep phase — topic lock goes straight to draft) */
  /** Comfortable phone typing window. Host can +15s. */
  pickClockSeconds: 60,
  /** Grace after pick clock hits 0 before miss */
  pickGraceSeconds: 5,
  hostExtendSeconds: 15,
  /**
   * Legacy review skim length — kept at 0. Draft completion still enters
   * REVIEW briefly via `draftCompleteHoldMs` so everyone sees “Everyone’s in!”
   * before VOTING_AND_JUDGING (server-authoritative).
   */
  reviewSeconds: 0,
  /**
   * Pause after the last draft lock-in / miss before voting + AI judge.
   * Long enough to register the final pick; short enough not to stall the party.
   */
  draftCompleteHoldMs: 1300,

  /** Voting / AI */
  /** Vote window — ends at deadline or when everyone has voted. */
  humanVoteSeconds: 45,
  scoreBase: 20,
  aiAwardMin: 0,
  aiAwardMax: 40,
  stonesPerHumanVote: 5,
  /** Fallback when AI unavailable: neutral mid award */
  aiFallbackAward: 20,
  /** Player-facing only — never append HTTP codes or model names. */
  aiFallbackLabel: "Judge unavailable · neutral award.",
  aiExplanationMaxWords: 45,
  aiPromptVersion: "quarry-judge-v1",

  /** Wagers — every owned bean is wagerable (E + B). 45s matches vote window; was 20s (too rushed). */
  wagerTimeoutSeconds: 45,

  /** Dice — personal turn: keep rolling until Bank or bust, then next seat */
  /**
   * Pre-roll “opens in Ns” wait — kept at 0 (no fake countdown).
   * Roll unlocks immediately; only the idle bank window below is shown.
   */
  diceDecisionCountdownSeconds: 0,
  /** Roll / Bank decision window once READY (also continues after non-bust). */
  diceIdleBankSeconds: 15,
  /** Shared tumble duration before authoritative reveal */
  diceAnimMs: 2400,
  /**
   * Client hard-land window after the server settle time. If the reveal
   * broadcast is late or an animationend never fires, snap by this deadline.
   */
  diceHardLandMs: 1500,
  /** Hold SETTLED faces on screen before next READY / seat advance (kills settle-then-jump) */
  diceSettleHoldMs: 1100,
  /** Extra linger after BEAN BUSTER before next seat (intentional beat + fade) */
  diceBustHoldMs: 2000,
  /**
   * Total wall-clock budget for PartyServer → /api/judge (attempt + one retry).
   * Kept bounded so a hung provider never stalls the vote phase indefinitely.
   */
  judgeTimeoutMs: 25_000,
  /** Max fetch attempts within judgeTimeoutMs (1 = no retry). */
  judgeMaxAttempts: 2,

  /** Host / lobby */
  /**
   * Soft-disconnect grace for host hold / lobby host drops.
   * Mid-game action skip / host Skip reveal uses `disconnectActionGraceMs`.
   */
  disconnectGraceMs: 45_000,
  /**
   * Mid-game soft-disconnect window (single constant ≈20s):
   * - Clients show `reconnecting…` (no host Skip) while this timer runs.
   * - When it ends the seat goes `away`, the table auto-misses their turn,
   *   and the host may tap them for a discreet “Skip this turn” sheet.
   * - Reconnect before expiry clears the flag and never reveals Skip.
   * Server-timed (`disconnectedAt` + leave timer) so host reloads stay honest.
   */
  disconnectActionGraceMs: 20_000,
  /** Host transfer floor — never faster than disconnectGraceMs. */
  hostFailoverSeconds: 45,
  partyModeDefault: false,
  roomCodeLength: 4,

  /** Theme (brighter palette) */
  colors: {
    bg: "#F5F0E7",
    text: "#23483E",
    coral: "#E76F4E",
    yellow: "#F4C95B",
    mint: "#A7D7C2",
  },
} as const;

export type Rules = typeof RULES;

/** Always exactly `RULES.topicShortlistSize` choices (player count ignored). */
export function topicShortlistCount(_playerCount?: number): number {
  return RULES.topicShortlistSize;
}

/** Rounds played this game (distinct from shortlist / choices offered). */
export function topicRoundsForPlayerCount(playerCount: number): number {
  if (playerCount <= RULES.topicRoundsSmallMaxPlayers) {
    return RULES.topicRoundsSmall;
  }
  return RULES.topicRoundsLarge;
}

export type HostTopicRounds = (typeof RULES.topicRoundsHostOptions)[number];

/** True when `n` is one of the host-selectable round counts (3–6). */
export function isHostSelectableTopicRounds(n: number): n is HostTopicRounds {
  return (RULES.topicRoundsHostOptions as readonly number[]).includes(n);
}

/**
 * 1-based round index shown to players (“Round 3 of 8”).
 * `topicRound` advances when a round finishes (ROUND_RESULTS), so in-progress
 * phases use topicRound+1; results screens use the completed count.
 */
export function displayTopicRound(input: {
  phase: string;
  topicRound: number;
}): number {
  if (input.phase === "LOBBY") return 0;
  if (input.phase === "ROUND_RESULTS" || input.phase === "GAME_RESULTS") {
    return Math.max(1, input.topicRound);
  }
  return input.topicRound + 1;
}

/** Lowest total the host may set without cutting off the current round. */
export function minHostTopicRounds(input: {
  phase: string;
  topicRound: number;
}): number {
  return Math.max(1, displayTopicRound(input));
}

/**
 * Host may change configured rounds mid-game (not lobby / game-over).
 * New total must be a host option (3–6) and not below the current round.
 */
export function canHostSetTopicRounds(input: {
  phase: string;
  topicRound: number;
  rounds: number;
}): boolean {
  if (input.phase === "LOBBY" || input.phase === "GAME_RESULTS") return false;
  if (!isHostSelectableTopicRounds(input.rounds)) return false;
  return input.rounds >= minHostTopicRounds(input);
}

/**
 * Host may toggle Party Mode in any phase. Changing it only affects future
 * drink prompts (bust redo / lowest beans) — it must not interrupt the
 * current phase timers, votes, or dice flow.
 */
export function canHostUpdatePartyMode(_phase: string): boolean {
  return true;
}

/**
 * Topic vibe may change in lobby, while picking a topic (re-spins shortlist),
 * or between topics. Locked during draft/dice/play.
 */
export function canHostUpdateTopicVibe(phase: string): boolean {
  return (
    phase === "LOBBY" ||
    phase === "TOPIC_SELECTION" ||
    phase === "ROUND_RESULTS" ||
    phase === "SCORE_REVEAL"
  );
}
