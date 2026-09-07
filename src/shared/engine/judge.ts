/**
 * Server-side AI judging helpers — validation + uniform fallback.
 * Never trust client-authored award values.
 */
import { RULES } from "../rules";
import {
  aiAwardFromScores,
  clampInt,
  computeEarnedStones,
  fallbackAiAward,
} from "./scoring";
import type { RosterScore } from "../types";

export interface RawJudgment {
  anonId?: string;
  playerId?: string;
  topicFit: number;
  pickStrength: number;
  rosterQuality: number;
  explanation: string;
}

export interface AnonRoster {
  anonId: string;
  playerId: string;
  picks: string[];
}

export function buildAnonymousRosters(
  seatOrder: string[],
  picksByPlayer: Record<string, string[]>,
): AnonRoster[] {
  return seatOrder.map((playerId, idx) => ({
    anonId: `R${idx + 1}`,
    playerId,
    picks: (picksByPlayer[playerId] ?? []).slice(0, RULES.picksPerPlayer),
  }));
}

/** Payload sent to the judge — no names, votes, balances, notes, or host. */
export function judgeRequestPayload(
  topic: string,
  scopeBoundary: string,
  rosters: AnonRoster[],
) {
  return {
    topic,
    scopeBoundary,
    promptVersion: RULES.aiPromptVersion,
    rosters: rosters.map((r) => ({
      anonId: r.anonId,
      picks: r.picks,
    })),
  };
}

export function neutralJudgments(rosters: AnonRoster[]): RosterScore[] {
  return rosters.map((r) => {
    const aiAward = fallbackAiAward();
    return {
      playerId: r.playerId,
      votes: 0,
      aiAward,
      topicFit: 5,
      pickStrength: 10,
      rosterQuality: 5,
      explanation: RULES.aiFallbackLabel,
      earned: computeEarnedStones({ votes: 0, aiAward }),
      aiFallback: true,
    };
  });
}

/**
 * Validate AI output against expected roster IDs.
 * Rejects non-finite scores, missing/duplicate IDs, oversized explanations.
 * On any structural failure, returns null (caller applies neutral fallback).
 */
export function validateAndMapJudgments(
  rosters: AnonRoster[],
  raw: RawJudgment[],
): RosterScore[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const byAnon = new Map(rosters.map((r) => [r.anonId, r]));
  const byPlayer = new Map(rosters.map((r) => [r.playerId, r]));
  const seen = new Set<string>();
  const mapped: RosterScore[] = [];

  for (const j of raw) {
    const anonId = j.anonId;
    const playerIdHint = j.playerId;
    const roster =
      (anonId && byAnon.get(anonId)) ||
      (playerIdHint && byPlayer.get(playerIdHint)) ||
      null;
    if (!roster) return null;
    if (seen.has(roster.playerId)) return null;
    seen.add(roster.playerId);

    const topicFit = Number(j.topicFit);
    const pickStrength = Number(j.pickStrength);
    const rosterQuality = Number(j.rosterQuality);
    if (
      !Number.isFinite(topicFit) ||
      !Number.isFinite(pickStrength) ||
      !Number.isFinite(rosterQuality)
    ) {
      return null;
    }

    const tf = clampInt(topicFit, 0, 10);
    const ps = clampInt(pickStrength, 0, 20);
    const rq = clampInt(rosterQuality, 0, 10);
    const aiAward = aiAwardFromScores({
      topicFit: tf,
      pickStrength: ps,
      rosterQuality: rq,
    });
    const explanation = String(j.explanation ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, RULES.aiExplanationMaxWords)
      .join(" ");
    if (!explanation) return null;

    mapped.push({
      playerId: roster.playerId,
      votes: 0,
      aiAward,
      topicFit: tf,
      pickStrength: ps,
      rosterQuality: rq,
      explanation,
      earned: computeEarnedStones({ votes: 0, aiAward }),
      aiFallback: false,
    });
  }

  if (mapped.length !== rosters.length) return null;
  // Ensure every expected player present
  for (const r of rosters) {
    if (!mapped.some((m) => m.playerId === r.playerId)) return null;
  }
  return mapped;
}

export function applyVoteCounts(
  scores: RosterScore[],
  humanVotes: Record<string, string>,
): RosterScore[] {
  const voteCounts: Record<string, number> = {};
  for (const t of Object.values(humanVotes)) {
    voteCounts[t] = (voteCounts[t] ?? 0) + 1;
  }
  return scores.map((s) => {
    const votes = voteCounts[s.playerId] ?? 0;
    return {
      ...s,
      votes,
      earned: computeEarnedStones({ votes, aiAward: s.aiAward }),
    };
  });
}

/**
 * Legacy API heuristic — MUST be position-invariant.
 * Prefer calling neutralJudgments for fallback awards; this exists only so
 * /api/judge never varies by roster index.
 */
export function heuristicJudgeUniform(
  rosters: Array<{ anonId?: string; playerId?: string; picks: string[] }>,
): RawJudgment[] {
  return rosters.map((r) => {
    const uniq = new Set(r.picks.map((p) => p.toLowerCase())).size;
    // Deliberately ignore index — participation-neutral structure only.
    const topicFit = Math.min(10, 5 + (uniq >= 4 ? 3 : Math.min(3, uniq)));
    const pickStrength = Math.min(20, 8 + uniq * 2);
    const rosterQuality = Math.min(10, 4 + Math.min(4, uniq));
    return {
      anonId: r.anonId,
      playerId: r.playerId,
      topicFit,
      pickStrength,
      rosterQuality,
      explanation: RULES.aiFallbackLabel,
    };
  });
}
