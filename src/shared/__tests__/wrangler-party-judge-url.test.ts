import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const config = readFileSync(
  resolve(__dirname, "../../../wrangler.jsonc"),
  "utf8",
);

describe("beans-party JUDGE_URL for scoring", () => {
  it("posts through beans-web (which proxies to Vercel) instead of Vercel directly", () => {
    expect(config).toMatch(
      /"JUDGE_URL"\s*:\s*"https:\/\/beans-web\.beans-lwagner\.workers\.dev"/,
    );
    expect(config).not.toMatch(
      /"JUDGE_URL"\s*:\s*"https:\/\/beans-game\.vercel\.app"/,
    );
  });
});
