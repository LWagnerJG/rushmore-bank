/** Shared game types for Rushmore Bank (client + PartyKit server). */

export type Phase =
  | "lobby"
  | "category"
  | "build"
  | "rank"
  | "reveal"
  | "bank"
  | "bank_reveal";

export type BankAction =
  | "skip"
  | "pot_shot"
  | "double_judge"
  | "rematch_token"
  | "chip_heist";

export interface Player {
  id: string;
  name: string;
  chips: number;
  connected: boolean;
  isHost: boolean;
  isBot: boolean;
  /** Next Rushmore: rankings from this player count double */
  doubleJudge: boolean;
  /** Winner of rematch token picks next category */
  hasRematchToken: boolean;
}

export interface RushmoreSubmission {
  playerId: string;
  items: [string, string, string, string];
}

export interface RankingSubmission {
  judgeId: string;
  /** Ordered best → worst player IDs (excluding self) */
  orderedPlayerIds: string[];
  rationale: string;
}

export interface BankWager {
  playerId: string;
  action: BankAction;
  /** Chips risked (0 for skip) */
  amount: number;
}

export interface BankResult {
  dice: [number, number];
  total: number;
  potBefore: number;
  outcomes: Array<{
    playerId: string;
    action: BankAction;
    amount: number;
    delta: number;
    note: string;
  }>;
  rematchWinnerId: string | null;
  doubleJudgeWinnerIds: string[];
}

export interface RoomState {
  code: string;
  phase: Phase;
  players: Player[];
  pot: number;
  round: number;
  category: string | null;
  categoryVotes: Record<string, string>; // playerId → category option
  submissions: RushmoreSubmission[];
  rankings: RankingSubmission[];
  bankWagers: BankWager[];
  bankResult: BankResult | null;
  /** Aggregate reveal scores from last Rushmore rank */
  lastRushmoreScores: Record<string, number>;
  /** Who must pick category when rematch token is held */
  categoryPickerId: string | null;
  createdAt: number;
}

export type ClientMessage =
  | { type: "join"; name: string }
  | { type: "start" }
  | { type: "vote_category"; category: string }
  | { type: "pick_category"; category: string }
  | { type: "submit_rushmore"; items: [string, string, string, string] }
  | { type: "submit_ranking"; orderedPlayerIds: string[]; rationale: string }
  | { type: "submit_bank"; action: BankAction; amount: number }
  | { type: "advance" }
  | { type: "add_bot" }
  | { type: "roll_bank" };

export type ServerMessage =
  | { type: "state"; state: RoomState; youId: string }
  | { type: "error"; message: string }
  | { type: "joined"; youId: string; state: RoomState };

export const STARTING_CHIPS = 10;
export const MIN_PLAYERS = 2;

export const CATEGORY_PRESETS = [
  "Top 4 pizza toppings",
  "Best Marvel movies",
  "Worst chores",
  "Greatest road trip snacks",
  "Best decades for music",
  "Most overrated foods",
  "Dream vacation spots",
  "Best comfort TV shows",
] as const;

export const BANK_ACTIONS: Array<{
  id: BankAction;
  label: string;
  blurb: string;
  defaultAmount: number;
  minAmount: number;
  maxAmount: number;
}> = [
  {
    id: "skip",
    label: "Skip",
    blurb: "Sit this one out. Keep your chips.",
    defaultAmount: 0,
    minAmount: 0,
    maxAmount: 0,
  },
  {
    id: "pot_shot",
    label: "Pot Shot",
    blurb: "Wager into the pot. Dice 7+ pays even money from the pot.",
    defaultAmount: 2,
    minAmount: 1,
    maxAmount: 3,
  },
  {
    id: "double_judge",
    label: "Double Judge",
    blurb: "Wager 2. Win on 8+ → your next Rushmore rankings count double.",
    defaultAmount: 2,
    minAmount: 2,
    maxAmount: 2,
  },
  {
    id: "rematch_token",
    label: "Rematch Token",
    blurb: "Wager 3. Win on 10+ → you pick the next category.",
    defaultAmount: 3,
    minAmount: 3,
    maxAmount: 3,
  },
  {
    id: "chip_heist",
    label: "Chip Heist",
    blurb: "Wager 1. Hit 2 or 12 → steal 2 chips from the richest player.",
    defaultAmount: 1,
    minAmount: 1,
    maxAmount: 1,
  },
];

export function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "lobby":
      return "Lobby";
    case "category":
      return "Pick Category";
    case "build":
      return "Build Rushmore";
    case "rank":
      return "Rank & Rationale";
    case "reveal":
      return "Reveal";
    case "bank":
      return "Wager";
    case "bank_reveal":
      return "Dice Results";
  }
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

export function randomRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
