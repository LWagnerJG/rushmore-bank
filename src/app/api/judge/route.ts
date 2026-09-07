import { NextRequest, NextResponse } from "next/server";
import { RULES } from "@/shared/rules";

export const runtime = "nodejs";

interface JudgeBody {
  topic: string;
  scopeBoundary: string;
  rosters: Array<{ playerId: string; name: string; picks: string[] }>;
}

interface Judgment {
  playerId: string;
  topicFit: number;
  pickStrength: number;
  rosterQuality: number;
  explanation: string;
}

function heuristicJudge(body: JudgeBody): Judgment[] {
  return body.rosters.map((r, idx) => {
    const uniq = new Set(r.picks.map((p) => p.toLowerCase())).size;
    const topicFit = Math.min(10, 5 + (uniq >= 4 ? 3 : uniq));
    const pickStrength = Math.min(20, 8 + uniq * 2 + (idx % 3));
    const rosterQuality = Math.min(10, 4 + Math.min(4, uniq));
    return {
      playerId: r.playerId,
      topicFit,
      pickStrength,
      rosterQuality,
      explanation: RULES.aiFallbackLabel,
    };
  });
}

export async function POST(req: NextRequest) {
  let body: JudgeBody;
  try {
    body = (await req.json()) as JudgeBody;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  if (!body?.rosters?.length || !body.topic) {
    return NextResponse.json({ error: "Missing rosters" }, { status: 400 });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({
      judgments: heuristicJudge(body),
      fallback: true,
      promptVersion: RULES.aiPromptVersion,
      limitation: "OPENAI_API_KEY unset — neutral heuristic judge used.",
    });
  }

  const system = `You are Quarry's AI judge (prompt ${RULES.aiPromptVersion}).
Score each Mount Rushmore roster for the topic.
Return ONLY JSON: {"judgments":[{"playerId":"...","topicFit":0-10,"pickStrength":0-20,"rosterQuality":0-10,"explanation":"≤45 words"}]}
topic_fit 0-10, pick_strength 0-20, roster_quality 0-10. Be fair, concise, playful. No spoilers about other players.`;

  const user = JSON.stringify({
    topic: body.topic,
    scopeBoundary: body.scopeBoundary,
    rosters: body.rosters,
  });

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({
        judgments: heuristicJudge(body),
        fallback: true,
        promptVersion: RULES.aiPromptVersion,
        limitation: `OpenAI HTTP ${res.status} — fallback applied.`,
      });
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { judgments?: Judgment[] };
    const judgments = (parsed.judgments ?? []).map((j) => ({
      playerId: j.playerId,
      topicFit: Math.max(0, Math.min(10, Math.round(Number(j.topicFit) || 0))),
      pickStrength: Math.max(
        0,
        Math.min(20, Math.round(Number(j.pickStrength) || 0)),
      ),
      rosterQuality: Math.max(
        0,
        Math.min(10, Math.round(Number(j.rosterQuality) || 0)),
      ),
      explanation: String(j.explanation ?? "")
        .split(/\s+/)
        .slice(0, RULES.aiExplanationMaxWords)
        .join(" "),
    }));

    // Ensure every roster has a judgment
    const byId = new Map(judgments.map((j) => [j.playerId, j]));
    const complete = body.rosters.map((r) => {
      return (
        byId.get(r.playerId) ?? {
          playerId: r.playerId,
          topicFit: 5,
          pickStrength: 10,
          rosterQuality: 5,
          explanation: RULES.aiFallbackLabel,
        }
      );
    });

    return NextResponse.json({
      judgments: complete,
      fallback: false,
      promptVersion: RULES.aiPromptVersion,
    });
  } catch (e) {
    return NextResponse.json({
      judgments: heuristicJudge(body),
      fallback: true,
      promptVersion: RULES.aiPromptVersion,
      limitation: `Judge error — fallback applied. (${e instanceof Error ? e.message : "unknown"})`,
    });
  }
}
