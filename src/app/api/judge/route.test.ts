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
      "x-quarry-judge": "partyserver",
    },
    body: JSON.stringify(body),
  });
}

function judgmentsJson(
  overrides?: Partial<{
    r1Explanation: string;
    omitR2: boolean;
    badScore: boolean;
  }>,
) {
  const judgments = [
    {
      anonId: "R1",
      topicFit: overrides?.badScore ? "nope" : 8,
      pickStrength: 16,
      rosterQuality: 7,
      explanation: overrides?.r1Explanation ?? "Solid animal Mount Rushmore.",
    },
  ];
  if (!overrides?.omitR2) {
    judgments.push({
      anonId: "R2",
      topicFit: 7,
      pickStrength: 14,
      rosterQuality: 6,
      explanation: "Good variety of pets.",
    });
  }
  return JSON.stringify({ judgments });
}

function geminiOkResponse(text = judgmentsJson()) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text }],
          },
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function modelsListResponse(
  ids: string[] = [
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
    "gemini-3.6-flash",
  ],
) {
  return new Response(
    JSON.stringify({
      models: ids.map((id) => ({ name: `models/${id}` })),
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function isModelsList(url: string) {
  return (
    url.includes("/v1beta/models?") && !url.includes(":generateContent")
  );
}

function isGenerate(url: string) {
  return url.includes(":generateContent");
}

describe("/api/judge free-tier flash-lite chain", () => {
  const originalEnv = { ...process.env };
  const fetchMock = vi.fn();

  beforeEach(async () => {
    vi.useRealTimers();
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.JUDGE_SECRET;
    const mod = await import("./route");
    mod.__resetGeminiModelCacheForTests();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns neutral fallback with no_key when no AI keys are set", async () => {
    const { POST } = await import("./route");
    const res = await POST(partyRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fallback).toBe(true);
    expect(data.fallbackReason).toBe("no_key");
    expect(data.limitation).toBe(RULES.aiFallbackLabel);
    expect(data.limitation).not.toMatch(/HTTP|\d{3}/);
    expect(data.judgments).toHaveLength(2);
    expect(data.judgments[0].explanation).toBe(RULES.aiFallbackLabel);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("success: calls flash-lite first after verifying models list", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (isModelsList(url)) return modelsListResponse();
      if (isGenerate(url)) return geminiOkResponse();
      return new Response("nope", { status: 500 });
    });

    const { POST } = await import("./route");
    const res = await POST(partyRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fallback).toBe(false);
    expect(data.fallbackReason).toBeUndefined();
    expect(data.judgments[0].topicFit).toBe(8);
    expect(data.model).toBe("gemini-3.5-flash-lite");
    expect(typeof data.latencyMs).toBe("number");

    const generateUrls = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .filter(isGenerate);
    expect(generateUrls[0]).toContain("gemini-3.5-flash-lite");
    expect(generateUrls.some((u) => u.includes("api.openai.com"))).toBe(false);
  });

  it("429 skips straight to the next model", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (isModelsList(url)) return modelsListResponse();
      if (url.includes("gemini-3.5-flash-lite")) {
        return new Response("rate", { status: 429 });
      }
      if (isGenerate(url)) return geminiOkResponse();
      return new Response("nope", { status: 500 });
    });

    const { POST } = await import("./route");
    const res = await POST(partyRequest());
    const data = await res.json();
    expect(data.fallback).toBe(false);
    expect(data.model).toMatch(/gemini-flash-latest|gemini-3\.6-flash/);
    const generateUrls = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .filter(isGenerate);
    expect(generateUrls.some((u) => u.includes("gemini-3.5-flash-lite"))).toBe(
      true,
    );
    // Only one attempt on the rate-limited model (no retry)
    expect(
      generateUrls.filter((u) => u.includes("gemini-3.5-flash-lite")),
    ).toHaveLength(1);
  });

  it("malformed output tries next model then full fallback", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (isModelsList(url)) {
        return modelsListResponse(["gemini-3.5-flash-lite"]);
      }
      if (isGenerate(url)) {
        return geminiOkResponse("not-json{{{");
      }
      return new Response("nope", { status: 500 });
    });

    const { POST } = await import("./route");
    const res = await POST(partyRequest());
    const data = await res.json();
    expect(data.fallback).toBe(true);
    expect(data.fallbackReason).toBe("invalid_output");
    expect(
      data.judgments.every(
        (j: { explanation: string }) => j.explanation === RULES.aiFallbackLabel,
      ),
    ).toBe(true);
  });

  it("missing roster ID yields full fallback, never a mixed score set", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (isModelsList(url)) {
        return modelsListResponse(["gemini-3.5-flash-lite"]);
      }
      if (isGenerate(url)) {
        return geminiOkResponse(judgmentsJson({ omitR2: true }));
      }
      return new Response("nope", { status: 500 });
    });

    const { POST, normalizeJudgments } = await import("./route");
    expect(
      normalizeJudgments(
        {
          judgments: [
            {
              anonId: "R1",
              topicFit: 8,
              pickStrength: 16,
              rosterQuality: 7,
              explanation: "ok",
            },
          ],
        },
        [
          { anonId: "R1", picks: ["a"] },
          { anonId: "R2", picks: ["b"] },
        ],
      ),
    ).toBeNull();

    const res = await POST(partyRequest());
    const data = await res.json();
    expect(data.fallback).toBe(true);
    expect(data.fallbackReason).toBe("invalid_output");
    // Full fallback — every row uses the neutral label (no mix of real + fill-ins)
    expect(data.judgments).toHaveLength(2);
    expect(
      data.judgments.every(
        (j: { explanation: string }) =>
          j.explanation === RULES.aiFallbackLabel,
      ),
    ).toBe(true);
  });

  it("timeout aborts a hung provider and returns fallbackReason timeout", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    vi.useFakeTimers();

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (isModelsList(url)) return modelsListResponse(["gemini-3.5-flash-lite"]);
      if (isGenerate(url)) {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;
          signal.addEventListener("abort", () => {
            const err = new Error("Aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }
      return new Response("nope", { status: 500 });
    });

    const { POST } = await import("./route");
    const pending = POST(partyRequest());
    // Advance past provider timeout + request budget
    for (let i = 0; i < 40; i++) {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(500);
    }
    const res = await pending;
    const data = await res.json();
    expect(data.fallback).toBe(true);
    expect(data.fallbackReason).toBe("timeout");
    expect(JSON.stringify(data)).not.toMatch(/HTTP|503|429/);
  });

  it("skips 404 models and continues the chain", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (isModelsList(url)) {
        return modelsListResponse([
          "gemini-3.5-flash-lite",
          "gemini-flash-latest",
        ]);
      }
      if (url.includes("gemini-3.5-flash-lite")) {
        return new Response("gone", { status: 404 });
      }
      if (isGenerate(url)) return geminiOkResponse();
      return new Response("nope", { status: 500 });
    });

    const { POST } = await import("./route");
    const res = await POST(partyRequest());
    const data = await res.json();
    expect(data.fallback).toBe(false);
    expect(data.model).toBe("gemini-flash-latest");
  });

  it("uses Groq only when GROQ_API_KEY is set and Gemini is exhausted", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    process.env.GROQ_API_KEY = "test-groq";

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (isModelsList(url)) {
        return modelsListResponse(["gemini-3.5-flash-lite"]);
      }
      if (url.includes("generativelanguage.googleapis.com")) {
        return new Response("rate", { status: 429 });
      }
      if (url.includes("api.groq.com")) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: judgmentsJson(),
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("nope", { status: 500 });
    });

    const { POST } = await import("./route");
    const res = await POST(partyRequest());
    const data = await res.json();
    expect(data.fallback).toBe(false);
    expect(data.model).toBe("llama-3.1-8b-instant");
    expect(
      fetchMock.mock.calls.some((c) => String(c[0]).includes("api.groq.com")),
    ).toBe(true);
  });

  it("does not call OpenAI even if OPENAI_API_KEY is present", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    process.env.OPENAI_API_KEY = "test-openai";
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (isModelsList(url)) return modelsListResponse();
      if (isGenerate(url)) return geminiOkResponse();
      return new Response("nope", { status: 500 });
    });

    const { POST } = await import("./route");
    await POST(partyRequest());
    expect(
      fetchMock.mock.calls.some((c) => String(c[0]).includes("api.openai.com")),
    ).toBe(false);
  });

  it("orders flash-lite ahead of other flash models from the live list", async () => {
    const { orderGeminiModelsFromList } = await import("./route");
    const ordered = orderGeminiModelsFromList(
      new Set([
        "gemini-3.6-flash",
        "gemini-flash-latest",
        "gemini-3.5-flash-lite",
        "gemini-2.0-flash",
      ]),
    );
    expect(ordered[0]).toBe("gemini-3.5-flash-lite");
    expect(ordered.indexOf("gemini-3.5-flash-lite")).toBeLessThan(
      ordered.indexOf("gemini-flash-latest"),
    );
  });

  it("accepts GOOGLE_GENERATIVE_AI_API_KEY as Gemini alias", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-google";
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (isModelsList(url)) return modelsListResponse();
      if (isGenerate(url)) return geminiOkResponse();
      return new Response("nope", { status: 500 });
    });

    const { POST } = await import("./route");
    const res = await POST(partyRequest());
    const data = await res.json();
    expect(data.fallback).toBe(false);
  });

  it("denies anonymous callers when a key is set and JUDGE_SECRET is unset", async () => {
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

  it("never surfaces HTTP codes on Gemini failure", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    vi.useFakeTimers();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (isModelsList(url)) return modelsListResponse();
      return new Response("nope", { status: 503 });
    });

    const { POST } = await import("./route");
    const pending = POST(partyRequest());
    for (let i = 0; i < 40; i++) {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(500);
    }
    const res = await pending;
    const data = await res.json();
    expect(data.fallback).toBe(true);
    expect(data.limitation).toBe(RULES.aiFallbackLabel);
    expect(JSON.stringify(data)).not.toMatch(/HTTP|503|429/);
  });
});
