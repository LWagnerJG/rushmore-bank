import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BEANS_WEB_ORIGIN,
  beansWebLocation,
  isVercelVersionPath,
  shouldForwardVercelRequest,
  VERCEL_FORWARD_HOSTS,
} from "../vercel-forward";

const vercelJson = JSON.parse(
  readFileSync(resolve(__dirname, "../../../vercel.json"), "utf8"),
) as {
  redirects: Array<{
    source: string;
    destination: string;
    statusCode: number;
    has?: Array<{ type: string; key?: string; value?: string }>;
  }>;
};

describe("vercel → beans-web forward helpers", () => {
  it("only forwards production Vercel hosts when VERCEL=1", () => {
    const base = {
      host: "beans-game.vercel.app",
      pathname: "/join/ABCD",
    };
    expect(shouldForwardVercelRequest({ ...base, vercel: "1" })).toBe(true);
    expect(shouldForwardVercelRequest({ ...base, vercel: undefined })).toBe(
      false,
    );
    expect(
      shouldForwardVercelRequest({
        vercel: "1",
        host: "beans-web.beans-lwagner.workers.dev",
        pathname: "/join/ABCD",
      }),
    ).toBe(false);
    expect(
      shouldForwardVercelRequest({
        vercel: "1",
        host: "beans-game-git-preview.vercel.app",
        pathname: "/",
      }),
    ).toBe(false);
    expect(
      shouldForwardVercelRequest({
        vercel: "1",
        host: "roundacats.vercel.app",
        pathname: "/room/ABCD",
      }),
    ).toBe(true);
  });

  it("leaves /api/version on Vercel so health checks can compare", () => {
    expect(isVercelVersionPath("/api/version")).toBe(true);
    expect(isVercelVersionPath("/api/version/")).toBe(true);
    expect(isVercelVersionPath("/api/judge")).toBe(false);
    expect(
      shouldForwardVercelRequest({
        vercel: "1",
        host: "beans-game.vercel.app",
        pathname: "/api/version",
      }),
    ).toBe(false);
    expect(
      shouldForwardVercelRequest({
        vercel: "1",
        host: "beans-game.vercel.app",
        pathname: "/api/judge",
      }),
    ).toBe(true);
  });

  it("preserves path and query on the 308 location", () => {
    expect(beansWebLocation("/join/ABCD", "?name=Luke")).toBe(
      `${BEANS_WEB_ORIGIN}/join/ABCD?name=Luke`,
    );
    expect(beansWebLocation("/", "")).toBe(`${BEANS_WEB_ORIGIN}/`);
    expect(beansWebLocation("/room/Z3K9", "spectate=1")).toBe(
      `${BEANS_WEB_ORIGIN}/room/Z3K9?spectate=1`,
    );
  });
});

describe("vercel.json 308 contract", () => {
  it("308s every path on the production Vercel hosts except /api/version", () => {
    expect(vercelJson.redirects).toHaveLength(VERCEL_FORWARD_HOSTS.length);
    for (const host of VERCEL_FORWARD_HOSTS) {
      const rule = vercelJson.redirects.find((r) =>
        r.has?.some((h) => h.type === "host" && h.value === host),
      );
      expect(rule, host).toBeTruthy();
      expect(rule!.statusCode).toBe(308);
      expect(rule!.source).toContain("api/version");
      expect(rule!.source).toMatch(/\(\?!api\/version/);
      expect(rule!.destination).toBe(`${BEANS_WEB_ORIGIN}/$1`);
    }
  });
});
