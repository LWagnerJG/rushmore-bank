/**
 * Beans — single source of truth for tunable game defaults.
 * Documented in docs/RULES.md. Do not silently diverge from confirmed product rules.
 * Protocol still uses `stones` field names for compatibility.
 */

export const RULES = {
  /** Display */
  displayName: "Beans",
  tagline: "Draft four. Bank beans.",
  currencyName: "beans",
  /**
   * Canonical production host (Vercel project `beans-game`).
   * `https://roundacats.vercel.app` remains a working alias.
   * Share invites prefer `window.location.origin` when in-browser.
   */
  productionUrl: "https://beans-game.vercel.app",

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
   * Legacy review skim — kept at 0 so draft ends go straight into
   * VOTING_AND_JUDGING (AI judge starts immediately; no countdown stall).
   */
  reviewSeconds: 0,

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
  /** Hold SETTLED faces on screen before next READY / seat advance (kills settle-then-jump) */
  diceSettleHoldMs: 1100,
  /** Extra linger after BEAN BUSTER before next seat (intentional beat + fade) */
  diceBustHoldMs: 2000,
  /** AI judging HTTP timeout */
  judgeTimeoutMs: 20000,

  /** Host / lobby */
  hostFailoverSeconds: 20,
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
 * Host may change configured rounds only on the first topic screen,
 * before any round has completed.
 */
export function canHostSetTopicRounds(input: {
  phase: string;
  topicRound: number;
  rounds: number;
}): boolean {
  return (
    input.phase === "TOPIC_SELECTION" &&
    input.topicRound === 0 &&
    isHostSelectableTopicRounds(input.rounds)
  );
}
