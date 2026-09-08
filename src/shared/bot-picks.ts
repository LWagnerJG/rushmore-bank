/**
 * Topic-aware draft answers for admin bots.
 * Prefer real, relevant strings over placeholders so playtests feel human.
 */
import { normalizePick } from "./types";
import { starterDraftOptions } from "./draft-options";
import { getTopicById } from "./topics";

const GENERIC_POOL = [
  "The classics",
  "Crowd favorite",
  "Underrated pick",
  "Personal bias",
  "Hot take",
  "Safe choice",
  "Deep cut",
  "Controversial one",
  "Nostalgia pick",
  "Sleeper hit",
  "Main character energy",
  "Comfort pick",
  "All-timer",
  "Guilty pleasure",
  "Wildcard",
  "Fan favorite",
];

/** Keyword → plausible Mount Rushmore answers (when no starter catalog). */
const THEME_POOLS: Array<{ match: RegExp; picks: string[] }> = [
  {
    match: /nba|basketball|hoops/i,
    picks: [
      "Michael Jordan",
      "LeBron James",
      "Kobe Bryant",
      "Stephen Curry",
      "Magic Johnson",
      "Larry Bird",
      "Shaquille O'Neal",
      "Tim Duncan",
      "Kevin Durant",
      "Bill Russell",
    ],
  },
  {
    match: /nfl|quarterback|football/i,
    picks: [
      "Tom Brady",
      "Patrick Mahomes",
      "Joe Montana",
      "Peyton Manning",
      "Aaron Rodgers",
      "Johnny Unitas",
      "Dan Marino",
      "Drew Brees",
      "Josh Allen",
      "Lamar Jackson",
    ],
  },
  {
    match: /snack|food|eat|pizza|burger|candy|dessert/i,
    picks: [
      "Pizza",
      "Tacos",
      "Ice cream",
      "French fries",
      "Chocolate",
      "Burgers",
      "Sushi",
      "Cookies",
      "Nachos",
      "Mac and cheese",
    ],
  },
  {
    match: /movie|film|cinema/i,
    picks: [
      "The Godfather",
      "Pulp Fiction",
      "Inception",
      "The Matrix",
      "Star Wars",
      "Jurassic Park",
      "Goodfellas",
      "Spirited Away",
      "The Dark Knight",
      "Parasite",
    ],
  },
  {
    match: /tv|sitcom|show|series/i,
    picks: [
      "The Office",
      "Friends",
      "Breaking Bad",
      "Seinfeld",
      "The Sopranos",
      "Succession",
      "Parks and Rec",
      "Game of Thrones",
      "Stranger Things",
      "Ted Lasso",
    ],
  },
  {
    match: /music|song|album|band|artist|rapper/i,
    picks: [
      "Beyoncé",
      "The Beatles",
      "Taylor Swift",
      "Drake",
      "Prince",
      "Kendrick Lamar",
      "Nirvana",
      "Madonna",
      "Radiohead",
    ],
  },
  {
    match: /animal|dog|cat|pet/i,
    picks: [
      "Golden retriever",
      "Orange tabby",
      "Corgi",
      "Border collie",
      "Maine coon",
      "Beagle",
      "Siamese",
      "French bulldog",
      "Husky",
      "Black lab",
    ],
  },
  {
    match: /city|cities|place|travel|vacation|beach/i,
    picks: [
      "Tokyo",
      "Paris",
      "New York",
      "Barcelona",
      "Lisbon",
      "Kyoto",
      "Rome",
      "Mexico City",
      "Cape Town",
      "Sydney",
    ],
  },
  {
    match: /video.?game|gaming|nintendo|playstation|xbox/i,
    picks: [
      "Zelda",
      "Mario Kart",
      "Minecraft",
      "Halo",
      "GTA",
      "Pokémon",
      "Elden Ring",
      "Overwatch",
      "Fortnite",
      "Stardew Valley",
    ],
  },
  {
    match: /book|novel|author|read/i,
    picks: [
      "Pride and Prejudice",
      "1984",
      "Harry Potter",
      "The Hobbit",
      "To Kill a Mockingbird",
      "The Great Gatsby",
      "Dune",
      "Beloved",
      "Circe",
      "Educated",
    ],
  },
];

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffleCopy<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function themePool(topicText: string): string[] {
  for (const entry of THEME_POOLS) {
    if (entry.match.test(topicText)) return entry.picks;
  }
  return [];
}

