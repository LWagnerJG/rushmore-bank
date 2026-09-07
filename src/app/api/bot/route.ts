import { NextResponse } from "next/server";

type Mount = {
  playerId: string;
  name: string;
  items: string[];
};

type Body = {
  category?: string;
  mounts?: Mount[];
};

function heuristic(category: string, mounts: Mount[]) {
  // Prefer mounts with more unique / longer items as a silly "thoughtfulness" proxy
  const scored = mounts.map((m) => {
    const uniqueness = new Set(m.items.map((i) => i.toLowerCase())).size;
    const length = m.items.join(" ").length;
    const spice = m.items.some((i) => /honey|chaos|underrated|wild/i.test(i))
      ? 3
      : 0;
    return { id: m.playerId, score: uniqueness * 4 + length * 0.15 + spice };
  });
  scored.sort((a, b) => b.score - a.score);
  const orderedPlayerIds = scored.map((s) => s.id);
  const top = mounts.find((m) => m.playerId === orderedPlayerIds[0]);
  const rationale = top
    ? `"${top.items[0]}" as the #1 face for "${category}" feels earned — the rest of ${top.name}'s Mount actually supports it.`
    : `Strongest overall Mount for ${category}.`;
  return { orderedPlayerIds, rationale, source: "heuristic" as const };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const category = (body.category ?? "this category").slice(0, 80);
  const mounts = Array.isArray(body.mounts) ? body.mounts.slice(0, 12) : [];
  if (mounts.length === 0) {
    return NextResponse.json({ error: "No mounts" }, { status: 400 });
  }

  const fallback = heuristic(category, mounts);
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    return NextResponse.json(fallback);
  }

  try {
    const prompt = `You help judge a party game called Rushmore Bank. Category: "${category}".
Players submitted Mount Rushmore top-4 lists. Rank the players best-to-worst and give one short rationale (max 160 chars) for why #1 beats the rest.
Return JSON only: {"orderedPlayerIds":["id",...],"rationale":"..."}.
Mounts: ${JSON.stringify(mounts)}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are RushBot, a witty party-game judge. JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json(fallback);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json(fallback);
    const parsed = JSON.parse(content) as {
      orderedPlayerIds?: string[];
      rationale?: string;
    };
    const ids = parsed.orderedPlayerIds?.filter((id) =>
      mounts.some((m) => m.playerId === id),
    );
    if (!ids || ids.length !== mounts.length) {
      return NextResponse.json(fallback);
    }
    return NextResponse.json({
      orderedPlayerIds: ids,
      rationale: (parsed.rationale ?? fallback.rationale).slice(0, 200),
      source: "openai",
    });
  } catch {
    return NextResponse.json(fallback);
  }
}
