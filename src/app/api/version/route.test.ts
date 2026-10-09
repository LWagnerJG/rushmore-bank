import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("GET /api/version", () => {
  const prevSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  const prevHost = process.env.NEXT_PUBLIC_PARTYKIT_HOST;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = "deadbeefcafebabe";
    process.env.NEXT_PUBLIC_PARTYKIT_HOST = "beans-party.beans-lwagner.workers.dev";
    vi.resetModules();
  });

  afterEach(() => {
    if (prevSha === undefined) delete process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
    else process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = prevSha;
    if (prevHost === undefined) delete process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    else process.env.NEXT_PUBLIC_PARTYKIT_HOST = prevHost;
  });

  it("returns sha + party host with no-store caching", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/i);
    const body = await res.json();
    expect(body.sha).toBe("deadbeef");
    expect(body.partyHost).toBe("beans-party.beans-lwagner.workers.dev");
    expect(typeof body.generatedAt).toBe("string");
  });
});