/** Build a candidate list for a topic (starters → theme → generic). */
export function botPickCandidates(
  topicId: string,
  topicText: string,
): string[] {
  const starters = starterDraftOptions(topicId, topicText);
  const themed = themePool(topicText);
  const catalog = getTopicById(topicId);
  const fromBoundary =
    catalog?.scopeBoundary
      ?.split(/[.,;]/)
      .map((s) => s.trim())
      .filter(
        (s) =>
          s.length >= 4 &&
          s.length <= 40 &&
          !/^(or|and|but|with|including|e\.g)\b/i.test(s),
      )
      .slice(0, 6) ?? [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const text of [...starters, ...themed, ...fromBoundary, ...GENERIC_POOL]) {
    const clean = text.trim().replace(/\s+/g, " ").slice(0, 48);
    const norm = normalizePick(clean);
    if (!clean || seen.has(norm)) continue;
    seen.add(norm);
    out.push(clean);
  }
  return out;
}

/**
 * Choose one unused pick for a bot turn.
 * Deterministic-ish per bot+turn so remounts don't thrash, with variety across bots.
 */
export function chooseBotPick(opts: {
  topicId: string;
  topicText: string;
  botId: string;
  turnIndex: number;
  takenNormalized: string[];
}): string {
  const candidates = botPickCandidates(opts.topicId, opts.topicText);
  const seed = hashSeed(`${opts.botId}:${opts.turnIndex}:${opts.topicId}`);
  const ordered = shuffleCopy(candidates, seed);
  const taken = new Set(opts.takenNormalized);
  for (const c of ordered) {
    if (!taken.has(normalizePick(c))) return c;
  }
  // Exhausted catalog — still produce a unique-looking answer.
  for (let i = 0; i < 40; i++) {
    const text = `Pick ${(seed + i) % 97}`.slice(0, 48);
    if (!taken.has(normalizePick(text))) return text;
  }
  return `Answer ${opts.turnIndex + 1}`;
}

/** Human-ish delay range helpers (ms). */
export function botDelayMs(
  kind: "topic" | "draft" | "vote" | "bank" | "wager" | "dice",
  salt = 0,
): number {
  const ranges: Record<typeof kind, [number, number]> = {
    topic: [900, 2800],
    draft: [2200, 7500],
    vote: [1600, 5200],
    bank: [800, 2400],
    wager: [1200, 3800],
    dice: [900, 2800],
  };
  const [lo, hi] = ranges[kind];
  const span = hi - lo;
  const jitter = hashSeed(`delay:${kind}:${salt}`) % (span + 1);
  return lo + jitter;
}

/** Dice: bank vs roll — more likely to bank as pot grows / rolls pile up. */
export function botShouldBank(opts: {
  pot: number;
  personalRolls: number;
  botId: string;
}): boolean {
  if (opts.personalRolls <= 0) return false;
  if (opts.pot <= 0 && opts.personalRolls >= 1) {
    // Zero pot after weird state — still roll once more sometimes.
    return (hashSeed(opts.botId) % 5) === 0;
  }
  // Risk curve: early aggressive, later protective.
  const rollBias = Math.min(0.75, 0.12 * opts.personalRolls);
  const potBias = Math.min(0.55, opts.pot / 200);
  const threshold = 0.18 + rollBias + potBias;
  const roll = (hashSeed(`${opts.botId}:dice:${opts.personalRolls}:${opts.pot}`) % 1000) / 1000;
  return roll < threshold;
}

/** Wager amount from available beans — mix of keep / half / most. */
export function botWagerAmount(opts: {
  earned: number;
  banked: number;
  botId: string;
}): number {
  const max = Math.max(0, Math.floor(opts.earned) + Math.floor(opts.banked));
  if (max <= 0) return 0;
  const style = hashSeed(`${opts.botId}:wager`) % 5;
  if (style === 0) return 0;
  if (style === 1) return Math.min(max, Math.floor(opts.earned / 2));
  if (style === 2) return Math.min(max, Math.floor(opts.earned));
  if (style === 3) return Math.min(max, Math.floor(max * 0.6));
  return max;
}
