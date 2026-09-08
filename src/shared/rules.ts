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
  /** Always offer exactly this many topic choices for voting */
  topicShortlistSize: 4,
  /**
   * Topic rounds *played* (not choices offered):
   * 3 rounds with 2–5 players; 2 rounds with 6–10.
   */
  topicRoundsSmallMaxPlayers: 5,
  topicRoundsSmall: 3,
  topicRoundsLarge: 2,
  /** Topic vote — no timer; advances when every connected player has voted */
  topicVoteSeconds: 0,
  /** Soft target session length */
  targetMinutesMin: 25,
  targetMinutesMax: 30,

  /** Draft (no prep phase — topic lock goes straight to draft) */
  /** Enough to type one answer on a phone — not lounge time. Host can +15s. */
  pickClockSeconds: 35,
  /** Short grace after pick clock hits 0 before miss */
  pickGraceSeconds: 3,
  hostExtendSeconds: 15,
  /** Skim board only */
  reviewSeconds: 20,

  /** Voting / AI */
  /** Read Rushmores + whys */
  humanVoteSeconds: 40,
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

  /** Wagers — every owned bean is wagerable (E + B) */
  wagerTimeoutSeconds: 20,

  /** Dice — personal turn: keep rolling until Bank or bust, then next seat */
  /** Brief “you’re up” beat before Roll unlocks (Bank already available). */
  diceDecisionCountdownSeconds: 3,
  /** Roll / Bank decision window once READY (also continues after non-bust). */
  diceIdleBankSeconds: 15,
  /** Shared tumble duration before authoritative reveal */
  diceAnimMs: 2400,
  /** Hold SETTLED faces on screen before next READY / seat advance (kills settle-then-jump) */
  diceSettleHoldMs: 1100,
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
