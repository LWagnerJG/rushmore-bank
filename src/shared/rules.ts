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
  productionUrl: "https://roundacats.vercel.app",

  /** Players */
  minPlayers: 2,
  maxPlayers: 10,
  startBalance: 0,
  picksPerPlayer: 4,

  /** Topics */
  /** Shortlist size (choices offered): 3 when 2–5 players, 2 when 6–10 */
  topicShortlistSmall: 3,
  topicShortlistLarge: 2,
  topicShortlistSmallMaxPlayers: 5,
  /**
   * Topic rounds *played* (not choices offered):
   * 3 rounds with 2–5 players; 2 rounds with 6–10.
   */
  topicRoundsSmall: 3,
  topicRoundsLarge: 2,
  topicVoteSeconds: 20,
  majorityRerollsPerSelection: 1,
  /** Soft target session length */
  targetMinutesMin: 25,
  targetMinutesMax: 30,

  /** Draft (no prep phase — topic lock goes straight to draft) */
  pickClockSeconds: 30,
  /** Short grace after pick clock hits 0 before miss */
  pickGraceSeconds: 5,
  hostExtendSeconds: 15,
  reviewSeconds: 30,

  /** Voting / AI */
  humanVoteSeconds: 45,
  scoreBase: 20,
  aiAwardMin: 0,
  aiAwardMax: 40,
  stonesPerHumanVote: 5,
  /** Fallback when AI unavailable: neutral mid award */
  aiFallbackAward: 20,
  aiFallbackLabel: "Judge unavailable — neutral award applied.",
  aiExplanationMaxWords: 45,
  aiPromptVersion: "quarry-judge-v1",

  /** Wagers */
  /** Earlier banked stones wagerable per topic: min(cap, balance) */
  earlierWagerCap: 25,
  wagerTimeoutSeconds: 20,

  /** Dice — per-player BANK mini-rounds (not rotating single throws) */
  diceDecisionCountdownSeconds: 5,
  diceIdleBankSeconds: 10,
  diceSoftBudgetMs: 3 * 60 * 1000,
  /**
   * Soft settle after budget once this many personal BANK turns finished.
   * 0 = time alone is enough at the next bank boundary.
   */
  diceMinBanksBeforeSettlement: 0,
  /** Shared tumble duration before authoritative reveal */
  diceAnimMs: 2400,
  safePersonalRolls: 2,
  /** On safe rolls, a seven awards this instead of face sum */
  sevenSafeBonus: 70,
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

export function topicShortlistCount(playerCount: number): number {
  if (playerCount <= RULES.topicShortlistSmallMaxPlayers) {
    return RULES.topicShortlistSmall;
  }
  return RULES.topicShortlistLarge;
}

/** Rounds played this game (distinct from shortlist / choices offered). */
export function topicRoundsForPlayerCount(playerCount: number): number {
  if (playerCount <= RULES.topicShortlistSmallMaxPlayers) {
    return RULES.topicRoundsSmall;
  }
  return RULES.topicRoundsLarge;
}
