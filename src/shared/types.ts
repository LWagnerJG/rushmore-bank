/**
 * Quarry shared protocol — client + PartyKit server.
 * Currency = Stones. Display name = Quarry.
 */

import { RULES } from "./rules";
import type { TopicScope } from "./topics";

export type Phase =
  | "LOBBY"
  | "TOPIC_SELECTION"
  | "PREP"
  | "DRAFT"
  | "CORRECTION"
  | "REVIEW"
  | "VOTING_AND_JUDGING"
  | "SCORE_REVEAL"
  | "WAGER_SELECTION"
  | "DICE"
  | "ROUND_RESULTS"
  | "GAME_RESULTS";

export type DiceSubphase =
  | "COOLDOWN"
  | "READY"
  | "COMMITTED"
  | "SETTLED"
  | "WAITING"; // waiting for another player's turn / animation

export type PlayerRole = "player" | "spectator";

export interface Player {
  id: string;
  name: string;
  /** Banked stones (lifetime this game) */
  stones: number;
  connected: boolean;
  isHost: boolean;
  role: PlayerRole;
  /** Seat index among locked roster; null for spectators / pre-lock */
  seat: number | null;
  /** Guest token hash confirmation — id itself is the secure token */
  joinedAt: number;
}

export interface TopicOption {
  id: string;
  text: string;
  scope: TopicScope;
  scopeBoundary: string;
  isCustom?: boolean;
}

export interface DraftPick {
  playerId: string;
  text: string;
  pickIndex: number; // 0–3 within that player's roster
  turnIndex: number;
}

export interface RosterScore {
  playerId: string;
  votes: number;
  aiAward: number;
  topicFit: number;
  pickStrength: number;
  rosterQuality: number;
  explanation: string;
  earned: number;
  aiFallback: boolean;
}

export interface LedgerEntry {
  id: string;
  at: number;
  playerId: string;
  kind:
    | "earn"
    | "wager_lock"
    | "pot_delta"
    | "bank"
    | "bust"
    | "void_restore"
    | "adjust";
  amount: number;
  balanceAfter: number;
  note: string;
  topicRound: number;
}

export interface DiceBroadcast {
  rollerId: string;
  d1: number;
  d2: number;
  personalRollNumber: number;
  potBefore: number;
  potAfter: number;
  busted: boolean;
  note: string;
  /** Animation sync */
  animStartedAt: number;
  animSeed: number;
  outcomeKind: string;
}

export interface PartyPrompt {
  kind: "winner_sip" | "bust_sip";
  targetPlayerIds: string[];
  resolved: boolean;
}

export interface HostSettings {
  /** Override shortlist size; null = auto from player count */
  topicCountOverride: number | null;
  /** Preferred scope mix weights — empty = all */
  scopeMix: TopicScope[];
  partyMode: boolean;
}

export interface RoomState {
  code: string;
  phase: Phase;
  phaseRevision: number;
  players: Player[];
  /** Locked at game start */
  rosterLocked: boolean;
  settings: HostSettings;
  createdAt: number;
  /** Topic rounds completed */
  topicRound: number;
  /** Topics already used this game */
  usedTopicIds: string[];
  /** Current topic selection */
  topicOptions: TopicOption[];
  topicVotes: Record<string, string>; // playerId → topicId
  selectedTopic: TopicOption | null;
  topicRerollsUsed: number;
  /** Draft */
  seatOrder: string[]; // player ids in seat order
  starterOffset: number;
  draftCursor: number;
  draftOrder: number[]; // seat indices snake
  picks: DraftPick[];
  takenNormalized: string[]; // lowercased locked picks
  pickDeadlineAt: number | null;
  pickPaused: boolean;
  pickPauseRemainingMs: number | null;
  correctionTargetPickId: string | null; // turnIndex as string key
  correctionReason: "duplicate" | "invalid" | null;
  /** Voting */
  humanVotes: Record<string, string>; // voterId → targetPlayerId
  scores: RosterScore[];
  scoresLocked: boolean;
  /** Per-player earned this topic (before wager) */
  earnedThisRound: Record<string, number>;
  /** Wagers */
  wagers: Record<string, number>; // playerId → W
  wagerDeadlineAt: number | null;
  /** Dice */
  diceSubphase: DiceSubphase;
  diceTurnSeat: number;
  /** Players still active in dice (not busted / not pulled out) */
  diceActiveIds: string[];
  personalRollCounts: Record<string, number>;
  pots: Record<string, number>;
  protectedStones: Record<string, number>;
  lastDice: DiceBroadcast | null;
  diceDecisionDeadlineAt: number | null;
  diceIdleDeadlineAt: number | null;
  diceRoundStartedAt: number | null;
  diceLapsCompleted: number;
  /** Party mode */
  partyPrompt: PartyPrompt | null;
  /** Append-only stone ledger */
  ledger: LedgerEntry[];
  /** Checkpoint for Void Topic */
  checkpoint: {
    stones: Record<string, number>;
    topicRound: number;
  } | null;
  /** Timers */
  phaseDeadlineAt: number | null;
  /** Host last seen (for failover) */
  hostLastSeenAt: number;
  /** Action idempotency — last processed action ids */
  processedActionIds: string[];
  /** Game over flag */
  gameOver: boolean;
  /** Spectator-friendly notice */
  notice: string | null;
}

