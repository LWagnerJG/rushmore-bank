import { RULES } from "../rules";

export interface AiScores {
  topicFit: number; // 0–10
  pickStrength: number; // 0–20
  rosterQuality: number; // 0–10
}

export function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function aiAwardFromScores(scores: AiScores): number {
  const topicFit = clampInt(scores.topicFit, 0, 10);
  const pickStrength = clampInt(scores.pickStrength, 0, 20);
  const rosterQuality = clampInt(scores.rosterQuality, 0, 10);
  return clampInt(
    topicFit + pickStrength + rosterQuality,
    RULES.aiAwardMin,
    RULES.aiAwardMax,
  );
}

/**
 * earned = 20 + ai_award(0–40) + 5 * votes
 * Everyone earns stones even with 0 votes.
 */
export function computeEarnedStones(opts: {
  votes: number;
  aiAward: number;
}): number {
  const votes = Math.max(0, Math.floor(opts.votes));
  const ai = clampInt(opts.aiAward, RULES.aiAwardMin, RULES.aiAwardMax);
  return RULES.scoreBase + ai + RULES.stonesPerHumanVote * votes;
}

export function fallbackAiAward(): number {
  return RULES.aiFallbackAward;
}
