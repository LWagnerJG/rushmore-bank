import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("GET /api/version", () => {
  const prevSha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  const prevHost = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  const prevPlatform = process.env.BEANS_PLATFORM;
  const prevCf = process.env.CF_PAGES;
  const prevVercel = process.env.VERCEL;
  const prevVercelEnv = process.env.VERCEL_ENV;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = "deadbeefcafebabe";
    process.env.NEXT_PUBLIC_PARTYKIT_HOST = "beans-party.beans-lwagner.workers.dev";
    delete process.env.BEANS_PLATFORM;
    delete process.env.CF_PAGES;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    vi.resetModules();
  });

  afterEach(() => {
    if (prevSha === undefined) delete process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
    else process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = prevSha;
    if (prevHost === undefined) delete process.env.NEXT_PUBLIC_PARTYKIT_HOST;
    else process.env.NEXT_PUBLIC_PARTYKIT_HOST = prevHost;
    if (prevPlatform === undefined) delete process.env.BEANS_PLATFORM;
    else process.env.BEANS_PLATFORM = prevPlatform;
    if (prevCf === undefined) delete process.env.CF_PAGES;
    else process.env.CF_PAGES = prevCf;
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevVercelEnv;
  });

  it("returns sha + party host + platform with no-store caching", async () => {
    process.env.BEANS_PLATFORM = "Cloudflare";
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/version", {
        headers: { host: "beans-web.beans-lwagner.workers.dev" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/i);
    const body = await res.json();
    expect(body.sha).toBe("deadbeef");
    expect(body.partyHost).toBe("beans-party.beans-lwagner.workers.dev");
    expect(body.platform).toBe("Cloudflare");
    expect(typeof body.generatedAt).toBe("string");
  });

  it("falls back to hostname heuristics when env is unset", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/version", {
        headers: { host: "beans-game.vercel.app" },
      }),
    );
    const body = await res.json();
    expect(body.platform).toBe("Vercel");
  });
});