export type ClientMessage =
  | { type: "join"; name: string; role?: PlayerRole; actionId?: string }
  | { type: "update_settings"; settings: Partial<HostSettings>; actionId?: string }
  | { type: "start"; actionId?: string }
  | { type: "spin_topics"; actionId?: string }
  | { type: "vote_topic"; topicId: string; actionId?: string }
  | { type: "custom_topic"; text: string; scope: TopicScope; scopeBoundary: string; actionId?: string }
  | { type: "majority_reroll"; actionId?: string }
  | { type: "lock_in"; text: string; actionId?: string }
  | { type: "host_pause"; actionId?: string }
  | { type: "host_resume"; actionId?: string }
  | { type: "host_extend"; actionId?: string }
  | { type: "host_correct"; turnIndex: number; reason: "duplicate" | "invalid"; actionId?: string }
  | { type: "submit_vote"; targetPlayerId: string; actionId?: string }
  | { type: "submit_ai_judgments"; judgments: Array<{
      playerId: string;
      topicFit: number;
      pickStrength: number;
      rosterQuality: number;
      explanation: string;
    }>; fallback?: boolean; actionId?: string }
  | { type: "submit_wager"; amount: number; actionId?: string }
  | { type: "dice_ready_ack"; actionId?: string }
  | { type: "roll"; actionId?: string }
  | { type: "pull_out"; actionId?: string }
  | { type: "party_resolve"; choice: "done" | "pass"; actionId?: string }
  | { type: "next_topic"; actionId?: string }
  | { type: "end_game"; actionId?: string }
  | { type: "play_again"; actionId?: string }
  | { type: "void_topic"; actionId?: string }
  | { type: "advance"; actionId?: string }
  | { type: "host_heartbeat"; actionId?: string }
  | { type: "skip_review"; actionId?: string };

export type ServerMessage =
  | { type: "state"; state: PublicRoomState; youId: string }
  | { type: "error"; message: string }
  | { type: "joined"; youId: string; state: PublicRoomState };

/** Public state is RoomState (My Ideas never live on server). */
export type PublicRoomState = RoomState;

export function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "LOBBY":
      return "Lobby";
    case "TOPIC_SELECTION":
      return "Pick Topic";
    case "PREP":
      return "Prep";
    case "DRAFT":
      return "Draft";
    case "CORRECTION":
      return "Correction";
    case "REVIEW":
      return "Review";
    case "VOTING_AND_JUDGING":
      return "Vote";
    case "SCORE_REVEAL":
      return "Scores";
    case "WAGER_SELECTION":
      return "Wager";
    case "DICE":
      return "Dice";
    case "ROUND_RESULTS":
      return "Round Results";
    case "GAME_RESULTS":
      return "Final";
  }
}

export function normalizeRoomCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, RULES.roomCodeLength);
}

export function randomRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < RULES.roomCodeLength; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return out;
}

export function normalizePick(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function emptyHostSettings(): HostSettings {
  return {
    topicCountOverride: null,
    scopeMix: [],
    partyMode: RULES.partyModeDefault,
  };
}

export function emptyRoomState(code: string): RoomState {
  return {
    code,
    phase: "LOBBY",
    phaseRevision: 0,
    players: [],
    rosterLocked: false,
    settings: emptyHostSettings(),
    createdAt: Date.now(),
    topicRound: 0,
    usedTopicIds: [],
    topicOptions: [],
    topicVotes: {},
    selectedTopic: null,
    topicRerollsUsed: 0,
    seatOrder: [],
    starterOffset: 0,
    draftCursor: 0,
    draftOrder: [],
    picks: [],
    takenNormalized: [],
    pickDeadlineAt: null,
    pickPaused: false,
    pickPauseRemainingMs: null,
    correctionTargetPickId: null,
    correctionReason: null,
    humanVotes: {},
    scores: [],
    scoresLocked: false,
    earnedThisRound: {},
    wagers: {},
    wagerDeadlineAt: null,
    diceSubphase: "WAITING",
    diceTurnSeat: 0,
    diceActiveIds: [],
    personalRollCounts: {},
    pots: {},
    protectedStones: {},
    lastDice: null,
    diceDecisionDeadlineAt: null,
    diceIdleDeadlineAt: null,
    diceRoundStartedAt: null,
    diceLapsCompleted: 0,
    partyPrompt: null,
    ledger: [],
    checkpoint: null,
    phaseDeadlineAt: null,
    hostLastSeenAt: Date.now(),
    processedActionIds: [],
    gameOver: false,
    notice: null,
  };
}

export { RULES };
