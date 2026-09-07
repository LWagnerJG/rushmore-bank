import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { RULES } from "@/shared/rules";

const sampleBody = {
  topic: "Best pets",
  scopeBoundary: "Animals only",
  rosters: [
    { anonId: "R1", picks: ["dog", "cat", "rabbit", "hamster"] },
    { anonId: "R2", picks: ["parrot", "fish", "turtle", "ferret"] },
  ],
};

function partyRequest(body: unknown = sampleBody): NextRequest {
  return new NextRequest("http://localhost/api/judge", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-quarry-judge": "partykit",
    },
    body: JSON.stringify(body),
  });
}

describe("/api/judge Gemini preference", () => {
  const originalEnv = { ...process.env };
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.JUDGE_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("returns neutral fallback when no AI keys are set", async () => {
    const { POST } = await import("./route");
    const res = await POST(partyRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fallback).toBe(true);
    expect(data.limitation).toMatch(/GEMINI_API_KEY/);
    expect(data.limitation).toMatch(/OPENAI_API_KEY/);
    expect(data.judgments).toHaveLength(2);
    expect(data.judgments[0].explanation).toBe(RULES.aiFallbackLabel);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Gemini when GEMINI_API_KEY is set (even if OpenAI is also set)", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    process.env.OPENAI_API_KEY = "test-openai";

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      judgments: [
                        {
                          anonId: "R1",
                          topicFit: 8,
                          pickStrength: 16,
                          rosterQuality: 7,
                          explanation: "Solid animal Mount Rushmore.",
                        },
                        {
                          anonId: "R2",
                          topicFit: 7,
                          pickStrength: 14,
                          rosterQuality: 6,
                          explanation: "Good variety of pets.",
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const { POST } = await import("./route");
    const res = await POST(partyRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fallback).toBe(false);
    expect(data.judgments[0].topicFit).toBe(8);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("generativelanguage.googleapis.com");
    expect(calledUrl).toContain("gemini-2.0-flash");
    expect(calledUrl).not.toContain("api.openai.com");
  });

  it("uses OpenAI only when Gemini keys are absent", async () => {
    process.env.OPENAI_API_KEY = "test-openai";

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  judgments: [
                    {
                      anonId: "R1",
                      topicFit: 6,
                      pickStrength: 12,
                      rosterQuality: 5,
                      explanation: "Decent picks.",
                    },
                    {
                      anonId: "R2",
                      topicFit: 5,
                      pickStrength: 11,
                      rosterQuality: 5,
                      explanation: "Fair roster.",
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const { POST } = await import("./route");
    const res = await POST(partyRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fallback).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.openai.com");
  });

  it("falls back uniformly on Gemini HTTP failure", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    fetchMock.mockResolvedValue(new Response("nope", { status: 503 }));

    const { POST } = await import("./route");
    const res = await POST(partyRequest());
    const data = await res.json();
    expect(data.fallback).toBe(true);
    expect(data.limitation).toMatch(/Gemini HTTP 503/);
    expect(data.judgments.every((j: { explanation: string }) => j.explanation === RULES.aiFallbackLabel)).toBe(
      true,
    );
  });

  it("accepts GOOGLE_GENERATIVE_AI_API_KEY as Gemini alias", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-google";
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      judgments: [
                        {
                          anonId: "R1",
                          topicFit: 9,
                          pickStrength: 18,
                          rosterQuality: 8,
                          explanation: "Excellent.",
                        },
                        {
                          anonId: "R2",
                          topicFit: 8,
                          pickStrength: 15,
                          rosterQuality: 7,
                          explanation: "Strong.",
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const { POST } = await import("./route");
    const res = await POST(partyRequest());
    const data = await res.json();
    expect(data.fallback).toBe(false);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "generativelanguage.googleapis.com",
    );
  });

  it("denies anonymous callers when a paid key is set and JUDGE_SECRET is unset", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/judge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sampleBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
